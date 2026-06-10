/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Server,
  Cpu,
  Layers,
  Database,
  Globe,
  Plus,
  Shield,
  Copy,
  Check,
  Bell,
  Trash,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Lock,
  Mail,
  User as UserIcon,
  HelpCircle,
  Eye,
  EyeOff,
  Terminal,
  Activity,
  LogOut,
  Sparkles,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import Navbar from "./components/Navbar";
import { User, ServerRequest, Notification, ServerRequestStatus } from "./types";
import {
  checkMe,
  login,
  signup,
  logout,
  fetchUserRequests,
  createServerRequest,
  cancelServerRequest,
  fetchUserNotifications,
  adminFetchRequests,
  adminUpdateStatus,
  adminUpdateStats
} from "./api";

// Minecraft plans config
export const SERVER_PLANS = [
  {
    id: "plan-1",
    name: "Dirt Tier (Iron Peak)",
    cpu: "1 Core",
    ram: "1GB",
    disk: "5GB",
    perf: "Low Spec",
    price: "Free Starter",
    desc: "Perfect for testing plugins or hosting a small survival world with 2-3 friends."
  },
  {
    id: "plan-2",
    name: "Redstone Tier (Gold Mine)",
    cpu: "2 Cores",
    ram: "2GB",
    disk: "10GB",
    perf: "Low Spec",
    price: "Free Standard",
    desc: "Great for basic modpacks, small Spigot/Paper networks or persistent group gameplay."
  },
  {
    id: "plan-3",
    name: "Diamond Tier (Diamond Core)",
    cpu: "3 Cores",
    ram: "3GB",
    disk: "10GB",
    perf: "High Spec",
    price: "Free Premium",
    desc: "Excellent performance. Supports heavily modified servers, custom hubs, and large worlds."
  },
  {
    id: "plan-4",
    name: "Wither Tier (Nether Star)",
    cpu: "3.5 Cores",
    ram: "4GB",
    disk: "15GB",
    perf: "High Spec",
    price: "₹39 / Month",
    desc: "Maximum powerhouse spec. Recommended for production networks, high-tick farms, and active community hubs."
  }
];

