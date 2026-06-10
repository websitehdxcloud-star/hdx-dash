export type UserRole = "user" | "admin";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export type ServerRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ServerRequest {
  id: string;
  userId: string;
  planName: string;
  cpu: string;
  ram: string;
  disk: string;
  location: "Asia" | "India";
  cpuType: "AMD" | "INTEL";
  ramType: "DDR3" | "DDR4";
  diskType: "Gen 3" | "Gen 4";
  token: string;
  status: ServerRequestStatus;
  panelLink?: string;
  panelEmail?: string;
  panelPassword?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
