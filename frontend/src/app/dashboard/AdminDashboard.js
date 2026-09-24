"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

export default function AdminDashboard() {
  const [pending, setPending] = useState([]);
  const [verified, setVerified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [pendingUsers, verifiedUsers] = await Promise.all([
        apiFetch("/users?verified=false"),
        apiFetch("/users?verified=true"),
      ]);
      setPending(pendingUsers);
      setVerified(verifiedUsers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id) {
    setApprovingId(id);
    setError("");
    try {
      await apiFetch(`/users/${id}/verify`, { method: "PATCH" });
      await load(); // refetch both lists so the approved user moves from pending to verified
    } catch (err) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  }

  if (loading) return <p style={{ color: "var(--sage)", marginTop: 20 }}>Loading users…</p>;

  return (
    <div style={{ marginTop: 10 }}>
      {error && <div className="formerr" style={{ marginBottom: 18 }}>{error}</div>}

      <div className="pane on" style={{ marginBottom: 24 }}>
        <div className="panehead">
          <i className="d" /><i className="d" /><i className="d" />
          <span>Pending approval ({pending.length})</span>
        </div>
        <div className="panebody" style={{ gridTemplateColumns: "1fr" }}>
          {pending.length === 0 && <p style={{ color: "var(--sage)" }}>Nobody&apos;s waiting on approval right now.</p>}
          {pending.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 0", borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--sage)" }}>
                  {u.email} · <span className="badge b-wait">{u.role}</span>
                  {u.orgName && <> · {u.orgName}</>}
                  {u.region && <> · {u.region}</>}
                </div>
              </div>
              <button className="cta" onClick={() => approve(u.id)} disabled={approvingId === u.id}>
                {approvingId === u.id ? "Approving…" : "Approve"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pane on">
        <div className="panehead">
          <i className="d" /><i className="d" /><i className="d" />
          <span>Verified users ({verified.length})</span>
        </div>
        <div className="panebody" style={{ gridTemplateColumns: "1fr" }}>
          {verified.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5,
              }}
            >
              <div>
                <b>{u.name}</b> <span style={{ color: "var(--sage)" }}>· {u.email}</span>
              </div>
              <span className="badge b-ok">{u.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}