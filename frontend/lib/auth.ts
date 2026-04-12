// lib/auth.ts
const TOKEN_KEY = "pm_access_token";

export const auth = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
  isLoggedIn(): boolean {
    return !!auth.getToken();
  },
};
