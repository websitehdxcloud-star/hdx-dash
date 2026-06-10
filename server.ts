import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { db, UserRecord } from "./server/db";
import { ServerRequestStatus } from "./src/types";

// Extends Express.Request interface to support custom authenticated properties
interface AuthenticatedRequest extends Request {
  user?: UserRecord;
}

const sessions = new Map<string, string>(); // Token -> UserID

// Generate dynamic Google redirect URI based on platform context
function getGoogleRedirectUri(req: Request): string {
  const host = req.get("host") || "";
  // Check if hosted inside Cloud Run/secured reverse proxy or locally
  const isSecure = req.secure || host.includes("run.app") || host.includes("localhost:3000") === false;
  const protocol = isSecure ? "https" : "http";
  return `${protocol}://${host}/api/auth/google/callback`;
}

// Generate dynamic Discord redirect URI based on platform context
function getDiscordRedirectUri(req: Request): string {
  const host = req.get("host") || "";
  const isSecure = req.secure || host.includes("run.app") || host.includes("localhost:3000") === false;
  const protocol = isSecure ? "https" : "http";
  return `${protocol}://${host}/api/auth/discord/callback`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Auth Middleware
  function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized. Missing bearer token." });
      return;
    }

    const token = authHeader.split(" ")[1];
    const userId = sessions.get(token);

    if (!userId) {
      res.status(401).json({ error: "Invalid or expired session token." });
      return;
    }

    const user = db.findUserById(userId);
    if (!user) {
      res.status(401).json({ error: "User session exists but user not found." });
      return;
    }

    req.user = user;
    next();
  }

  // Admin Verification Middleware
  function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Forbidden. Admin access required." });
      return;
    }
    next();
  }

  // --- API ROUTES ---

  // Auth: Google Login Redirect URL generator
  app.get("/api/auth/google/url", (req: Request, res: Response) => {
    try {
      const redirectUri = getGoogleRedirectUri(req);
      const clientId = process.env.GOOGLE_CLIENT_ID || "835884888954-mphqnsj4krjp47q8kkk7rr7gefgr3g62.apps.googleusercontent.com";
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account"
      });
      res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate Google authorize URL" });
    }
  });

  // Auth: Google Login Callback handler (popup-based, communicates session back)
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send("Authorization code is missing");
        return;
      }

      const redirectUri = getGoogleRedirectUri(req);
      const clientId = process.env.GOOGLE_CLIENT_ID || "835884888954-mphqnsj4krjp47q8kkk7rr7gefgr3g62.apps.googleusercontent.com";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "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";

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        }).toString()
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("Google token exchange failed:", errText);
        res.status(500).send(`Failed to exchange authorization code: ${errText}`);
        return;
      }

      const tokens = (await tokenResponse.json()) as { access_token: string; id_token?: string };

      // Get user profile details from userinfo endpoint
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      if (!userResponse.ok) {
        res.status(500).send("Failed to retrieve Google user profile details.");
        return;
      }

      const googleUser = (await userResponse.json()) as { sub: string; email: string; name: string; picture?: string };

      if (!googleUser.email) {
        res.status(400).send("Your Google account must have an email address associated with it.");
        return;
      }

      const fallbackUsername = googleUser.name || googleUser.email.split("@")[0] || `player-${crypto.randomBytes(3).toString("hex")}`;
      
      // Look up or establish Google user representation
      const user = db.findOrCreateGoogleUser(fallbackUsername, googleUser.email);

      // Secure session token creation
      const token = `hdx-ses-${crypto.randomBytes(16).toString("hex")}`;
      sessions.set(token, user.id);

      const { passwordHash, salt, ...safeUser } = user;

      // HTML response that utilizes postMessage to signal completion back to the parent iframe
      res.send(`
        <html>
          <head>
            <title>HDX-DASH Google Authentication</title>
          </head>
          <body style="background:#020205;color:#ffffff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;max-width:400px;padding:30px;background:#090914;border:1px solid #1e293b;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
              <div style="background:#1e1b4b;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#60a5fa" />
                </svg>
              </div>
              <h2 style="color:#ffffff;margin:0 0 10px;font-size:20px;font-weight:600;">Success!</h2>
              <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;line-height:1.5;">You have successfully signed in using your Google Account.</p>
              <div style="color:#64748b;font-size:12px;border-top:1px solid #1e293b;padding-top:15px;">Connecting you to your panels...</div>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: "OAUTH_AUTH_SUCCESS",
                    token: ${JSON.stringify(token)},
                    user: ${JSON.stringify(safeUser)}
                  }, "*");
                  setTimeout(function() { window.close(); }, 800);
                } else {
                  localStorage.setItem("hdx_session_token", ${JSON.stringify(token)});
                  window.location.href = "/";
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("Google authentication route exception:", err);
      res.status(500).send(`Authentication error: ${err.message || "Unknown error occurred"}`);
    }
  });

  // Auth: Discord Login Redirect URL generator
  app.get("/api/auth/discord/url", (req: Request, res: Response) => {
    try {
      const redirectUri = getDiscordRedirectUri(req);
      const clientId = process.env.DISCORD_CLIENT_ID || "1514153887488282644";
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify email"
      });
      res.json({ url: `https://discord.com/api/oauth2/authorize?${params.toString()}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate Discord authorize URL" });
    }
  });

  // Auth: Discord Login Callback handler (popup-based, communicates session back)
  app.get("/api/auth/discord/callback", async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send("Authorization code is missing");
        return;
      }

      const redirectUri = getDiscordRedirectUri(req);
      const clientId = process.env.DISCORD_CLIENT_ID || "1514153887488282644";
      const clientSecret = process.env.DISCORD_CLIENT_SECRET || "dNNJCy7sOG3skzHLgmel8VuyBvUcQ9Bk";

      // Exchange code for tokens
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        }).toString()
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("Discord token exchange failed:", errText);
        res.status(500).send(`Failed to exchange Discord authorization code: ${errText}`);
        return;
      }

      const tokens = (await tokenResponse.json()) as { access_token: string; token_type: string };

      // Get user profile details from Discord /users/@me
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      if (!userResponse.ok) {
        res.status(500).send("Failed to retrieve Discord user profile details.");
        return;
      }

      const discordUser = (await userResponse.json()) as { id: string; username: string; email?: string | null };

      // Discord accounts might not have a confirmed email, use fallback in that scenario
      const email = discordUser.email || `${discordUser.username.toLowerCase()}@discord.com`;
      const fallbackUsername = discordUser.username || `player-${crypto.randomBytes(3).toString("hex")}`;
      
      // Look up or establish Discord user representation
      const user = db.findOrCreateDiscordUser(fallbackUsername, email);

      // Secure session token creation
      const token = `hdx-ses-${crypto.randomBytes(16).toString("hex")}`;
      sessions.set(token, user.id);

      const { passwordHash, salt, ...safeUser } = user;

      // HTML response that utilizes postMessage to signal completion back to the parent iframe
      res.send(`
        <html>
          <head>
            <title>HDX-DASH Discord Authentication</title>
          </head>
          <body style="background:#020205;color:#ffffff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;max-width:400px;padding:30px;background:#090914;border:1px solid #1e293b;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
              <div style="background:#1e1b4b;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                <svg width="32" height="32" viewBox="0 0 127.14 96.36" fill="#818cf8" xmlns="http://www.w3.org/2000/svg">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.48,6.83,77.19,77.19,0,0,0,49.18,0,105.15,105.15,0,0,0,18.74,8.07C-3.41,41.12-1,73.41,10.15,89.53a105.73,105.73,0,0,0,31.81,16.12,79.36,79.36,0,0,0,6.77-11A68.58,68.58,0,0,1,38.16,89.3c1,4.12,2,8.38,3.06,12.56a5.57,5.57,0,0,0,5.54,4.28c25.4-7.44,51.81-7.44,77.06,0a5.57,5.57,0,0,0,5.54-4.28c1.06-4.18,2.06-8.44,3.06-12.56a68.58,68.58,0,0,1-10.51,5.32,79.06,79.06,0,0,0,6.77,11,105.73,105.73,0,0,0,31.81-16.12C128.64,73.41,130.64,41.12,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5.12-12.69,11.45-12.69S53.91,46,53.91,53,48.78,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.29,60,73.29,53s5.12-12.69,11.45-12.69S96.19,46,96.19,53,91.06,65.69,84.69,65.69Z"/>
                </svg>
              </div>
              <h2 style="color:#ffffff;margin:0 0 10px;font-size:20px;font-weight:600;">Success!</h2>
              <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;line-height:1.5;">You have successfully signed in using your Discord Account.</p>
              <div style="color:#64748b;font-size:12px;border-top:1px solid #1e293b;padding-top:15px;">Connecting you to your panels...</div>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: "OAUTH_AUTH_SUCCESS",
                    token: ${JSON.stringify(token)},
                    user: ${JSON.stringify(safeUser)}
                  }, "*");
                  setTimeout(function() { window.close(); }, 800);
                } else {
                  localStorage.setItem("hdx_session_token", ${JSON.stringify(token)});
                  window.location.href = "/";
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("Discord authentication route exception:", err);
      res.status(500).send(`Authentication error: ${err.message || "Unknown error occurred"}`);
    }
  });

  // Auth: Signup
  app.post("/api/auth/signup", (req: Request, res: Response) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        res.status(400).json({ error: "Username, email, and password are required." });
        return;
      }

      if (username.length < 3) {
        res.status(400).json({ error: "Username must be at least 3 characters long." });
        return;
      }

      if (password.length < 5) {
        res.status(400).json({ error: "Password must be at least 5 characters long." });
        return;
      }

      // Check existing user
      const existingUser = db.findUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: "Email already registered." });
        return;
      }

      const existingUsername = db.getUsers().some(u => u.username.toLowerCase() === username.toLowerCase());
      if (existingUsername) {
        res.status(400).json({ error: "Username is already taken." });
        return;
      }

      // Create user
      const newUser = db.createUser(username, email, password, "user");
      
      // Create session
      const token = `hdx-ses-${crypto.randomBytes(16).toString("hex")}`;
      sessions.set(token, newUser.id);

      // Remove sensitive fields
      const { passwordHash, salt, ...safeUser } = newUser;

      res.status(201).json({ user: safeUser, token });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Signup failed." });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }

      const user = db.findUserByEmail(email);
      if (!user) {
        res.status(400).json({ error: "Invalid email or password." });
        return;
      }

      const hashedInput = crypto.pbkdf2Sync(password, user.salt, 1000, 64, "sha512").toString("hex");
      if (hashedInput !== user.passwordHash) {
        res.status(400).json({ error: "Invalid email or password." });
        return;
      }

      // Create session
      const token = `hdx-ses-${crypto.randomBytes(16).toString("hex")}`;
      sessions.set(token, user.id);

      // Remove sensitive fields
      const { passwordHash, salt, ...safeUser } = user;

      res.status(200).json({ user: safeUser, token });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Login failed." });
    }
  });

  // Auth: Me status check
  app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "Not logged in" });
      return;
    }
    const { passwordHash, salt, ...safeUser } = req.user;
    res.json({ user: safeUser });
  });

  // User requests: Get user requests
  app.get("/api/user/requests", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const requests = db.getRequestsByUserId(userId);
      res.json({ requests });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch requests" });
    }
  });

  // User requests: Create request
  app.post("/api/user/requests", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { planName, cpu, ram, disk, location, cpuType, ramType, diskType } = req.body;

      if (!planName || !cpu || !ram || !disk || !location || !cpuType || !ramType || !diskType) {
        res.status(400).json({ error: "All server configuration parameters are required." });
        return;
      }

      // Check if user has an active request (pending or approved) to block double request
      const activeRequest = db.getRequestsByUserId(userId).find(
        (r) => r.status === "pending" || r.status === "approved"
      );
      if (activeRequest) {
        res.status(400).json({ error: "You already have an active server request (pending or approved)." });
        return;
      }

      const request = db.createServerRequest(
        userId,
        planName,
        cpu,
        ram,
        disk,
        location,
        cpuType,
        ramType,
        diskType
      );

      res.status(201).json({ request });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create server request" });
    }
  });

  // User requests: Cancel request
  app.post("/api/user/requests/:id/cancel", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      const request = db.findRequestById(id);
      if (!request) {
        res.status(404).json({ error: "Server request not found" });
        return;
      }

      if (request.userId !== userId) {
        res.status(403).json({ error: "Forbidden. This request belongs to another user." });
        return;
      }

      if (request.status !== "pending") {
        res.status(400).json({ error: "Only pending server requests can be cancelled." });
        return;
      }

      const updated = db.updateRequestStatus(id, "cancelled", {
        adminNote: "Cancelled by owner"
      });

      res.json({ request: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to cancel request" });
    }
  });

  // User notifications: Get notifications
  app.get("/api/user/notifications", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const notifications = db.getNotificationsByUser(userId);
      res.json({ notifications });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch notifications" });
    }
  });

  // User notifications: Mark all read
  app.post("/api/user/notifications/read", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      db.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // User notifications: Mark specific read
  app.post("/api/user/notifications/:id/read", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      db.markNotificationAsRead(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ADMIN PORTAL ROUTES ---

  // Admin: Get all requests
  app.get("/api/admin/requests", requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      let requests = db.getServerRequests();
      const { status } = req.query;

      if (status && typeof status === "string" && status !== "all") {
        requests = requests.filter((r) => r.status === status);
      }

      // Enhance requests with usernames
      const users = db.getUsers();
      const enhancedRequests = requests.map((r) => {
        const matchingUser = users.find((u) => u.id === r.userId);
        return {
          ...r,
          username: matchingUser ? matchingUser.username : "Unknown",
          email: matchingUser ? matchingUser.email : "Unknown",
        };
      });

      res.json({ requests: enhancedRequests });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch requests" });
    }
  });

  // Admin: Update Status and details
  app.post("/api/admin/requests/:id/status", requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, panelLink, panelEmail, panelPassword, adminNote } = req.body;

      if (!status) {
        res.status(400).json({ error: "Status is required." });
        return;
      }

      const validStatuses: ServerRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "Invalid status value." });
        return;
      }

      const updatedRequest = db.updateRequestStatus(id, status, {
        link: panelLink,
        email: panelEmail,
        password: panelPassword,
        adminNote: adminNote,
      });

      res.json({ request: updatedRequest });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update server request." });
    }
  });

  // Admin: Get analytical statistics
  app.get("/api/admin/stats", requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      const requests = db.getServerRequests();
      const total = requests.length;
      const pending = requests.filter((r) => r.status === "pending").length;
      const approved = requests.filter((r) => r.status === "approved").length;
      const rejected = requests.filter((r) => r.status === "rejected").length;
      const cancelled = requests.filter((r) => r.status === "cancelled").length;

      const users = db.getUsers().filter(u => u.role !== 'admin').length;

      res.json({
        total,
        pending,
        approved,
        rejected,
        cancelled,
        totalUsers: users,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\x1b[32m[HDX-DASH BACKEND] Server running on http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[34m[HDX-DASH BACKEND] Preloaded Admin account: admin@gmail.com / hdxcloudxyz\x1b[0m`);
  });
}

startServer().catch((err) => {
  console.error("Critical server error:", err);
});
