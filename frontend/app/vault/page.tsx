"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, RefreshCw, Loader2 } from "lucide-react";
import { vaultApi, type VaultEntry } from "../../lib/api";
import { auth } from "../../lib/auth";
import Sidebar from "../components/Sidebar";
import VaultCard from "../components/VaultCard";
import AddVaultModal from "../components/AddVaultModal";
import EmptyState from "../components/EmptyState";

export default function VaultPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [filtered, setFiltered] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  // Guard
  useEffect(() => {
    if (!auth.isLoggedIn()) {
      router.replace("/login");
    }
  }, [router]);

  const fetchVault = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vaultApi.list();
      setEntries(data);
      setFiltered(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.isLoggedIn()) fetchVault();
  }, [fetchVault]);

  // Search filter
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(entries);
    } else {
      const q = search.toLowerCase();
      setFiltered(entries.filter((e) => e.title.toLowerCase().includes(q)));
    }
  }, [search, entries]);

  const handleAdded = (entry: VaultEntry) => {
    setEntries((prev) => [entry, ...prev]);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {/* Top bar */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "var(--bg-primary)",
            borderBottom: "1px solid var(--border)",
            padding: "18px 32px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Search */}
          <div style={{ flex: 1, position: "relative", maxWidth: 480 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 13,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
                pointerEvents: "none",
              }}
            />
            <input
              className="input-apple"
              type="text"
              placeholder="Search passwords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchVault}
            className="btn-ghost"
            title="Refresh"
            style={{ padding: "9px" }}
          >
            <RefreshCw
              size={16}
              style={{ animation: loading ? "spin 0.7s linear infinite" : "none" }}
            />
          </button>

          {/* Add */}
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
            style={{ width: "auto", padding: "10px 18px", gap: 7 }}
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Password
          </button>
        </header>

        {/* Content */}
        <div style={{ padding: "32px", flex: 1 }}>
          {/* Stats bar */}
          {!loading && entries.length > 0 && (
            <div
              className="animate-fade-in"
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 24,
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "Total", value: entries.length, color: "var(--accent)" },
                {
                  label: "Shared",
                  value: entries.filter((e) => e.groupId).length,
                  color: "#bf5af2",
                },
                {
                  label: "Personal",
                  value: entries.filter((e) => !e.groupId).length,
                  color: "#30d158",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "14px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minWidth: 90,
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: stat.color,
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Section header */}
          {!loading && entries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h1
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {search
                  ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`
                  : "All Passwords"}
              </h1>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 16,
                paddingTop: 80,
                color: "var(--text-tertiary)",
              }}
            >
              <Loader2
                size={32}
                style={{ animation: "spin 0.8s linear infinite" }}
                strokeWidth={1.5}
              />
              <span style={{ fontSize: 14 }}>Loading vault…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="animate-fade-in"
              style={{
                background: "rgba(255,59,48,0.08)",
                border: "1px solid rgba(255,59,48,0.2)",
                borderRadius: 14,
                padding: "20px 24px",
                color: "var(--danger)",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 500 }}>
                ⚠️ {error}
              </p>
              <button
                onClick={fetchVault}
                className="btn-ghost"
                style={{ marginTop: 12, color: "var(--danger)" }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && entries.length === 0 && (
            <EmptyState onAdd={() => setShowModal(true)} />
          )}

          {/* Search empty */}
          {!loading && !error && entries.length > 0 && filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                paddingTop: 60,
                color: "var(--text-tertiary)",
              }}
            >
              <p style={{ fontSize: 15, margin: 0 }}>
                No results for &quot;{search}&quot;
              </p>
              <button
                onClick={() => setSearch("")}
                className="btn-ghost"
                style={{ marginTop: 12 }}
              >
                Clear search
              </button>
            </div>
          )}

          {/* List */}
          {!loading && !error && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((entry, i) => (
                <VaultCard key={entry._id} entry={entry} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <AddVaultModal
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
