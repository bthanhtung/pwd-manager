"use client";

import { ShieldCheck, LogOut, User } from "lucide-react";
import { useAuth } from "../../lib/hooks/useAuth";

export default function Sidebar() {
  const { username, logout } = useAuth();

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "28px 24px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 38,
              height: 38,
              background: "var(--accent)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,113,227,0.25)",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={20} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Open Pass
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--text-tertiary)",
                letterSpacing: "-0.01em",
              }}
            >
              Password Manager
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--accent-light)",
            color: "var(--accent)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "default",
            letterSpacing: "-0.01em",
          }}
        >
          <ShieldCheck size={16} strokeWidth={2} />
          Vault
        </div>
      </nav>

      {/* User / Logout */}
      <div
        style={{
          padding: "16px 12px",
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* User info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 50,
              background: "var(--bg-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <User size={16} color="var(--text-secondary)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "-0.01em",
              }}
            >
              {username || "User"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
              Personal vault
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="btn-ghost"
          style={{
            width: "100%",
            justifyContent: "flex-start",
            padding: "9px 12px",
            borderRadius: 10,
            fontSize: 13.5,
            gap: 9,
            color: "var(--danger)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,59,48,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
