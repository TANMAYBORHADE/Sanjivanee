"use client";

import { useEffect, useState } from "react";
import { apiFetch, getUser } from "../../../lib/api";

// Which stage(s) each role is allowed to submit — mirrors STAGE_ALLOWED_ROLES
// in server.js exactly. Manufacturer gets two choices since they cover both
// MANUFACTURED and PACKAGED.
const ROLE_STAGES = {
  AGGREGATOR: ["AGGREGATED"],
  PROCESSOR: ["PROCESSED"],
  LAB: ["LAB_TESTED"],
  MANUFACTURER: ["MANUFACTURED", "PACKAGED"],
  DISTRIBUTOR: ["DISTRIBUTED"],
};

const STAGE_LABELS = {
  COLLECTED: "Collected",
  AGGREGATED: "Aggregated",
  PROCESSED: "Processed",
  LAB_TESTED: "Lab tested",
  MANUFACTURED: "Manufactured",
  PACKAGED: "Packaged",
  DISTRIBUTED: "Distributed",
};

// Who a batch would typically go to next — just a sensible default for the
// transfer picker's starting dropdown value, not an enforced rule.
const NEXT_ROLE_SUGGESTION = {
  AGGREGATOR: "PROCESSOR",
  PROCESSOR: "LAB",
  LAB: "MANUFACTURER",
  MANUFACTURER: "DISTRIBUTOR",
  DISTRIBUTOR: "DISTRIBUTOR",
};

const ALL_ROLES = ["FARMER", "AGGREGATOR", "PROCESSOR", "LAB", "MANUFACTURER", "DISTRIBUTOR"];

export default function ActorDashboard() {
  const user = getUser();
  const myStages = ROLE_STAGES[user?.role] || [];

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);

  async function loadBatches() {
    setLoading(true);
    setListError("");
    try {
      const data = await apiFetch("/my-batches");
      // Only show batches actually in MY custody right now — ones I merely
      // created (if any) but no longer hold aren't mine to act on.
      setBatches(data.filter((b) => b.currentCustodian?.id === user.id));
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBatches();
  }, []);

  return (
    <div className="pane on" style={{ marginTop: 10 }}>
      <div className="panehead"><i className="d" /><i className="d" /><i className="d" /><span>Batches in your custody</span></div>
      <div className="panebody" style={{ gridTemplateColumns: "1fr" }}>
        {listError && <div className="formerr" style={{ marginBottom: 14 }}>{listError}</div>}
        {loading && <p style={{ color: "var(--sage)" }}>Loading…</p>}
        {!loading && batches.length === 0 && (
          <p style={{ color: "var(--sage)" }}>Nothing&apos;s been handed to you yet. Ask the current holder to transfer custody of a batch to your account.</p>
        )}

        {!loading && batches.length > 0 && !selectedBatch && (
          <ul className="timeline">
            {batches.map((b) => (
              <li key={b.id}>
                <b>{b.batchCode} · {b.herbSpecies}</b>
                <small>Currently: {STAGE_LABELS[b.status] || b.status} · {b.quantityKg} kg</small>
                <button className="cta ghost" style={{ marginTop: 8 }} onClick={() => setSelectedBatch(b)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedBatch && (
          <BatchActionPanel
            batch={selectedBatch}
            myStages={myStages}
            onBack={() => setSelectedBatch(null)}
            onDone={() => {
              setSelectedBatch(null);
              loadBatches();
            }}
          />
        )}
      </div>
    </div>
  );
}

function BatchActionPanel({ batch, myStages, onBack, onDone }) {
  const [stage, setStage] = useState(myStages[0] || "");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [transferRole, setTransferRole] = useState(NEXT_ROLE_SUGGESTION[getUser()?.role] || "PROCESSOR");
  const [candidates, setCandidates] = useState([]);
  const [transferTo, setTransferTo] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState("");

  const alreadyAtOrPastStage = STAGE_INDEX(batch.status) >= STAGE_INDEX(stage);

  useEffect(() => {
    apiFetch(`/actors?role=${transferRole}`)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [transferRole]);

  async function handleEventSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("stage", stage);
      if (notes) form.append("notes", notes);
      if (file) form.append("report", file);

      await apiFetch(`/batches/${batch.id}/events`, { method: "POST", body: form, isFormData: true });
      setSuccess(`Recorded ${stage} on-chain.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setTransferMsg("");
    if (!transferTo) {
      setTransferMsg("Pick who you're handing this to.");
      return;
    }
    setTransferring(true);
    try {
      await apiFetch(`/batches/${batch.id}/transfer-custody`, {
        method: "POST",
        body: { nextCustodianId: transferTo },
      });
      onDone();
    } catch (err) {
      setTransferMsg(err.message);
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div>
      <button className="cta ghost" onClick={onBack} style={{ marginBottom: 18 }}>← Back to list</button>

      <h3 style={{ fontFamily: "var(--display)", marginBottom: 6 }}>{batch.batchCode}</h3>
      <p style={{ color: "var(--sage)", fontSize: 13.5, marginBottom: 20 }}>
        {batch.herbSpecies} · currently {STAGE_LABELS[batch.status] || batch.status}
      </p>

      <div className="panebody" style={{ gridTemplateColumns: "1fr 1fr", padding: 0 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 10 }}>Record your stage</label>
          {error && <div className="formerr" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div className="formok" style={{ marginBottom: 12 }}>{success}</div>}

          <form onSubmit={handleEventSubmit}>
            {myStages.length > 1 && (
              <div className="fieldrow">
                <label htmlFor="stage">Stage</label>
                <select id="stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                  {myStages.map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="fieldrow">
              <label htmlFor="notes">Notes (optional)</label>
              <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any detail worth recording" />
            </div>
            <div className="fieldrow">
              <label htmlFor="report">Attach a file (optional — report, photo)</label>
              <input id="report" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ padding: 8 }} />
            </div>
            <button className="cta" type="submit" disabled={submitting || alreadyAtOrPastStage}>
              {submitting ? "Recording…" : alreadyAtOrPastStage ? "Already recorded" : `Record ${STAGE_LABELS[stage]}`}
            </button>
          </form>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 10 }}>Transfer custody onward</label>
          {transferMsg && <div className="formerr" style={{ marginBottom: 12 }}>{transferMsg}</div>}
          <form onSubmit={handleTransfer}>
            <div className="fieldrow">
              <label htmlFor="transferRole">Hand off to role</label>
              <select id="transferRole" value={transferRole} onChange={(e) => { setTransferRole(e.target.value); setTransferTo(""); }}>
                {ALL_ROLES.filter((r) => r !== getUser()?.role).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="fieldrow">
              <label htmlFor="transferTo">Recipient</label>
              <select id="transferTo" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">Select a verified {transferRole.toLowerCase()}…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.orgName ? ` · ${c.orgName}` : ""}</option>
                ))}
              </select>
            </div>
            <button className="cta" type="submit" disabled={transferring}>
              {transferring ? "Transferring…" : "Transfer custody"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function STAGE_INDEX(stage) {
  const order = ["COLLECTED", "AGGREGATED", "PROCESSED", "LAB_TESTED", "MANUFACTURED", "PACKAGED", "DISTRIBUTED"];
  return order.indexOf(stage);
}