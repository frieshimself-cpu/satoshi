"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="panel p-6 w-full max-w-sm space-y-4">
        <h1 className="text-phosphor text-glow tracking-[0.25em] text-sm">
          ▙ CONTROL ROOM ACCESS
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="OPERATOR PASSWORD"
          autoFocus
          className="w-full bg-charcoal-950 border border-charcoal-600 focus:border-phosphor-dim outline-none px-3 py-2 text-sm text-phosphor placeholder:text-charcoal-600 tracking-widest"
        />
        {error && <p className="text-alert text-xs tracking-widest">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full border border-phosphor-dim text-phosphor tracking-[0.25em] text-xs py-2.5 hover:bg-phosphor-faint/40 disabled:opacity-40"
        >
          {busy ? "AUTHENTICATING..." : "AUTHENTICATE"}
        </button>
      </form>
    </main>
  );
}
