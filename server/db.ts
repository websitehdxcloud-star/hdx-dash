import fs from "fs";
import path from "path";
import crypto from "crypto";
import { User, ServerRequest, Notification, UserRole, ServerRequestStatus } from "../src/types";

// DB Types
export interface UserRecord extends User {
  passwordHash: string;
  salt: string;
}

interface DBData {
  users: UserRecord[];
  serverRequests: ServerRequest[];
  notifications: Notification[];
}

const DB_FILE = path.join(process.cwd(), "db.json");

// Default initial state
const defaultDB: DBData = {
  users: [],
  serverRequests: [],
  notifications: [],
};

// Create a helper to hash passwords with salt using PBKDF2
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

class Database {
  private data: DBData = { ...defaultDB };

  constructor() {
    this.load();
    this.seedAdmin();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(raw);
        // Ensure collections exist
        if (!this.data.users) this.data.users = [];
        if (!this.data.serverRequests) this.data.serverRequests = [];
        if (!this.data.notifications) this.data.notifications = [];
      } else {
        this.save();
      }
    } catch (e) {
      console.error("Failed to load database, using default", e);
      this.data = { ...defaultDB };
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save database", e);
    }
  }

  private seedAdmin() {
    // Seed default admin account if not exists
    const adminExists = this.data.users.some((u) => u.email === "admin@gmail.com");
    if (!adminExists) {
      // Remove old seeded admin if any to keep database clean
      this.data.users = this.data.users.filter((u) => u.email !== "admin@hdx.com" && u.role !== "admin");

      const salt = generateSalt();
      const adminUser: UserRecord = {
        id: "admin-id-123456",
        username: "admin",
        email: "admin@gmail.com",
        role: "admin",
        passwordHash: hashPassword("hdxcloudxyz", salt),
        salt,
        createdAt: new Date().toISOString(),
      };
      this.data.users.push(adminUser);
      
      // Add a welcoming notification for testing
      const welcomeNotification: Notification = {
        id: crypto.randomUUID(),
        userId: "admin-id-123456",
        message: "Welcome to HDX-DASH Admin. You have full control over server requests.",
        read: false,
        createdAt: new Date().toISOString(),
      };
      this.data.notifications.push(welcomeNotification);
      
      this.save();
      console.log("Admin seeded successfully: admin@gmail.com / hdxcloudxyz");
    }
  }

  // --- Users Operations ---
  public getUsers(): UserRecord[] {
    return this.data.users;
  }

  public findUserByEmail(email: string): UserRecord | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findOrCreateGoogleUser(username: string, email: string): UserRecord {
    const existing = this.findUserByEmail(email);
    if (existing) {
      return existing;
    }

    const salt = generateSalt();
    const randomPassword = crypto.randomBytes(16).toString("hex");
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      username,
      email: email.toLowerCase(),
      role: "user",
      passwordHash: hashPassword(randomPassword, salt),
      salt,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);

    this.data.notifications.push({
      id: crypto.randomUUID(),
      userId: newUser.id,
      message: `Welcome to HDX-DASH, ${username}! You logged in securely using Google OAuth. Now you can request your Minecraft server slots!`,
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.save();
    return newUser;
  }

  public findOrCreateDiscordUser(username: string, email: string): UserRecord {
    const existing = this.findUserByEmail(email);
    if (existing) {
      return existing;
    }

    const salt = generateSalt();
    const randomPassword = crypto.randomBytes(16).toString("hex");
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      username,
      email: email.toLowerCase(),
      role: "user",
      passwordHash: hashPassword(randomPassword, salt),
      salt,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);

    this.data.notifications.push({
      id: crypto.randomUUID(),
      userId: newUser.id,
      message: `Welcome to HDX-DASH, ${username}! You logged in securely using Discord OAuth. Now you can request your Minecraft server slots!`,
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.save();
    return newUser;
  }

  public createUser(username: string, email: string, passwordPlain: string, role: UserRole = "user"): UserRecord {
    const salt = generateSalt();
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      username,
      email: email.toLowerCase(),
      role,
      passwordHash: hashPassword(passwordPlain, salt),
      salt,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    
    // Add welcome notification
    this.data.notifications.push({
      id: crypto.randomUUID(),
      userId: newUser.id,
      message: `Welcome to HDX-DASH, ${username}! Request your Minecraft server using the Create Server flow.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
    
    this.save();
    return newUser;
  }

  // --- Server Requests Operations ---
  public getServerRequests(): ServerRequest[] {
    return this.data.serverRequests;
  }

  public getRequestsByUserId(userId: string): ServerRequest[] {
    return this.data.serverRequests.filter((r) => r.userId === userId);
  }

  public findRequestById(id: string): ServerRequest | undefined {
    return this.data.serverRequests.find((r) => r.id === id);
  }

  public createServerRequest(
    userId: string,
    planName: string,
    cpu: string,
    ram: string,
    disk: string,
    location: "Asia" | "India",
    cpuType: "AMD" | "INTEL",
    ramType: "DDR3" | "DDR4",
    diskType: "Gen 3" | "Gen 4"
  ): ServerRequest {
    // Check if user has an active request (pending or approved)
    const hasActive = this.data.serverRequests.some(
      (r) => r.userId === userId && (r.status === "pending" || r.status === "approved")
    );
    if (hasActive) {
      throw new Error("You already have an active server request (pending or approved).");
    }

    const newRequest: ServerRequest = {
      id: crypto.randomUUID(),
      userId,
      planName,
      cpu,
      ram,
      disk,
      location,
      cpuType,
      ramType,
      diskType,
      token: `hdx-${crypto.randomBytes(6).toString("hex")}-${crypto.randomBytes(4).toString("hex")}`,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.serverRequests.push(newRequest);
    this.save();
    return newRequest;
  }

  public updateRequestStatus(
    id: string,
    status: ServerRequestStatus,
    panelDetails?: { link?: string; email?: string; password?: string; adminNote?: string }
  ): ServerRequest {
    const reqIndex = this.data.serverRequests.findIndex((r) => r.id === id);
    if (reqIndex === -1) {
      throw new Error("Server request not found.");
    }

    const req = this.data.serverRequests[reqIndex];
    req.status = status;
    req.updatedAt = new Date().toISOString();

    if (panelDetails) {
      if (panelDetails.link !== undefined) req.panelLink = panelDetails.link;
      if (panelDetails.email !== undefined) req.panelEmail = panelDetails.email;
      if (panelDetails.password !== undefined) req.panelPassword = panelDetails.password;
      if (panelDetails.adminNote !== undefined) req.adminNote = panelDetails.adminNote;
    }

    // Add user notification
    const statusText = status.toUpperCase();
    let msg = `Your Minecraft server request (${req.planName}) status has been updated to: ${statusText}.`;
    if (status === "approved" && panelDetails?.link) {
      msg += ` Panel credentials are now available in your dashboard!`;
    } else if (status === "rejected" && panelDetails?.adminNote) {
      msg += ` Reason: ${panelDetails.adminNote}`;
    } else if (status === "cancelled" && panelDetails?.adminNote) {
      msg += ` Note: ${panelDetails.adminNote}`;
    }

    this.data.notifications.push({
      id: crypto.randomUUID(),
      userId: req.userId,
      message: msg,
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.save();
    return req;
  }

  // --- Notifications Operations ---
  public getNotificationsByUser(userId: string): Notification[] {
    return this.data.notifications.filter((n) => n.userId === userId);
  }

  public markNotificationAsRead(id: string): void {
    const notify = this.data.notifications.find((n) => n.id === id);
    if (notify) {
      notify.read = true;
      this.save();
    }
  }

  public markAllNotificationsAsRead(userId: string): void {
    this.data.notifications
      .filter((n) => n.userId === userId)
      .forEach((n) => (n.read = true));
    this.save();
  }

  public addNotification(userId: string, message: string): Notification {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      userId,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.data.notifications.push(newNotification);
    this.save();
    return newNotification;
  }
}

export const db = new Database();
