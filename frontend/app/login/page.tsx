"use client";

import { useState, FormEvent } from "react";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
import { authApi } from "../../lib/api";
import { useAuth } from "../../lib/hooks/useAuth";

type Tab = "login" | "register";

export default function LoginPage() {
  const { login } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fn = tab === "login" ? authApi.login : authApi.register;
      const res = await fn({ username, password });
      login(res.access_token, username);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
    setUsername("");
    setPassword("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        className="animate-scale-in"
        style={{ width: "100%", maxWidth: "400px" }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: "var(--accent)",
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(0, 113, 227, 0.3)",
            }}
          >
            <ShieldCheck size={32} color="#fff" strokeWidth={1.8} />
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Open Pass
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              marginTop: 6,
              margin: "6px 0 0",
            }}
          >
            Your secure password manager
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px" }}>
          {/* Tab Switcher */}
          <div
            style={{
              display: "flex",
              background: "var(--bg-primary)",
              borderRadius: 10,
              padding: 3,
              marginBottom: 28,
              position: "relative",
            }}
          >
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s ease",
                  background: tab === t ? "var(--bg-secondary)" : "transparent",
                  color:
                    tab === t ? "var(--text-primary)" : "var(--text-secondary)",
                  boxShadow: tab === t ? "var(--shadow-sm)" : "none",
                  letterSpacing: "-0.01em",
                }}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div
              className="animate-fade-in"
              style={{
                background: "rgba(255, 59, 48, 0.08)",
                border: "1px solid rgba(255, 59, 48, 0.2)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13.5,
                color: "var(--danger)",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>⚠️</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 7,
                  letterSpacing: "-0.01em",
                }}
              >
                Username
              </label>
              <input
                className="input-apple"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={4}
                maxLength={20}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 7,
                  letterSpacing: "-0.01em",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="input-apple"
                  type={showPassword ? "text" : "password"}
                  placeholder={tab === "register" ? "At least 8 characters" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "var(--text-secondary)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "var(--text-tertiary)")
                  }
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? (
                <Loader2 size={18} style={{ animation: "spin 0.7s linear infinite" }} />
              ) : null}
              {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 12.5,
            color: "var(--text-tertiary)",
            marginTop: 24,
          }}
        >
          Your data is encrypted with AES-256-GCM
        </p>
      </div>
    </div>
  );
}
