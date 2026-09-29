"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

const IPFS_GW = process.env.NEXT_PUBLIC_PINATA_GATEWAY
  ? `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs`
  : "https://ipfs.io/ipfs";

const STAGE_LABELS = {
  COLLECTED: "Collected",
  AGGREGATED: "Aggregated",
  PROCESSED: "Processed",
  LAB_TESTED: "Lab Tested",
  MANUFACTURED: "Manufactured",
  PACKAGED: "Packaged",
  DISTRIBUTED: "Distributed",
};

const STAGE_BADGE = {
  COLLECTED: "b-wait",
  AGGREGATED: "b-wait",
  PROCESSED: "b-wait",
  LAB_TESTED: "b-ok",
  MANUFACTURED: "b-ok",
  PACKAGED: "b-ok",
  DISTRIBUTED: "b-move",
};

function fmt(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function shortHash(h) {
  return h ? `${h.slice(0, 10)}…${h.slice(-6)}` : null;
}

// ---------- sub-views ----------

function UsersView() {
  const [pending, setPending] = useState([]);
  const [verified, setVerified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [p, v] = await Promise.all([
        apiFetch("/users?verified=false"),
        apiFetch("/users?verified=true"),
      ]);
      setPending(p);
      setVerified(v);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    setApprovingId(id);
    setError("");
    try {
      await apiFetch(`/users/${id}/verify`, { method: "PATCH" });
      await load();
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
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
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
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
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

function BatchListView({ onSelect }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/admin/batches")
      .then(setBatches)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--sage)", marginTop: 20 }}>Loading batches…</p>;

  return (
    <div className="pane on" style={{ marginTop: 10 }}>
      <div className="panehead">
        <i className="d" /><i className="d" /><i className="d" />
        <span>All batches ({batches.length})</span>
      </div>
      <div className="panebody" style={{ gridTemplateColumns: "1fr" }}>
        {error && <div className="formerr" style={{ marginBottom: 14 }}>{error}</div>}
        {batches.length === 0 && !error && <p style={{ color: "var(--sage)" }}>No batches in the system yet.</p>}
        {batches.map((b) => (
          <div key={b.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--display)", fontWeight: 600 }}>{b.batchCode}</span>
                <span className={`badge ${STAGE_BADGE[b.status] || "b-wait"}`}>{STAGE_LABELS[b.status] || b.status}</span>
                {b.onChainId && <span className="badge b-move" style={{ fontSize: 11 }}>On-chain ✓</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--sage)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{b.herbSpecies}</span>
                <span>· {b.quantityKg} kg</span>
                <span>· Farmer: <b style={{ color: "var(--bone)" }}>{b.farmer?.name}</b></span>
                {b.currentCustodian && (
                  <span>· Custodian: <b style={{ color: "var(--bone)" }}>{b.currentCustodian.name}</b>{" "}
                    <span className="badge b-wait" style={{ fontSize: 10.5 }}>{b.currentCustodian.role}</span>
                  </span>
                )}
                <span>· Updated {fmt(b.updatedAt)}</span>
              </div>
            </div>
            <button className="cta ghost" style={{ whiteSpace: "nowrap" }} onClick={() => onSelect(b.id)}>
              View details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchDetailView({ batchId, onBack }) {
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/admin/batches/${batchId}`)
      .then(setBatch)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) return <p style={{ color: "var(--sage)", marginTop: 20 }}>Loading batch…</p>;
  if (error) return (
    <div style={{ marginTop: 10 }}>
      <div className="formerr" style={{ marginBottom: 14 }}>{error}</div>
      <button className="cta ghost" onClick={onBack}>← Back to batches</button>
    </div>
  );
  if (!batch) return null;

  // collect all IPFS documents: event-level ipfsCid + labCertificate reportIpfsCid
  const docs = batch.events.flatMap((ev) => {
    const out = [];
    if (ev.ipfsCid) out.push({ label: `${STAGE_LABELS[ev.stage] || ev.stage} document`, cid: ev.ipfsCid, txHash: ev.txHash, date: ev.occurredAt });
    if (ev.labCertificate?.reportIpfsCid) out.push({ label: "Lab report", cid: ev.labCertificate.reportIpfsCid, result: ev.labCertificate.result, testedFor: ev.labCertificate.testedFor, date: ev.labCertificate.issuedAt });
    return out;
  });

  return (
    <div style={{ marginTop: 10 }}>
      <button className="cta ghost" style={{ marginBottom: 20 }} onClick={onBack}>← Back to batches</button>

      {/* 1. Overview */}
      <div className="pane on" style={{ marginBottom: 20 }}>
        <div className="panehead">
          <i className="d" /><i className="d" /><i className="d" />
          <span>Batch overview</span>
        </div>
        <div className="panebody" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Row label="Batch code" value={batch.batchCode} />
            <Row label="Herb / species" value={batch.herbSpecies} />
            <Row label="Quantity" value={`${batch.quantityKg} kg`} />
            <Row label="Collection date" value={fmt(batch.collectionDate)} />
            {batch.harvestSeason && <Row label="Harvest season" value={batch.harvestSeason} />}
          </div>
          <div>
            <Row label="Current stage">
              <span className={`badge ${STAGE_BADGE[batch.status] || "b-wait"}`}>{STAGE_LABELS[batch.status] || batch.status}</span>
            </Row>
            <Row label="Location" value={`${batch.collectionLat}, ${batch.collectionLng}`} />
            <Row label="Created" value={fmt(batch.createdAt)} />
            <Row label="Last updated" value={fmt(batch.updatedAt)} />
            {batch.onChainId && <Row label="On-chain ID" mono value={batch.onChainId} />}
            {batch.creationTxHash && <Row label="Creation tx" mono value={shortHash(batch.creationTxHash)} title={batch.creationTxHash} />}
          </div>
        </div>
      </div>

      {/* 2. Farmer */}
      <div className="pane on" style={{ marginBottom: 20 }}>
        <div className="panehead">
          <i className="d" /><i className="d" /><i className="d" />
          <span>Farmer</span>
        </div>
        <div className="panebody" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Row label="Name" value={batch.farmer.name} />
            <Row label="Email" value={batch.farmer.email} />
            {batch.farmer.phone && <Row label="Phone" value={batch.farmer.phone} />}
          </div>
          <div>
            {batch.farmer.orgName && <Row label="Organisation" value={batch.farmer.orgName} />}
            {batch.farmer.region && <Row label="Region" value={batch.farmer.region} />}
          </div>
        </div>
      </div>

      {/* 3. Current custodian */}
      <div className="pane on" style={{ marginBottom: 20 }}>
        <div className="panehead">
          <i className="d" /><i className="d" /><i className="d" />
          <span>Current custodian</span>
        </div>
        <div className="panebody" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Row label="Name" value={batch.currentCustodian.name} />
            <Row label="Email" value={batch.currentCustodian.email} />
          </div>
          <div>
            <Row label="Role">
              <span className="badge b-wait">{batch.currentCustodian.role}</span>
            </Row>
          </div>
        </div>
      </div>

      {/* 4. Event timeline */}
      <div className="pane on" style={{ marginBottom: 20 }}>
        <div className="panehead">
          <i className="d" /><i className="d" /><i className="d" />
          <span>Lifecycle timeline ({batch.events.length} events)</span>
        </div>
        <div className="panebody" style={{ gridTemplateColumns: "1fr" }}>
          {batch.events.length === 0 && <p style={{ color: "var(--sage)" }}>No events recorded yet.</p>}
          <ul className="timeline">
            {batch.events.map((ev) => (
              <li key={ev.id}>
                <b>
                  <span className={`badge ${STAGE_BADGE[ev.stage] || "b-wait"}`} style={{ marginRight: 8 }}>{STAGE_LABELS[ev.stage] || ev.stage}</span>
                </b>
                <small style={{ display: "block", marginTop: 4 }}>
                  {fmtTime(ev.occurredAt)}
                  {" · "}{ev.actor.name}
                  {" · "}<span style={{ color: "var(--bone)" }}>{ev.actor.email}</span>
                  {" · "}<span className="badge b-wait" style={{ fontSize: 10.5 }}>{ev.actor.role}</span>
                  {ev.actor.orgName && <> · {ev.actor.orgName}</>}
                </small>
                {ev.notes && <small style={{ display: "block", color: "var(--sage)", marginTop: 2 }}>{ev.notes}</small>}
                {ev.txHash && <code title={ev.txHash}>{shortHash(ev.txHash)}</code>}
                {ev.ipfsCid && (
                  <code>
                    IPFS: {ev.ipfsCid.slice(0, 12)}…{" "}
                    <a href={`${IPFS_GW}/${ev.ipfsCid}`} target="_blank" rel="noreferrer" style={{ color: "var(--chloro)" }}>view ↗</a>
                  </code>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 5. Documents / IPFS */}
      {docs.length > 0 && (
        <div className="pane on">
          <div className="panehead">
            <i className="d" /><i className="d" /><i className="d" />
            <span>Documents &amp; IPFS files ({docs.length})</span>
          </div>
          <div className="panebody" style={{ gridTemplateColumns: "1fr" }}>
            {docs.map((doc, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "var(--display)", fontWeight: 600, marginBottom: 4 }}>{doc.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--sage)" }}>
                      <span style={{ fontFamily: "ui-monospace,monospace", color: "var(--chloro)" }}>{doc.cid}</span>
                      {doc.date && <> · {fmt(doc.date)}</>}
                      {doc.result && <> · Result: <b style={{ color: "var(--bone)" }}>{doc.result}</b></>}
                    </div>
                    {doc.testedFor?.length > 0 && (
                      <div style={{ fontSize: 12, color: "var(--sage)", marginTop: 4 }}>
                        Tested for: {doc.testedFor.join(", ")}
                      </div>
                    )}
                    {doc.txHash && (
                      <div style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: "var(--chloro)", marginTop: 3 }} title={doc.txHash}>
                        tx: {shortHash(doc.txHash)}
                      </div>
                    )}
                  </div>
                  <a href={`${IPFS_GW}/${doc.cid}`} target="_blank" rel="noreferrer" className="cta ghost" style={{ fontSize: 13 }}>
                    Open ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Small helper to keep the detail rows DRY
function Row({ label, value, mono, title, children }) {
  return (
    <div className="fieldrow">
      <label>{label}</label>
      <div className="fake" style={mono ? { fontFamily: "ui-monospace,monospace", fontSize: 12, color: "var(--chloro)" } : undefined} title={title}>
        {children ?? (value ?? <span className="muted">—</span>)}
      </div>
    </div>
  );
}

// ---------- main export ----------

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  function selectBatch(id) {
    setSelectedBatchId(id);
    setTab("batch-detail");
  }

  function backToList() {
    setSelectedBatchId(null);
    setTab("batches");
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="tabs">
        <button className="tab" aria-selected={tab === "users"} onClick={() => setTab("users")}>User approvals</button>
        <button className="tab" aria-selected={tab === "batches" || tab === "batch-detail"} onClick={() => { setSelectedBatchId(null); setTab("batches"); }}>Batch supervision</button>
      </div>

      {tab === "users" && <UsersView />}
      {tab === "batches" && <BatchListView onSelect={selectBatch} />}
      {tab === "batch-detail" && selectedBatchId && <BatchDetailView batchId={selectedBatchId} onBack={backToList} />}
    </div>
  );
}
