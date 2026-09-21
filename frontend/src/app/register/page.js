"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

// Matches SELF_REGISTERABLE_ROLES in server.js exactly — admin accounts
// are never created through open registration, only via the backend's
// create-admin script.
const ROLES = [
  { value: "FARMER", label: "Farmer" },
  { value: "AGGREGATOR", label: "Aggregator" },
  { value: "PROCESSOR", label: "Processor" },
  { value: "LAB", label: "Testing lab" },
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "DISTRIBUTOR", label: "Distributor" },
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "FARMER",
    orgName: "",
    region: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/users", { method: "POST", body: form });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="authWrap">
        <div className="authCard rv in">
          <h1>Account created</h1>
          <p>
            An admin needs to verify your account before you can create or update batches. You can log in
            once you&apos;ve been approved.
          </p>
          <Link href="/login" className="cta" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="authWrap">
      <div className="authCard rv in">
        <h1>Register</h1>
        <p>Create an account as a farmer, lab, processor, manufacturer, aggregator, or distributor.</p>

        {error && <div className="formerr" style={{ marginBottom: 14 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="fieldrow">
            <label htmlFor="name">Full name</label>
            <input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ramesh Patil" />
          </div>
          <div className="fieldrow">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="fieldrow">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="fieldrow">
            <label htmlFor="role">Role</label>
            <select id="role" value={form.role} onChange={(e) => update("role", e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="two">
            <div className="fieldrow">
              <label htmlFor="orgName">Organization (optional)</label>
              <input id="orgName" value={form.orgName} onChange={(e) => update("orgName", e.target.value)} placeholder="Vardhan Labs" />
            </div>
            <div className="fieldrow">
              <label htmlFor="region">Region (optional)</label>
              <input id="region" value={form.region} onChange={(e) => update("region", e.target.value)} placeholder="Neemuch, MP" />
            </div>
          </div>
          <button className="cta" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="authswitch">
          Already have an account? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}