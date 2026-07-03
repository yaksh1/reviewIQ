"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Spinner size={24} /></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Login failed");
        return;
      }
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 26 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--hairline-strong)", background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
            <Icon.target size={17} />
          </span>
          <span className="display" style={{ fontSize: 19 }}>ReviewIQ</span>
        </div>

        <form className="card" style={{ padding: 24 }} onSubmit={submit}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Sign in</div>

          <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>Email</label>
          <input
            className="input" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} required
          />

          <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>Password</label>
          <input
            className="input" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 18 }} required
          />

          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? <Spinner /> : <Icon.key size={15} />}<span style={{ marginLeft: 6 }}>Sign in</span>
          </button>

          {error && <div style={{ color: "var(--neg)", fontSize: 12.5, marginTop: 14, textAlign: "center" }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
