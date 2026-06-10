import React, { useState, useEffect } from "react";
import { Server, LogOut, Bell, LogIn, User as UserIcon, Shield, ChevronDown, Check } from "lucide-react";
import { User, Notification } from "../types";
import { fetchUserNotifications, markNotificationsAsRead, logout } from "../api";

interface NavbarProps {
  currentUser: User | null;
  onNavigate: (view: "landing" | "login" | "signup" | "dashboard" | "admin") => void;
  currentView: string;
  onLogout: () => void;
  // A helper to trigger a refresh of notifications from parents
  notificationTrigger: number;
}

export default function Navbar({ currentUser, onNavigate, currentView, onLogout, notificationTrigger }: NavbarProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUserNotifications()
        .then((data) => setNotifications(data))
        .catch((err) => console.error("Error loading notifications:", err));
    } else {
      setNotifications([]);
    }
  }, [currentUser, notificationTrigger]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header
      id="main-header"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#090915]/95 backdrop-blur-md border-b border-indigo-950/50 py-3 shadow-lg" : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Logo Brand Accent */}
          <button
            id="brand-logo-btn"
            onClick={() => onNavigate("landing")}
            className="flex items-center gap-3 cursor-pointer group transition"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 duration-200">
              <Server className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center">
              HDX-<span className="brand-text">DASH</span>
            </span>
          </button>

          {/* Navigation Controls */}
          <nav id="navbar-navigation" className="flex items-center gap-2 sm:gap-4">
            
            {currentUser ? (
              <>
                {currentUser.role === "admin" && (
                  <button
                    id="nav-admin-btn"
                    onClick={() => onNavigate("admin")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                      currentView === "admin"
                        ? "bg-purple-950/60 text-purple-200 border border-purple-500/30"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    <Shield className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span className="hidden sm:inline">Admin Portal</span>
                  </button>
                )}

                <button
                  id="nav-user-dash-btn"
                  onClick={() => onNavigate("dashboard")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    currentView === "dashboard"
                      ? "bg-indigo-950/60 text-indigo-200 border border-indigo-500/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/40"
                  }`}
                >
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span className="hidden sm:inline">My Servers</span>
                  <span className="sm:hidden">Dashboard</span>
                </button>

                {/* Notifications Menu Trigger */}
                <div className="relative inline-block text-left">
                  <button
                    id="nav-notif-bell-btn"
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="p-2 relative rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full ring-2 ring-[#07070d]"></span>
                    )}
                  </button>

                  {showNotifMenu && (
                    <div
                      id="notifications-tray"
                      className="absolute right-0 mt-3 w-80 sm:w-96 rounded-xl border border-indigo-950/70 bg-[#090916] shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden"
                    >
                      <div className="p-3 bg-[#0d0d21] border-b border-indigo-950/60 flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-200">Notifications ({unreadCount} unread)</span>
                        {unreadCount > 0 && (
                          <button
                            id="notif-mark-read-btn"
                            onClick={handleMarkAllRead}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-indigo-950/40">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 text-xs">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`p-3 text-xs transition duration-150 ${
                                n.read ? "bg-transparent text-slate-400" : "bg-indigo-950/20 text-slate-200"
                              }`}
                            >
                              <p className="leading-relaxed">{n.message}</p>
                              <span className="block mt-1 text-[10px] text-slate-500">
                                {new Date(n.createdAt).toLocaleDateString()} at{" "}
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-2 bg-[#080812] border-t border-indigo-950/30 text-center">
                        <button
                          id="close-notif-tray-btn"
                          onClick={() => setShowNotifMenu(false)}
                          className="text-[11px] text-slate-500 hover:text-slate-300 font-medium py-1 w-full"
                        >
                          Close Panel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Dropdown identifier */}
                <div className="flex items-center gap-2 border-l border-indigo-950/50 pl-3">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                      {currentUser.username}
                    </span>
                    <span className="text-[10px] text-indigo-400 font-mono tracking-wider uppercase">
                      {currentUser.role}
                    </span>
                  </div>
                  <button
                    id="nav-logout-btn"
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-pink-400 hover:bg-pink-950/10 rounded-lg transition"
                    title="Log Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  id="nav-login-btn"
                  onClick={() => onNavigate("login")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    currentView === "login"
                      ? "text-white bg-indigo-950/40"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Login
                </button>
                <button
                  id="nav-register-btn"
                  onClick={() => onNavigate("signup")}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-500 hover:to-indigo-500 transition shadow-indigo-500/10 hover:shadow-indigo-500/20 cursor-pointer"
                >
                  Create Server
                </button>
              </>
            )}

          </nav>

        </div>
      </div>
    </header>
  );
}
