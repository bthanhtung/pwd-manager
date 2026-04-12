"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { X, Lock, Tag, Loader2, Eye, EyeOff } from "lucide-react";
import { vaultApi, type CreateVaultPayload, type VaultEntry } from "../../lib/api";

interface AddVaultModalProps {
  onClose: () => void;
  onAdded: (entry: VaultEntry) => void;
}

export default function AddVaultModal({ onClose, onAdded }: AddVaultModalProps) {
  const [title, setTitle] = useState("");
  const [plainTextValue, setPlainTextValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    // Lock body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: CreateVaultPayload = { title, plainTextValue };
      const entry = await vaultApi.create(payload);
      onAdded(entry);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="animate-fade-in"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
        }}
      />

      {/* Modal */}
      <div
        className="animate-scale-in"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 51,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            background: "var(--bg-secondary)",
            borderRadius: 20,
            boxShadow: "var(--shadow-lg)",
            pointerEvents: "all",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "22px 24px 0",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                New Password
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  margin: "4px 0 0",
                }}
              >
                Encrypted before saving
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ padding: "8px", borderRadius: "50%" }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div
                style={{
                  background: "rgba(255,59,48,0.08)",
                  border: "1px solid rgba(255,59,48,0.2)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontSize: 13.5,
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚠️</span> {error}
              </div>
            )}

            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                <Tag size={13} />
                Title
              </label>
              <input
                ref={titleRef}
                className="input-apple"
                type="text"
                placeholder="e.g. Gmail, GitHub Token, Credit Card…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                <Lock size={13} />
                Secret / Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="input-apple"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password or token…"
                  value={plainTextValue}
                  onChange={(e) => setPlainTextValue(e.target.value)}
                  required
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
                    padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  marginTop: 7,
                  marginBottom: 0,
                }}
              >
                🔒 Encrypted with AES-256-GCM before leaving your browser
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost"
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !title || !plainTextValue}
                style={{ flex: 2 }}
              >
                {loading ? (
                  <Loader2
                    size={16}
                    style={{ animation: "spin 0.7s linear infinite" }}
                  />
                ) : null}
                {loading ? "Saving…" : "Save Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