export default function App() {
  const [currentView, setCurrentView] = useState<"landing" | "login" | "signup" | "dashboard" | "admin">("landing");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationTrigger, setNotificationTrigger] = useState(0);

  // Success / error alerts (Toasts)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Form states
  const [authEmail, setAuthEmail] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // User Dashboard State
  const [requests, setRequests] = useState<ServerRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Create Server Flow States
  const [selectedPlanId, setSelectedPlanId] = useState<string>("plan-1");
  const [creatingServer, setCreatingServer] = useState(false);

  // Admin Portal States
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    totalUsers: 0
  });
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [selectedAdminRequest, setSelectedAdminRequest] = useState<any | null>(null);

  // Admin editing fields
  const [panelLink, setPanelLink] = useState("");
  const [panelEmail, setPanelEmail] = useState("");
  const [panelPassword, setPanelPassword] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  // Check auth session on startup
  useEffect(() => {
    checkMe()
      .then((user) => {
        setCurrentUser(user);
        if (user.role === "admin") {
          setCurrentView("admin");
        } else {
          setCurrentView("dashboard");
        }
      })
      .catch(() => {
        // Not logged in or expired
        setCurrentUser(null);
        setCurrentView("landing");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Listen for Google login messaging from secondary authentication popups (iframe safe)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      // Allow from the same host or dynamically matched run.app previews
      if (!origin.endsWith(".run.app") && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        return;
      }

      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const { token, user } = event.data;
        if (token && user) {
          localStorage.setItem("hdx_session_token", token);
          setCurrentUser(user);
          showToast(`Signed in successfully with Google! Welcome back.`, "success");
          if (user.role === "admin") {
            setCurrentView("admin");
          } else {
            setCurrentView("dashboard");
          }
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Fetch dashboards data when view or user changes
  useEffect(() => {
    if (!currentUser) return;

    if (currentView === "dashboard") {
      setLoadingRequests(true);
      fetchUserRequests()
        .then((data) => setRequests(data))
        .catch((err) => showToast(err.message, "error"))
        .finally(() => setLoadingRequests(false));
    } else if (currentView === "admin" && currentUser.role === "admin") {
      loadAdminDashboard();
    }
  }, [currentView, currentUser]);

  const loadAdminDashboard = () => {
    setLoadingAdminData(true);
    Promise.all([adminFetchRequests(adminStatusFilter), adminUpdateStats()])
      .then(([reqs, stats]) => {
        setAdminRequests(reqs);
        setAdminStats(stats);
      })
      .catch((err) => showToast(err.message, "error"))
      .finally(() => setLoadingAdminData(false));
  };

  // Status Filter change reload
  useEffect(() => {
    if (currentUser?.role === "admin" && currentView === "admin") {
      setLoadingAdminData(true);
      adminFetchRequests(adminStatusFilter)
        .then((reqs) => setAdminRequests(reqs))
        .catch((err) => showToast(err.message, "error"))
        .finally(() => setLoadingAdminData(false));
    }
  }, [adminStatusFilter]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setRequests([]);
    setAdminRequests([]);
    showToast("Signed out successfully", "success");
    setCurrentView("landing");
  };

  const handleAuthSubmit = async (e: React.FormEvent, type: "login" | "signup") => {
    e.preventDefault();
    setFormError("");
    setAuthLoading(true);

    try {
      if (type === "signup") {
        if (!authUsername || !authEmail || !authPassword) {
          throw new Error("All fields are required");
        }
        const data = await signup(authUsername, authEmail, authPassword);
        setCurrentUser(data.user);
        showToast(`Welcome ${data.user.username}!`, "success");
        setCurrentView("dashboard");
      } else {
        if (!authEmail || !authPassword) {
          throw new Error("Please enter your email and password");
        }
        const data = await login(authEmail, authPassword);
        setCurrentUser(data.user);
        showToast(`Logged in as ${data.user.username}`, "success");
        if (data.user.role === "admin") {
          setCurrentView("admin");
        } else {
          setCurrentView("dashboard");
        }
      }
      // Reset state
      setAuthPassword("");
      setAuthUsername("");
      setAuthEmail("");
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Demo shortcut credentials helper
  const handleLoadDemoCredentials = (role: "admin" | "user") => {
    setFormError("");
    if (role === "admin") {
      setAuthEmail("admin@gmail.com");
      setAuthPassword("hdxcloudxyz");
    } else {
      setAuthEmail("testuser@hdx.com");
      setAuthPassword("testpass");
      setAuthUsername("MinePro99");
    }
    showToast(`Pre-filled ${role} credentials! Click Sign In.`, "info");
  };

  const handleGoogleOAuthLogin = async () => {
    try {
      setFormError("");
      const response = await fetch("/api/auth/google/url");
      if (!response.ok) {
        throw new Error("Failed to produce Google Authentication URL from server.");
      }
      const { url } = await response.json();
      
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        url,
        "hdx_google_oauth",
        `width=${width},height=${height},left=${left},top=${top},status=yes,scrollbars=yes`
      );
      
      if (!popup) {
        throw new Error("Popup was blocked by the browser. Please permit popups to log in using Google.");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDiscordOAuthLogin = async () => {
    try {
      setFormError("");
      const response = await fetch("/api/auth/discord/url");
      if (!response.ok) {
        throw new Error("Failed to produce Discord Authentication URL from server.");
      }
      const { url } = await response.json();
      
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        url,
        "hdx_discord_oauth",
        `width=${width},height=${height},left=${left},top=${top},status=yes,scrollbars=yes`
      );
      
      if (!popup) {
        throw new Error("Popup was blocked by the browser. Please permit popups to log in using Discord.");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Server plan rules calculations
  const getPlanDetails = (planId: string) => {
    const plan = SERVER_PLANS.find(p => p.id === planId) || SERVER_PLANS[0];
    const isHighSpec = plan.perf === "High Spec";
    return {
      planName: plan.name,
      cpu: plan.cpu,
      ram: plan.ram,
      disk: plan.disk,
      location: isHighSpec ? ("Asia" as const) : ("India" as const),
      cpuType: isHighSpec ? ("AMD" as const) : ("INTEL" as const),
      ramType: isHighSpec ? ("DDR4" as const) : ("DDR3" as const),
      diskType: isHighSpec ? ("Gen 4" as const) : ("Gen 3" as const)
    };
  };

  const handleCreateServerSubmit = async () => {
    if (!currentUser) return;
    setCreatingServer(true);

    try {
      const config = getPlanDetails(selectedPlanId);
      await createServerRequest(config);
      showToast("Server request submitted successfully!", "success");
      setNotificationTrigger((prev) => prev + 1);
      
      // Reload user requests & go to user dashboard
      const updatedReqs = await fetchUserRequests();
      setRequests(updatedReqs);
      setCurrentView("dashboard");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreatingServer(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!window.confirm("Are you sure you want to cancel this pending server request?")) {
      return;
    }

    try {
      await cancelServerRequest(requestId);
      showToast("Request cancelled successfully", "success");
      setNotificationTrigger((prev) => prev + 1);
      const updatedReqs = await fetchUserRequests();
      setRequests(updatedReqs);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAdminSelectRequest = (req: any) => {
    setSelectedAdminRequest(req);
    setPanelLink(req.panelLink || "");
    setPanelEmail(req.panelEmail || "");
    setPanelPassword(req.panelPassword || "");
    setAdminNote(req.adminNote || "");
  };

  const handleAdminUpdateStatus = async (status: ServerRequestStatus) => {
    if (!selectedAdminRequest) return;
    
    if (status === "approved" && !panelLink) {
      showToast("Please provide panel login link for approved servers.", "error");
      return;
    }

    setAdminActionLoading(true);
    try {
      await adminUpdateStatus(selectedAdminRequest.id, {
        status,
        panelLink,
        panelEmail,
        panelPassword,
        adminNote
      });

      showToast(`Request was successfully set to ${status}`, "success");
      setNotificationTrigger((prev) => prev + 1);
      
      // Reset selection and reload
      setSelectedAdminRequest(null);
      loadAdminDashboard();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2500);
    showToast("Copied to clipboard!", "success");
  };

  const activeUserRequest = requests.find((r) => r.status === "pending" || r.status === "approved");

  if (loading) {
    return (
      <div id="startup-loader" className="min-h-screen bg-[#07070d] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl animate-pulse-slow"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-bounce mb-4">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white mb-2">
            HDX-<span className="brand-text">DASH</span>
          </h1>
          <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full origin-left animate-[shimmer_1.5s_infinite] progress-glow"></div>
          </div>
          <p className="text-slate-500 text-xs mt-3 font-mono">ESTABLISHING CRYPTO CORE SECURE DATABASE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07070d] selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* GLOBAL NOTIFICATION SYSTEM */}
      {toast && (
        <div
          id="global-toast"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border transition-all duration-300 max-w-md ${
            toast.type === "success"
              ? "bg-[#061c15] text-[#a7f3d0] border-[#059669]/40"
              : toast.type === "error"
              ? "bg-[#1f0d0d] text-[#fca5a5] border-[#dc2626]/40"
              : "bg-[#0c1328] text-[#93c5fd] border-[#2563eb]/40"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />}
          {toast.type === "error" && <XCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />}
          {toast.type === "info" && <AlertCircle className="w-5 h-5 flex-shrink-0 text-blue-400" />}
          <span className="text-xs font-medium leading-relaxed">{toast.message}</span>
        </div>
      )}

      <Navbar
        currentUser={currentUser}
        onNavigate={setCurrentView}
        currentView={currentView}
        onLogout={handleLogout}
        notificationTrigger={notificationTrigger}
      />

      <main className="flex-grow pt-24 pb-16">
        
        {/* =======================================================
            VIEW 1: LANDING PAGE
         ======================================================= */}
        {currentView === "landing" && (
          <div id="landing-view" className="relative">
            {/* Background orbs */}
            <div className="absolute top-10 left-10 w-96 h-96 bg-blue-900/10 rounded-full blur-[140px] animate-pulse"></div>
            <div className="absolute top-1/2 right-10 w-96 h-96 bg-purple-900/10 rounded-full blur-[140px] animate-pulse-slow"></div>

            {/* Hero Banner Grid Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                {/* Hero Context Left */}
                <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-500/20 text-xs font-semibold text-indigo-300">
                    <Sparkles className="w-3.5 h-3.5" /> High performance Ryzen 9 VPS nodes
                  </div>
                  
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-display leading-[1.1] tracking-tight text-white">
                    Experience Next-Gen <br />
                    Minecraft Hosting on <br />
                    <span className="brand-text">HDX-DASH</span>
                  </h1>

                  <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
                    Request custom VPS game servers with secure panel access, automated deployment configurations, AMD Ryzen hardware, and robust low-latency networks completely free or premium.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                    {currentUser ? (
                      <button
                        id="hero-go-dash-btn"
                        onClick={() => setCurrentView("dashboard")}
                        className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 hover:shadow-indigo-500/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Go to Dashboard <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          id="hero-start-btn"
                          onClick={() => setCurrentView("signup")}
                          className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 hover:shadow-indigo-500/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          Get Started Now <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          id="hero-login-btn"
                          onClick={() => setCurrentView("login")}
                          className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-semibold glass-panel text-white hover:bg-slate-800/60 hover:text-indigo-400 transition duration-200 flex items-center justify-center gap-2 cursor-pointer border border-indigo-950/50"
                        >
                          Partner Sign-In
                        </button>
                      </>
                    )}
                    <a
                      id="hero-discord-link"
                      href="https://discord.gg/fSZ9XXSa3w"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-300 transition underline tracking-wider font-mono"
                    >
                      Official Discord Group
                    </a>
                  </div>

                  <div className="flex items-center justify-center lg:justify-start gap-8 pt-6 border-t border-slate-900 text-left">
                    <div>
                      <span className="block text-2xl font-bold text-white font-display">99.9%</span>
                      <span className="text-xs text-slate-500 font-mono">uptime SLA guaranteed</span>
                    </div>
                    <div className="w-px h-8 bg-slate-900"></div>
                    <div>
                      <span className="block text-2xl font-bold text-indigo-400 font-display">5.0 GHz</span>
                      <span className="text-xs text-slate-500 font-mono">AMD Ryzen Processors</span>
                    </div>
                    <div className="w-px h-8 bg-slate-900"></div>
                    <div>
                      <span className="block text-2xl font-bold text-purple-400 font-display">Gen 4</span>
                      <span className="text-xs text-slate-500 font-mono">ultra-fast disk storage</span>
                    </div>
                  </div>
                </div>

                {/* Hero Graphic Right (Isometric Server mockup with CSS) */}
                <div id="hero-graphics" className="lg:col-span-5 relative flex justify-center lg:justify-end">
                  <div className="w-full max-w-[420px] aspect-square rounded-3xl glass-panel relative p-8 border border-indigo-950/40 shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-transparent opacity-80"></div>
                    
                    {/* Animated Server Nodes Mockup */}
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div className="flex items-center justify-between border-b border-indigo-950/40 pb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></div>
                          <span className="text-[11px] font-mono tracking-wider text-slate-400">NODE-01 ACTIVE: SINGAPORE</span>
                        </div>
                        <Activity className="w-4 h-4 text-slate-500 animate-pulse" />
                      </div>

                      <div className="space-y-4 my-6">
                        {/* Server Bay 1 */}
                        <div className="p-3 bg-slate-950/80 rounded-xl border border-indigo-950/30 flex items-center justify-between hover:border-indigo-500/20 transition group">
                          <div className="flex items-center gap-3">
                            <Cpu className="w-5 h-5 text-indigo-400" />
                            <div>
                              <p className="text-xs font-semibold text-white">AMD Ryzen 9 7950X</p>
                              <div className="w-24 h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                <div className="w-11/12 h-full bg-indigo-500"></div>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded">91% Core</span>
                        </div>

                        {/* Server Bay 2 */}
                        <div className="p-3 bg-slate-950/80 rounded-xl border border-indigo-950/30 flex items-center justify-between hover:border-indigo-500/20 transition">
                          <div className="flex items-center gap-3">
                            <Layers className="w-5 h-5 text-purple-400" />
                            <div>
                              <p className="text-xs font-semibold text-white">DDR5 High Frequency RAM</p>
                              <div className="w-24 h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                <div className="w-[64%] h-full bg-purple-500"></div>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded">64% Allocation</span>
                        </div>

                        {/* Server Bay 3 */}
                        <div className="p-3 bg-slate-950/80 rounded-xl border border-indigo-950/30 flex items-center justify-between hover:border-indigo-500/20 transition">
                          <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-xs font-semibold text-white">PCIe Gen 4 NVMe SSDs</p>
                              <div className="w-24 h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                <div className="w-[32%] h-full bg-blue-400"></div>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded">32% Load</span>
                        </div>
                      </div>

                      <div className="bg-[#0c0c1b]/90 border border-indigo-950/50 rounded-xl p-3 text-center">
                        <span className="text-[10px] font-mono text-slate-400 block mb-1">CONNECT VIA BINDED PANEL</span>
                        <code className="text-xs text-emerald-400 bg-emerald-950/30 px-3 py-1 rounded block select-all">panel.hdx-dash.com:8443</code>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Hosting Feature Highlights */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-indigo-950/40 relative z-10">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-indigo-400 font-mono text-xs tracking-widest uppercase bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-950/30">
                  Premium Infrastructure Features
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mt-3">
                  Why host your Minecraft Server with HDX-DASH?
                </h2>
                <p className="text-slate-400 text-sm mt-2">
                  Built by server admins for players, optimizing performance and safety.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl hover:border-indigo-500/20 transition duration-300 flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-950/50 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Uncapped CPU Allocation</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Our setups allocate full physical AMD Ryzen threads natively. No heavy over-allocation of client servers ensures crisp uninterrupted ticking.
                    </p>
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl hover:border-purple-500/20 transition duration-300 flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">DDR4 Dedicated RAM Blocks</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Enjoy stable, clean garbage collection execution times. Selected high specification RAM protects you from memory leakage on heavy mods.
                    </p>
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl hover:border-blue-500/20 transition duration-300 flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-blue-950/50 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                      <Globe className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Instant Dual Geographical Spots</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Host servers either in the heart of our major Singapore Nodes (Asia) or closer to India locations (Mumbai). Ideal for maximizing ping conditions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing / Server plan selection Cards (Landing Display) */}
            <div id="pricing-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-indigo-950/40 relative z-10">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-purple-400 font-mono text-xs tracking-widest uppercase bg-purple-950/40 px-3 py-1 rounded-full border border-purple-950/30">
                  Selectable Performance Configurations
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mt-3">
                  Our High-Speed Server Plans
                </h2>
                <p className="text-slate-400 text-sm mt-2">
                  Pick the plan that suits your community scale. Upgrade or request easily.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {SERVER_PLANS.map((plan) => {
                  const isHigh = plan.perf === "High Spec";
                  return (
                    <div
                      key={plan.id}
                      className={`glass-panel rounded-2xl p-5 border relative transition duration-300 flex flex-col justify-between ${
                        isHigh
                          ? "border-purple-900/60 shadow-lg shadow-purple-950/20 hover:border-purple-500"
                          : "border-indigo-950/50 hover:border-indigo-600"
                      }`}
                    >
                      {isHigh && (
                        <div className="absolute -top-3 left-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-[10px] text-white font-mono uppercase tracking-wider font-bold py-1 px-3.5 rounded-full shadow">
                          High Performance Model
                        </div>
                      )}
                      
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                          {plan.perf} ACCELERATOR
                        </span>
                        <h4 className="text-lg font-bold text-white mt-1 mb-2 font-display">{plan.name}</h4>
                        
                        <div className="text-2xl font-mono font-bold tracking-tight text-white mb-4">
                          {plan.price}
                        </div>

                        <ul className="space-y-2 mb-6">
                          <li className="flex items-center gap-2 text-xs text-slate-300">
                            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                            <span>CPU: <strong className="text-white">{plan.cpu}</strong></span>
                          </li>
                          <li className="flex items-center gap-2 text-xs text-slate-300">
                            <Layers className="w-3.5 h-3.5 text-purple-400" />
                            <span>RAM: <strong className="text-white">{plan.ram}</strong></span>
                          </li>
                          <li className="flex items-center gap-2 text-xs text-slate-300">
                            <Database className="w-3.5 h-3.5 text-blue-400" />
                            <span>Disk Space: <strong className="text-white">{plan.disk}</strong></span>
                          </li>
                          <li className="flex items-center gap-2 text-[11px] text-indigo-300 bg-indigo-950/20 p-2 rounded border border-indigo-950/40">
                            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              Auto-Region: <strong>{isHigh ? "Asia Hub (Singapore)" : "India"}</strong>
                            </span>
                          </li>
                        </ul>

                        <p className="text-xs text-slate-500 leading-relaxed italic mb-4">
                          {plan.desc}
                        </p>
                      </div>

                      <button
                        id={`landing-request-${plan.id}-btn`}
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          if (!currentUser) {
                            setCurrentView("signup");
                          } else {
                            setCurrentView("dashboard");
                          }
                        }}
                        className={`w-full py-2.5 rounded-xl text-center text-xs font-semibold tracking-wide transition cursor-pointer ${
                          isHigh
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 font-display shadow-md shadow-purple-950/40"
                            : "bg-slate-900 hover:bg-slate-800 text-white border border-indigo-950/60"
                        }`}
                      >
                        {currentUser ? "Configure Plan" : "Sign Up and Host"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Why Choose Us footer call-out */}
            <div className="max-w-5xl mx-auto px-4 py-12 rounded-3xl bg-indigo-950/10 border border-indigo-950/50 text-center relative overflow-hidden my-16">
              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-purple-900/10 rounded-full blur-3xl"></div>
              <div className="relative z-10 max-w-xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-2 font-display">Ready to establish server rule?</h3>
                <p className="text-slate-400 text-xs mb-6">
                  Sign up now, create your profile, submit high performance plans. Once the admin approves, boot your Pterodactyl controls instantly!
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    id="why-signup-btn"
                    onClick={() => setCurrentView("signup")}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-white text-[#07070d] hover:bg-slate-200 transition cursor-pointer"
                  >
                    Register Account
                  </button>
                  <a
                    id="discord-invite-btn"
                    href="https://discord.gg/fSZ9XXSa3w"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white glass-panel hover:bg-slate-800/40 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Discord Community
                  </a>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =======================================================
            VIEW 2: LOGIN / SIGNUP / AUTH PORTAL
         ======================================================= */}
        {(currentView === "login" || currentView === "signup") && (
          <div id="auth-view" className="max-w-md mx-auto px-4 py-8 relative">
            <div className="absolute inset-0 -top-12 w-64 h-64 bg-indigo-900/10 rounded-full blur-[100px] mx-auto"></div>
            
            <div className="glass-panel rounded-2xl border border-indigo-950/60 p-6 relative z-10 shadow-2xl">
              <div className="text-center mb-6">
                <span className="text-xs text-indigo-400 font-mono tracking-widest uppercase">HDX-DASH ACCOUNT GATEWAY</span>
                <h2 className="text-2xl font-bold font-display text-white mt-2">
                  {currentView === "login" ? "Verify Credentials" : "Initialize Account"}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  {currentView === "login" ? "Sign in to access your game consoles" : "Create standard profile for quick VPS grants"}
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-red-950/60 border border-red-500/30 rounded-xl text-red-200 text-xs flex items-center gap-2 mb-4 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={(e) => handleAuthSubmit(e, currentView as "login" | "signup")} className="space-y-4">
                
                {currentView === "signup" && (
                  <div>
                    <label id="lbl-username" className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                      CHOSEN USERNAME
                    </label>
                    <div className="relative">
                      <input
                        id="auth-username-input"
                        type="text"
                        required
                        placeholder="MineCrafter_Pro99"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        className="w-full bg-[#0a0a14] border border-indigo-950 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <UserIcon className="w-4 h-4 text-slate-600 absolute left-3.5 top-3" />
                    </div>
                  </div>
                )}

                <div>
                  <label id="lbl-email" className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                    EMAIL ADRESS
                  </label>
                  <div className="relative">
                    <input
                      id="auth-email-input"
                      type="email"
                      required
                      placeholder="alex@hdx-dash.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-[#0a0a14] border border-indigo-950 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label id="lbl-password" className="block text-xs font-medium text-slate-300 font-mono">
                      SECURE PASSWORD
                    </label>
                    {currentView === "login" && (
                      <button
                        id="forgot-pass-btn"
                        type="button"
                        onClick={() => showToast("Please reach out to an admin in our Discord for safety key resets.", "info")}
                        className="text-[10px] text-slate-500 hover:text-slate-300 hover:underline cursor-pointer"
                      >
                        Help?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password-input"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder={currentView === "login" ? "••••••••" : "Minimum 5 letters"}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-[#0a0a14] border border-indigo-950 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3" />
                    <button
                      id="toggle-pass-visibility-btn"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-600 hover:text-slate-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 mt-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-display shadow-lg shadow-indigo-500/10 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? "Synchronizing Credentials..." : currentView === "login" ? "Sign In Securely" : "Create Profile Base"}
                </button>
              </form>

              {/* Toggle views */}
              <div className="mt-5 text-center text-xs border-t border-indigo-950/40 pt-4">
                {currentView === "login" ? (
                  <p className="text-slate-400">
                    New with HDX?{" "}
                    <button
                      id="switch-signup-btn"
                      onClick={() => {
                        setFormError("");
                        setCurrentView("signup");
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                    >
                      Register Now
                    </button>
                  </p>
                ) : (
                  <p className="text-slate-400">
                    Already registered?{" "}
                    <button
                      id="switch-login-btn"
                      onClick={() => {
                        setFormError("");
                        setCurrentView("login");
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                    >
                      Login Here
                    </button>
                  </p>
                )}
              </div>

              {/* Google & Discord OAuth Login Buttons */}
              <div className="mt-6">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-indigo-950/40"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-mono tracking-widest uppercase">Or Continue With</span>
                  <div className="flex-grow border-t border-indigo-950/40"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <button
                    id="google-login-btn"
                    type="button"
                    onClick={handleGoogleOAuthLogin}
                    className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-900 border border-indigo-950 hover:bg-slate-800/80 hover:border-indigo-800 text-slate-200 hover:text-white flex flex-row items-center justify-center gap-2.5 transition cursor-pointer shadow-md shadow-black/20"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.16-4.53z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    Google login
                  </button>

                  <button
                    id="discord-login-btn"
                    type="button"
                    onClick={handleDiscordOAuthLogin}
                    className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#5865F2]/10 border border-[#5865F2]/30 hover:bg-[#5865F2]/20 hover:border-[#5865F2] text-[#e0e3ff] hover:text-white flex flex-row items-center justify-center gap-2.5 transition cursor-pointer shadow-md shadow-black/20"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 127.14 96.36" fill="currentColor">
                      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.48,6.83,77.19,77.19,0,0,0,49.18,0,105.15,105.15,0,0,0,18.74,8.07C-3.41,41.12-1,73.41,10.15,89.53a105.73,105.73,0,0,0,31.81,16.12,79.36,79.36,0,0,0,6.77-11A68.58,68.58,0,0,1,38.16,89.3c1,4.12,2,8.38,3.06,12.56a5.57,5.57,0,0,0,5.54,4.28c25.4-7.44,51.81-7.44,77.06,0a5.57,5.57,0,0,0,5.54-4.28c1.06-4.18,2.06-8.44,3.06-12.56a68.58,68.58,0,0,1-10.51,5.32,79.06,79.06,0,0,0,6.77,11,105.73,105.73,0,0,0,31.81-16.12C128.64,73.41,130.64,41.12,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5.12-12.69,11.45-12.69S53.91,46,53.91,53,48.78,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.29,60,73.29,53s5.12-12.69,11.45-12.69S96.19,46,96.19,53,91.06,65.69,84.69,65.69Z"/>
                    </svg>
                    Discord login
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =======================================================
            VIEW 3: USER DASHBOARD
         ======================================================= */}
        {currentView === "dashboard" && currentUser && (
          <div id="user-dashboard-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Cover Intro Section */}
            <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-950 via-[#0d0d21] to-[#04040d] border border-indigo-950/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none"></div>
              
              <div className="space-y-2 text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white">
                  Welcome to HDX-DASH, <span className="brand-text">{currentUser.username}</span>
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
                  Deploy premium Minecraft Server VPS containers instantly. Track server setups, credential links, and live configurations.
                </p>
                <div className="flex items-center gap-2 justify-center md:justify-start pt-1.5">
                  <span className="px-2.5 py-0.5 rounded bg-indigo-950/50 text-[10px] text-indigo-300 font-mono tracking-wider border border-indigo-950/30">
                    EMAIL ID: {currentUser.email}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-400 font-mono border border-slate-800">
                    UID: {currentUser.id.slice(0, 8)}...
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0">
                {activeUserRequest ? (
                  <div className="text-center p-3 rounded-xl bg-indigo-950/20 border border-indigo-950/50 text-xs text-slate-400">
                    ⚠️ Slot Occupied (1 Server limit)
                  </div>
                ) : (
                  <a
                    id="dashboard-cta-create-server-btn"
                    href="#create-server-form"
                    className="px-6 py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/10 flex items-center gap-2 transition duration-200"
                  >
                    <Plus className="w-4 h-4 text-white" /> Request Server Instance
                  </a>
                )}
              </div>
            </div>

            {/* Main Dashboard Layout Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT: Live Server Node (Requested servers list) */}
              <div className="lg:col-span-8 space-y-6">
                
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-400" /> Requested Servers Status
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">1 Allowed per account</span>
                </div>

                {loadingRequests ? (
                  <div className="p-12 glass-panel rounded-2xl text-center">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <span className="text-xs text-slate-400 font-mono">RETRIEVING SERVER CONFIGURATIONS...</span>
                  </div>
                ) : requests.length === 0 ? (
                  <div className="glass-panel p-10 rounded-2xl text-center border-dashed border-indigo-950/60">
                    <div className="w-12 h-12 rounded-xl bg-indigo-950/40 flex items-center justify-center text-indigo-400 mx-auto mb-4">
                      <HelpCircle className="w-6 h-6 animate-bounce" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-1">No Server Request Created</h4>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto mb-5">
                      You do not have any registered active or completed server requests. Claim yours below by choosing a plan spec.
                    </p>
                    <a
                      id="empty-state-cta-btn"
                      href="#create-server-form"
                      className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-semibold transition inline-block cursor-pointer shadow-lg shadow-indigo-500/15"
                    >
                      Provision First Server Slot
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((req) => {
                      const isPending = req.status === "pending";
                      const isApproved = req.status === "approved";
                      const isRejected = req.status === "rejected";
                      const isCancelled = req.status === "cancelled";

                      return (
                        <div
                          key={req.id}
                          className={`glass-panel rounded-2xl p-5 border relative transition duration-300 ${
                            isPending
                              ? "border-amber-500/30 shadow-md shadow-amber-950/10"
                              : isApproved
                              ? "border-emerald-500/30 shadow-md shadow-emerald-950/10"
                              : isRejected
                              ? "border-rose-500/30 bg-rose-950/5"
                              : "border-slate-800"
                          }`}
                        >
                          
                          {/* Heading summary and badges */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-950/40 pb-4 mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">SERVER ALLOCATION</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-indigo-400 bg-indigo-950/40">
                                  {req.location} Server
                                </span>
                              </div>
                              <h4 className="text-base font-bold text-white mt-1 font-display">{req.planName}</h4>
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center gap-2">
                              {isPending && (
                                <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 animate-spin" /> Pending Approval
                                </span>
                              )}
                              {isApproved && (
                                <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Approved
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-rose-300 border border-red-500/30 flex items-center gap-1.5">
                                  <XCircle className="w-3.5 h-3.5 text-rose-400" /> Rejected
                                </span>
                              )}
                              {isCancelled && (
                                <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                                  <XCircle className="w-3.5 h-3.5 text-slate-400" /> Cancelled
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Specifications parameters detail specs */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#0a0a14] p-3 rounded-xl border border-indigo-950/30 mb-4 text-xs">
                            <div>
                              <span className="block text-[10px] text-slate-500 font-mono">CPU SPEC</span>
                              <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                                <Cpu className="w-3.5 h-3.5 text-indigo-300" /> {req.cpu} ({req.cpuType})
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-500 font-mono">MEMORY ALLOCATION</span>
                              <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                                <Layers className="w-3.5 h-3.5 text-purple-300" /> {req.ram} ({req.ramType})
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-500 font-mono">NVME STORAGE</span>
                              <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                                <Database className="w-3.5 h-3.5 text-blue-300" /> {req.disk} ({req.diskType})
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-500 font-mono">ROUTING SYSTEM</span>
                              <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                                <Globe className="w-3.5 h-3.5 text-emerald-300" /> {req.location}
                              </span>
                            </div>
                          </div>

                          {/* Unique Client Access Token */}
                          <div className="flex items-center justify-between gap-3 bg-[#0c0c1b]/90 border border-indigo-950/40 p-3 rounded-lg mb-4 text-xs font-mono">
                            <div className="truncate">
                              <span className="text-slate-500 block text-[10px] mb-0.5 select-none">UNIQUE SYSTEM TOKEN</span>
                              <span className="text-indigo-300">{req.token}</span>
                            </div>
                            <button
                              id={`copy-token-${req.id}-btn`}
                              onClick={() => copyToClipboard(req.token, req.id)}
                              className="p-1 px-2 bg-indigo-950/40 text-indigo-300 hover:text-indigo-100 rounded-md transition border border-indigo-500/20"
                            >
                              {copiedTokenId === req.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {/* ADMIN RESPONSE / NOTE PANEL DETAILS */}
                          {isApproved && (
                            <div className="p-4 bg-emerald-950/20 border border-emerald-500/25 rounded-xl space-y-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                                <span className="text-xs font-bold font-display text-emerald-200">Panel Access Credentials Granted</span>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                                {req.panelLink && (
                                  <div className="p-2 bg-slate-950/80 rounded border border-indigo-950/30">
                                    <span className="block text-[10px] text-slate-500 font-mono">CONTROL URL</span>
                                    <a
                                      id={`open-panel-link-${req.id}`}
                                      href={req.panelLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-400 hover:underline flex items-center gap-1 mt-0.5 truncate font-semibold"
                                    >
                                      Go to Panel <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    </a>
                                  </div>
                                )}
                                {req.panelEmail && (
                                  <div className="p-2 bg-slate-950/80 rounded border border-indigo-950/30">
                                    <span className="block text-[10px] text-slate-500 font-mono">EMAIL USERNAME</span>
                                    <span className="text-white font-mono break-all font-semibold select-all">{req.panelEmail}</span>
                                  </div>
                                )}
                                {req.panelPassword && (
                                  <div className="p-2 bg-slate-950/80 rounded border border-indigo-950/30">
                                    <span className="block text-[10px] text-slate-500 font-mono">PASSWORD</span>
                                    <span className="text-white font-mono break-all font-semibold select-all">{req.panelPassword}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {isRejected && req.adminNote && (
                            <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs">
                              <span className="text-[#fca5a5] font-semibold font-mono block mb-1">REJECTION CAUSE FROM ADMIN</span>
                              <p className="text-slate-300 leading-relaxed italic">"{req.adminNote}"</p>
                            </div>
                          )}

                          {isPending && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
                              <span className="text-amber-300 font-mono italic animate-pulse">
                                ⏳ High queues! Our admin is working to build this slot.
                              </span>
                              <button
                                id={`cancel-request-${req.id}-btn`}
                                onClick={() => handleCancelRequest(req.id)}
                                className="w-full sm:w-auto px-4 py-1.5 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-300 border border-slate-800 transition py-2"
                              >
                                Cancel Pending Request
                              </button>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

                {/* =======================================================
                    VIEW 4: CREATE SERVER FLOW (Form embed within user dashboard for flawless flow)
                 ======================================================= */}
                <div id="create-server-form" className="scroll-mt-28">
                  <div className="glass-panel p-6 rounded-2xl border border-indigo-950/60 relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Plus className="w-32 h-32 text-indigo-400" />
                    </div>

                    <div className="mb-6">
                      <span className="text-indigo-400 font-mono text-[10px] tracking-widest uppercase">SLOT ALLOCATION WORKFLOW</span>
                      <h3 className="text-xl font-bold font-display text-white mt-1">Configure & Claim Minecraft Server Model</h3>
                      <p className="text-slate-400 text-xs mt-1">
                        Select an allocation size. Based on performance specs, geographical host location and CPU drivers will adjust automatically.
                      </p>
                    </div>

                    {/* Step 1: Selector plan cards */}
                    <div className="space-y-3 mb-6">
                      <label className="block text-xs font-semibold text-slate-300 tracking-wider font-mono">
                        STEP 1: SELECT SPECIFICATION LEVEL
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SERVER_PLANS.map((plan) => {
                          const isSelected = selectedPlanId === plan.id;
                          return (
                            <button
                              id={`select-srv-plan-${plan.id}-btn`}
                              key={plan.id}
                              onClick={() => setSelectedPlanId(plan.id)}
                              disabled={!!activeUserRequest}
                              className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/50"
                                  : "bg-[#090915]/60 border-indigo-950/60 hover:border-indigo-900/60 hover:bg-slate-950/40"
                              } ${activeUserRequest ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[10px] font-mono ${isSelected ? "text-indigo-400" : "text-slate-500"}`}>
                                  {plan.perf} ALLOCATION
                                </span>
                                {isSelected && <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>}
                              </div>
                              <h5 className="font-bold text-white text-sm">{plan.name}</h5>
                              <p className="text-[11px] text-slate-400 mt-1 mb-2 leading-relaxed italic">
                                {plan.desc}
                              </p>
                              <div className="flex items-center justify-between text-[11px] font-mono border-t border-indigo-950/30 pt-2 text-slate-500">
                                <span>CPU: {plan.cpu}</span>
                                <span>RAM: {plan.ram}</span>
                                <span className="text-white font-semibold">{plan.price}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Auto-filled Configuration details viewer */}
                    <div className="bg-[#0c0c1c] p-4 rounded-xl border border-indigo-950/80 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 font-mono tracking-wider">
                          STEP 2: AUTO-RESOLVING NODE CALCULATIONS
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                        <div>
                          <span className="block text-[10px] text-slate-500">RESOLVED REGION</span>
                          <span className="text-white font-semibold mt-0.5 block">
                            {getPlanDetails(selectedPlanId).location === "Asia" ? "Asia (Singapore)" : "India Base"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">CPU CHIPSET</span>
                          <span className="text-white font-semibold mt-0.5 block">
                            {getPlanDetails(selectedPlanId).cpuType} Processors
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">MEMORY DRIVERS</span>
                          <span className="text-white font-semibold mt-0.5 block">
                            {getPlanDetails(selectedPlanId).ramType} Specs
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">STORAGE DRIVES</span>
                          <span className="text-white font-semibold mt-0.5 block">
                            NVMe {getPlanDetails(selectedPlanId).diskType}
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 mt-3 leading-relaxed border-t border-indigo-950/30 pt-2 select-none">
                        💡 <strong>Hosting Policy Code Rule:</strong> Auto-allocates AMD processors + DDR4 + Singapore hub regions for maximum specification values (3 Core and higher) to guarantee flawless TPS performance. Low specs route to India INTEL pools.
                      </p>
                    </div>

                    {/* Step 3: Actionable Submit/Launch request */}
                    <div>
                      {activeUserRequest ? (
                        <div className="p-4 bg-yellow-950/20 border border-yellow-500/20 rounded-xl text-xs text-yellow-300 leading-relaxed">
                          ⚠️ <strong>Single request block active:</strong> You already have a pending or active approved server instance. In order to request a different plan size, please cancel your pending request, or contact admin if you need to shut down an active server.
                        </div>
                      ) : (
                        <button
                          id="submit-provisioning-btn"
                          onClick={handleCreateServerSubmit}
                          disabled={creatingServer}
                          className="w-full py-3.5 rounded-xl font-display font-semibold text-xs tracking-wider uppercase bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl hover:from-blue-500 hover:to-indigo-500 transition cursor-pointer disabled:opacity-50"
                        >
                          {creatingServer ? "Provisioning unique tokens & saving specs..." : "SUBMIT SLOT REQUEST TO ADMIN"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT SIDEBAR: Guidelines / Quick Faqs & Discord */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Visual hardware widget status */}
                <div className="glass-panel p-5 rounded-2xl border border-indigo-950/60 relative overflow-hidden">
                  <div className="absolute top-1/2 -right-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                  
                  <h4 className="text-sm font-bold font-display text-white mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" /> Infrastructure Status
                  </h4>

                  <ul className="space-y-3.5 text-xs">
                    <li className="flex items-center justify-between border-b border-indigo-950/30 pb-2">
                      <span className="text-slate-400">Singapore SG-Node1</span>
                      <span className="text-emerald-400 font-semibold font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                      </span>
                    </li>
                    <li className="flex items-center justify-between border-b border-indigo-950/30 pb-2">
                      <span className="text-slate-400">India IN-Node2</span>
                      <span className="text-emerald-400 font-semibold font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                      </span>
                    </li>
                    <li className="flex items-center justify-between border-b border-indigo-950/30 pb-2">
                      <span className="text-slate-400">Pterodactyl Daemon Sync</span>
                      <span className="text-emerald-400 font-semibold font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
                      </span>
                    </li>
                    <li className="flex items-center justify-between pb-1">
                      <span className="text-slate-400">Active Allocations</span>
                      <span className="text-slate-300 font-mono font-semibold">124 Slots Reserved</span>
                    </li>
                  </ul>
                </div>

                {/* Account details faq section */}
                <div className="glass-panel p-5 rounded-2xl border border-indigo-950/60">
                  <h4 className="text-sm font-bold font-display text-white mb-2">Frequently Asked Questons</h4>
                  
                  <div className="space-y-4 text-xs pt-1.5">
                    <div>
                      <p className="font-semibold text-slate-300">How long does approval take?</p>
                      <p className="text-slate-400 leading-relaxed mt-1">
                        Normal reviews complete within 1-6 hours. Notifications are pushed instantly to your dashboard tray once approval is written.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-300">Where can I see login password details?</p>
                      <p className="text-slate-400 leading-relaxed mt-1">
                        Right on this dashboard! Clicking "Go to Panel" will direct you to control interfaces using the approved credentials.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-300">My server is locked. Why?</p>
                      <p className="text-slate-400 leading-relaxed mt-1">
                        We have a strict 1 active node quota per player account. Cancel an outdated one to claim a higher size.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Discord banner widget */}
                <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 relative overflow-hidden text-center">
                  <span className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase block mb-1">NEED URGENT APPROVAL?</span>
                  <h4 className="text-sm font-bold text-white mb-2">Speak directly with Game Admin</h4>
                  <p className="text-slate-400 text-xs leading-relaxed mb-4">
                    Ping our staff on Discord. Provide your request token to request rapid VPS deployment.
                  </p>
                  <a
                    id="sidebar-discord-btn"
                    href="https://discord.gg/fSZ9XXSa3w"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-block py-2 rounded-xl text-center text-xs font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white transition tracking-wide shadow"
                  >
                    Join Discord Channel
                  </a>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* =======================================================
            VIEW 5: ADMIN PORTAL
         ======================================================= */}
        {currentView === "admin" && currentUser && currentUser.role === "admin" && (
          <div id="admin-portal-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Admin Overview Header and general notification text */}
            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-slate-950 to-purple-950/40 border border-purple-900/40 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-1.5 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-900/40 border border-purple-500/30 text-[11px] text-purple-300 font-semibold font-mono uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" /> SECURE ADMIN CORE ACTIVE
                </div>
                <h2 className="text-2xl font-extrabold font-display text-white">
                  Server Allocation Console
                </h2>
                <p className="text-slate-400 text-xs">
                  Acknowledge, reject, or provision requested user Minecraft VPS slots instantly and record response credentials.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  id="admin-reload-btn"
                  onClick={loadAdminDashboard}
                  className="px-4 py-2 bg-slate-900 border border-indigo-950/60 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" /> Refresh Lists
                </button>
              </div>
            </div>

            {/* Analytical numbers banner */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
              
              <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-indigo-500">
                <span className="block text-[10px] text-slate-500 font-mono tracking-wider">TOTAL ACTIVE REQUESTS</span>
                <span className="text-2xl font-bold font-mono text-white block mt-1">{adminStats.total}</span>
              </div>

              <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-amber-500">
                <span className="block text-[10px] text-slate-500 font-mono tracking-wider">PENDING VERIFICATION</span>
                <span className="text-2xl font-bold font-mono text-amber-400 block mt-1">{adminStats.pending}</span>
              </div>

              <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-emerald-500">
                <span className="block text-[10px] text-slate-500 font-mono tracking-wider">APPROVED SLOTS</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 block mt-1">{adminStats.approved}</span>
              </div>

              <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-red-500">
                <span className="block text-[10px] text-slate-500 font-mono tracking-wider">REJECTED OFFERS</span>
                <span className="text-2xl font-bold font-mono text-red-400 block mt-1">{adminStats.rejected}</span>
              </div>

              <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-slate-500">
                <span className="block text-[10px] text-slate-500 font-mono tracking-wider">CANCELLED SLOTS</span>
                <span className="text-2xl font-bold font-mono text-slate-400 block mt-1">{adminStats.cancelled}</span>
              </div>

              <div className="glass-panel p-4 rounded-xl text-center border-l-2 border-purple-500">
                <span className="block text-[10px] text-slate-500 font-mono tracking-wider">REGISTERED USERS</span>
                <span className="text-2xl font-bold font-mono text-purple-400 block mt-1">{adminStats.totalUsers}</span>
              </div>

            </div>

            {/* Admin Grid layout: List + Credentials editor form details */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT: Requests List with filter selectors */}
              <div className="lg:col-span-7 space-y-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a0a14] p-3 rounded-xl border border-indigo-950/60">
                  <span className="text-xs font-semibold text-slate-300 font-mono">SELECT FILTER BADGE</span>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: "all", label: "All Items" },
                      { key: "pending", label: "⌛ Pending" },
                      { key: "approved", label: "✅ Approved" },
                      { key: "rejected", label: "❌ Rejected" },
                      { key: "cancelled", label: "🔘 Cancelled" }
                    ].map((filt) => (
                      <button
                        id={`admin-filter-${filt.key}-btn`}
                        key={filt.key}
                        onClick={() => setAdminStatusFilter(filt.key)}
                        className={`px-3 py-1 text-xs rounded-lg transition font-medium cursor-pointer ${
                          adminStatusFilter === filt.key
                            ? "bg-purple-900/40 text-purple-200 border border-purple-500/30"
                            : "text-slate-400 hover:text-white bg-slate-900/40"
                        }`}
                      >
                        {filt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingAdminData ? (
                  <div className="p-12 glass-panel text-center rounded-2xl">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <span className="text-xs text-slate-400 font-mono">COMMUNICATING DATABASE SCHEMA RECORDSETS...</span>
                  </div>
                ) : adminRequests.length === 0 ? (
                  <div className="p-12 glass-panel text-center rounded-2xl border-dashed border-indigo-950">
                    <span className="text-xs text-slate-500">No requests match this filter condition.</span>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {adminRequests.map((req) => {
                      const isSelected = selectedAdminRequest?.id === req.id;
                      return (
                        <div
                          key={req.id}
                          onClick={() => handleAdminSelectRequest(req)}
                          className={`glass-panel p-4 rounded-xl border transition-all duration-250 cursor-pointer text-left relative ${
                            isSelected
                              ? "border-purple-500 bg-purple-950/10 shadow-lg shadow-purple-950/20"
                              : "border-indigo-950/40 hover:border-indigo-900 hover:bg-slate-950/20"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white font-display">User: {req.username}</span>
                              <span className="text-slate-500 font-mono">({req.email})</span>
                            </div>
                            <span className="text-[10px] text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                          </div>

                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-bold text-white text-sm">{req.planName}</h5>
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider uppercase ${
                                req.status === "pending"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : req.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : req.status === "rejected"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>

                          <div className="flex gap-4 text-[11px] font-mono text-slate-400 mb-2">
                            <span>CPU: <strong className="text-white">{req.cpu}</strong></span>
                            <span>RAM: <strong className="text-white">{req.ram}</strong></span>
                            <span>Region: <strong className="text-indigo-400">{req.location}</strong></span>
                          </div>

                          <div className="text-[10px] bg-[#0c0c1b] p-2 rounded text-slate-500 truncate font-mono select-none">
                            TOKEN: <span className="text-slate-300">{req.token}</span>
                          </div>

                          {isSelected && (
                            <div className="absolute right-3 bottom-3 text-purple-400 font-semibold font-mono text-[10px] animate-pulse">
                              ACTIF SELECTION ✨
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* RIGHT: Selected request detail action panel */}
              <div className="lg:col-span-5">
                {selectedAdminRequest ? (
                  <div className="glass-panel p-5 rounded-2xl border border-purple-900/60 relative">
                    
                    <div className="border-b border-indigo-950/40 pb-4 mb-4">
                      <span className="text-[10px] text-purple-400 font-mono tracking-widest uppercase font-bold block">GRANTS & STATUS CONTROL</span>
                      <h4 className="text-base font-bold text-white mt-1 font-display">Manage server grant</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Formulate responses for <strong>{selectedAdminRequest.username}</strong> request token.
                      </p>
                    </div>

                    <div className="space-y-4 mb-6">
                      
                      {/* Read-Only metadata values */}
                      <div className="p-3 bg-[#0a0a14] rounded-xl border border-indigo-950/60 text-xs text-slate-400 space-y-1">
                        <p><strong>Config Requested:</strong> {selectedAdminRequest.planName}</p>
                        <p><strong>Hardware Type:</strong> {selectedAdminRequest.cpuType} | NVMe {selectedAdminRequest.diskType}</p>
                        <p><strong>Geographic Target:</strong> {selectedAdminRequest.location}</p>
                        <p><strong>Database ID Key:</strong> {selectedAdminRequest.id}</p>
                      </div>

                      <div className="space-y-3.5 pt-2 border-t border-indigo-950/40">
                        <span className="text-xs font-semibold text-slate-300 font-mono block">
                          IF APPROVING: FILL IN PANEL CREDENTIALS
                        </span>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1 font-mono">PANEL URL LINK</label>
                          <input
                            id="admin-panel-link-input"
                            type="text"
                            placeholder="https://panel.hdx-dash.com/server/98ae03a"
                            value={panelLink}
                            onChange={(e) => setPanelLink(e.target.value)}
                            className="w-full bg-[#0a0a14] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-mono">PANEL LOGIN EMAIL</label>
                            <input
                              id="admin-panel-email-input"
                              type="text"
                              placeholder="skama5377@gmail.com"
                              value={panelEmail}
                              onChange={(e) => setPanelEmail(e.target.value)}
                              className="w-full bg-[#0a0a14] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-mono">PANEL KEY PASSWORD</label>
                            <input
                              id="admin-panel-pass-input"
                              type="text"
                              placeholder="mypass-key-1"
                              value={panelPassword}
                              onChange={(e) => setPanelPassword(e.target.value)}
                              className="w-full bg-[#0a0a14] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                          ADMIN EXPLANATORY NOTE / REJECTION REASON
                        </label>
                        <textarea
                          id="admin-note-input"
                          rows={2}
                          placeholder="Provide details of your action or general greeting message for approval notification."
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          className="w-full bg-[#0a0a14] border border-indigo-950 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-purple-500 resize-none"
                        ></textarea>
                      </div>

                    </div>

                    {/* Action buttons triggers */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          id="btn-approve-request"
                          onClick={() => handleAdminUpdateStatus("approved")}
                          disabled={adminActionLoading}
                          className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
                        >
                          Approve Server
                        </button>
                        <button
                          id="btn-reject-request"
                          onClick={() => handleAdminUpdateStatus("rejected")}
                          disabled={adminActionLoading}
                          className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
                        >
                          Reject Request
                        </button>
                      </div>
                      
                      <button
                        id="btn-cancel-request"
                        onClick={() => handleAdminUpdateStatus("cancelled")}
                        disabled={adminActionLoading}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-indigo-950/60 transition disabled:opacity-50 cursor-pointer"
                      >
                        Cancel Request & Note Owner
                      </button>

                      <button
                        id="btn-reset-selection"
                        onClick={() => setSelectedAdminRequest(null)}
                        className="w-full py-1 text-slate-500 hover:text-slate-300 text-[10px] font-medium block text-center"
                      >
                        Dismiss Selection Detail
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="glass-panel p-8 text-center rounded-2xl border-dashed border-indigo-950/60">
                    <p className="text-xs text-slate-500">
                      Select a user server request from the list to manage. Approved plans will automatically send live panel links and trigger updates.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* FOOTER ACCENTS */}
      <footer className="border-t border-indigo-950/40 bg-[#04040a]/80 py-8 relative z-10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            
            <div className="text-center sm:text-left space-y-1">
              <span className="font-bold text-white font-display">
                HDX-<span className="brand-text">DASH</span>
              </span>
              <p className="text-slate-500 text-[11px]">
                © 2026 HDX Mining Hosting Core. Unofficial Minecraft platform companion.
              </p>
            </div>

            <div className="flex items-center gap-6 text-slate-400 font-mono text-[10px]">
              <a
                id="footer-discord-link"
                href="https://discord.gg/fSZ9XXSa3w"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-indigo-400 transition underline decoration-indigo-500/40 underline-offset-4"
              >
                Discord Server
              </a>
              <span className="text-slate-700">|</span>
              <span className="text-slate-500">Status: Nodes fully operational</span>
              <span className="text-slate-700">|</span>
              <button
                id="footer-back-to-top"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="hover:text-white transition uppercase font-semibold text-[9px]"
              >
                Back to top ▲
              </button>
            </div>

          </div>
        </div>
      </footer>

    </div>
  );
}
