import { AuthResponse, User, ServerRequest, Notification } from "./types";

let sessionToken = localStorage.getItem("hdx_session_token") || null;

export function getSessionToken(): string | null {
  return sessionToken;
}

export function setSessionToken(token: string | null) {
  sessionToken = token;
  if (token) {
    localStorage.setItem("hdx_session_token", token);
  } else {
    localStorage.removeItem("hdx_session_token");
  }
}

// Global handle for API fetching
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }
  
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `HTTP ${response.status}: Failed to perform request`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// Auth API calls
export async function signup(username: string, email: string, passwordPlain: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password: passwordPlain }),
  });
  setSessionToken(data.token);
  return data;
}

export async function login(email: string, passwordPlain: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: passwordPlain }),
  });
  setSessionToken(data.token);
  return data;
}

export async function checkMe(): Promise<User> {
  try {
    const data = await apiFetch<{ user: User }>("/api/auth/me");
    return data.user;
  } catch (err) {
    setSessionToken(null);
    throw err;
  }
}

export function logout() {
  setSessionToken(null);
}

// User Portal calls
export async function fetchUserRequests(): Promise<ServerRequest[]> {
  const data = await apiFetch<{ requests: ServerRequest[] }>("/api/user/requests");
  return data.requests;
}

export async function createServerRequest(requestData: {
  planName: string;
  cpu: string;
  ram: string;
  disk: string;
  location: "Asia" | "India";
  cpuType: "AMD" | "INTEL";
  ramType: "DDR3" | "DDR4";
  diskType: "Gen 3" | "Gen 4";
}): Promise<ServerRequest> {
  const data = await apiFetch<{ request: ServerRequest }>("/api/user/requests", {
    method: "POST",
    body: JSON.stringify(requestData),
  });
  return data.request;
}

export async function cancelServerRequest(id: string): Promise<ServerRequest> {
  const data = await apiFetch<{ request: ServerRequest }>(`/api/user/requests/${id}/cancel`, {
    method: "POST",
  });
  return data.request;
}

export async function fetchUserNotifications(): Promise<Notification[]> {
  const data = await apiFetch<{ notifications: Notification[] }>("/api/user/notifications");
  return data.notifications;
}

export async function markNotificationsAsRead(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/api/user/notifications/read", {
    method: "POST",
  });
}

export async function markSingleNotificationAsRead(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/user/notifications/${id}/read`, {
    method: "POST",
  });
}

// Admin Portal calls
export interface AdminRequestExtended extends ServerRequest {
  username: string;
  email: string;
}

export async function adminFetchRequests(statusFilter: string = "all"): Promise<AdminRequestExtended[]> {
  const data = await apiFetch<{ requests: AdminRequestExtended[] }>(`/api/admin/requests?status=${statusFilter}`);
  return data.requests;
}

export async function adminUpdateStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  totalUsers: number;
}> {
  return apiFetch<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    totalUsers: number;
  }>("/api/admin/stats");
}

export async function adminUpdateStatus(
  id: string,
  payload: {
    status: string;
    panelLink?: string;
    panelEmail?: string;
    panelPassword?: string;
    adminNote?: string;
  }
): Promise<ServerRequest> {
  const data = await apiFetch<{ request: ServerRequest }>(`/api/admin/requests/${id}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.request;
}
