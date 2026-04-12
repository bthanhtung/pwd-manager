// lib/api.ts
import { auth } from "./auth";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ---- Types ----
export interface LoginPayload {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
}

export interface VaultEntry {
  _id: string;
  title: string;
  encryptedData: string;
  iv: string;
  tag: string;
  ownerId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaultPayload {
  title: string;
  plainTextValue: string;
  groupId?: string;
}

// ---- Base fetch ----
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = auth.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Auth ----
export const authApi = {
  login: (payload: LoginPayload) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  register: (payload: LoginPayload) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ---- Vault ----
export const vaultApi = {
  list: () => apiFetch<VaultEntry[]>("/vault"),

  create: (payload: CreateVaultPayload) =>
    apiFetch<VaultEntry>("/vault", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
