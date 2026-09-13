"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginRole = "stakeholder" | "contributor" | "admin";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<LoginRole>("admin");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password,
          role,
          user_id: userId.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push("/admin/intel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login request failed");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h1 className="text-2xl font-bold">Admin Login</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Authenticate to access the intelligence control plane.
      </p>

      <div className="mt-5 space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as LoginRole)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        >
          <option value="stakeholder">stakeholder</option>
          <option value="contributor">contributor</option>
          <option value="admin">admin</option>
        </select>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Optional user id"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <button
        onClick={() => void login()}
        disabled={loading || !password}
        className="mt-5 rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </div>
  );
}
