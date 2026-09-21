"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, saveSession } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: { email, password } });
      saveSession(data.token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handles the response Google sends back after someone signs in.
  // Google gives us a verified idToken — we hand it to our backend, which
  // verifies it AGAIN server-side (never trust a token the client claims
  // is valid) and returns a normal Sanjeevani session token.
  async function handleGoogleResponse(response) {
    setError("");
    try {
      const data = await apiFetch("/auth/google", { method: "POST", body: { idToken: response.credential } });
      saveSession(data.token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return; // Google login simply doesn't render if not configured

    window.handleGoogleResponse = handleGoogleResponse;

    const existing = document.querySelector('script[data-google-gsi="sanjeevani"]');
    function render() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: window.handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_black",
        shape: "pill",
        width: 340,
        text: "continue_with",
      });
    }

    if (window.google) {
      render();
    } else if (!existing) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.dataset.googleGsi = "sanjeevani";
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      existing.addEventListener("load", render);
    }
  }, []);

  return (
    <div className="authWrap">
      <div className="authCard rv in">
        <h1>Log in</h1>
        <p>Access your farmer, lab, processor, or admin dashboard.</p>

        {error && <div className="formerr" style={{ marginBottom: 14 }}>{error}</div>}

        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center", marginBottom: 8 }} />
            <p style={{ fontSize: 12, color: "var(--sage)", textAlign: "center", marginBottom: 20 }}>
              Google sign-in is for farmer accounts only
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 18px", color: "var(--sage)", fontSize: 12.5 }}>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              or
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          <div className="fieldrow">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="fieldrow">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="cta" type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div className="authswitch">
          Don&apos;t have an account? <Link href="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}