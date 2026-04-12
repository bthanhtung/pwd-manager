"use client";

import { useState } from "react";
import { Copy, Check, Globe, Key } from "lucide-react";
import type { VaultEntry } from "../../lib/api";

interface VaultCardProps {
  entry: VaultEntry;
  index: number;
}

// Simple color palette for avatar icons (cycles)
const COLORS = [
  { bg: "#e8f0fb", icon: "#0071e3" },
  { bg: "#fce8e6", icon: "#ff3b30" },
  { bg: "#e6f9ee", icon: "#30d158" },
  { bg: "#fff8e1", icon: "#ff9f0a" },
  { bg: "#f3e8ff", icon: "#bf5af2" },
  { bg: "#e8f5fb", icon: "#32ade6" },
];

export default function VaultCard({ entry, index }: VaultCardProps) {
  const [copied, setCopied] = useState(false);
  const color = COLORS[index % COLORS.length];

  const handleCopy = async () => {
    // We copy the title as placeholder — actual decrypt would require backend endpoint
    await navigator.clipboard.writeText(`[Encrypted: ${entry.title}]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = entry.title.slice(0, 2).toUpperCase();
  const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="animate-fade-slide-up"
      style={{
        animationDelay: `${index * 40}ms`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: color.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 14,
          fontWeight: 600,
          color: color.icon,
          letterSpacing: "-0.02em",
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 3,
          }}
        >
          <Key size={11} color="var(--text-tertiary)" />
          <span
            style={{
              fontSize: 12.5,
              color: "var(--text-tertiary)",
              letterSpacing: "0.08em",
              fontFamily: "monospace",
            }}
          >
            ••••••••••••
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-tertiary)",
              marginLeft: 6,
            }}
          >
            {date}
          </span>
          {entry.groupId && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent)",
                background: "var(--accent-light)",
                borderRadius: 6,
                padding: "2px 7px",
                fontWeight: 500,
                marginLeft: 4,
              }}
            >
              Shared
            </span>
          )}
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy password"}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "none",
          background: copied ? "var(--accent-light)" : "var(--bg-primary)",
          color: copied ? "var(--accent)" : "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!copied) {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-primary)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
          }
        }}
      >
        {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} />}
      </button>
    </div>
  );
}
