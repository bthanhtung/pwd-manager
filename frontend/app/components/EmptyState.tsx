"use client";

import { ShieldCheck } from "lucide-react";

export default function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 40px",
        flex: 1,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          background: "var(--bg-tertiary)",
          borderRadius: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <ShieldCheck size={36} color="var(--text-tertiary)" strokeWidth={1.5} />
      </div>

      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          margin: "0 0 10px",
        }}
      >
        No passwords yet
      </h2>
      <p
        style={{
          fontSize: 14.5,
          color: "var(--text-secondary)",
          maxWidth: 280,
          lineHeight: 1.6,
          margin: "0 0 28px",
        }}
      >
        Add your first password or secret. It will be encrypted before saving.
      </p>

      <button
        onClick={onAdd}
        className="btn-primary"
        style={{ width: "auto", padding: "12px 28px" }}
      >
        Add Password
      </button>
    </div>
  );
}
