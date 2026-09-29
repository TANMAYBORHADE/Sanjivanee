"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

const STAGE_LABELS = {
  COLLECTED: "Collected",
  AGGREGATED: "Aggregated",
  PROCESSED: "Processed",
  LAB_TESTED: "Lab tested",
  MANUFACTURED: "Manufactured",
  PACKAGED: "Packaged",
  DISTRIBUTED: "Distributed",
};

export default function FarmerDashboard() {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [listError, setListError] = useState("");

  const [form, setForm] = useState({
    batchCode: "",
    herbSpecies: "",
    quantityKg: "",
    collectionLat: "",
    collectionLng: "",
  });
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  async function loadBatches() {
    setLoadingBatches(true);
    setListError("");
    try {
      const data = await apiFetch("/my-batches");
      setBatches(data);
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingBatches(false);
    }
  }

  useEffect(() => {
    loadBatches();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setFormError("Your browser doesn't support location access — enter coordinates manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("collectionLat", pos.coords.latitude.toFixed(6));
        update("collectionLng", pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setFormError("Couldn't get your location — enter coordinates manually.");
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);
    try {
      await apiFetch("/batches", {
        method: "POST",
        body: {
          batchCode: form.batchCode,
          herbSpecies: form.herbSpecies,
          quantityKg: parseFloat(form.quantityKg),
          collectionLat: parseFloat(form.collectionLat),
          collectionLng: parseFloat(form.collectionLng),
        },
      });
      setFormSuccess(`Batch ${form.batchCode} created and anchored on-chain.`);
      setForm({ batchCode: "", herbSpecies: "", quantityKg: "", collectionLat: "", collectionLng: "" });
      loadBatches();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pane on" style={{ marginTop: 10 }}>
      <div className="panehead"><i className="d" /><i className="d" /><i className="d" /><span>Record a collection</span></div>
      <div className="panebody">
        <div>
          {formError && <div className="formerr" style={{ marginBottom: 14 }}>{formError}</div>}
          {formSuccess && <div className="formok" style={{ marginBottom: 14 }}>{formSuccess}</div>}

          <form onSubmit={handleSubmit}>
            <div className="fieldrow">
              <label htmlFor="batchCode">Batch code</label>
              <input id="batchCode" required value={form.batchCode} onChange={(e) => update("batchCode", e.target.value)} placeholder="SNJ-ASHW-2026-0001" />
            </div>
            <div className="fieldrow">
              <label htmlFor="herbSpecies">Species</label>
              <input id="herbSpecies" required value={form.herbSpecies} onChange={(e) => update("herbSpecies", e.target.value)} placeholder="Withania somnifera (Ashwagandha)" />
            </div>
            <div className="fieldrow">
              <label htmlFor="quantityKg">Wet weight (kg)</label>
              <input id="quantityKg" type="number" step="0.1" min="0.1" required value={form.quantityKg} onChange={(e) => update("quantityKg", e.target.value)} placeholder="420" />
            </div>
            <div className="two">
              <div className="fieldrow">
                <label htmlFor="lat">Latitude</label>
                <input id="lat" type="number" step="any" required value={form.collectionLat} onChange={(e) => update("collectionLat", e.target.value)} placeholder="20.0059" />
              </div>
              <div className="fieldrow">
                <label htmlFor="lng">Longitude</label>
                <input id="lng" type="number" step="any" required value={form.collectionLng} onChange={(e) => update("collectionLng", e.target.value)} placeholder="73.7910" />
              </div>
            </div>
            <button type="button" className="cta ghost" onClick={useMyLocation} disabled={locating} style={{ marginBottom: 14 }}>
              {locating ? "Locating…" : "Use my current location"}
            </button>
            <button className="cta" type="submit" disabled={submitting}>
              {submitting ? "Creating batch…" : "Create batch"}
            </button>
          </form>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--sage)", display: "block", marginBottom: 14 }}>Your batches</label>
          {listError && <div className="formerr" style={{ marginBottom: 14 }}>{listError}</div>}
          {loadingBatches && <p style={{ color: "var(--sage)" }}>Loading…</p>}
          {!loadingBatches && batches.length === 0 && <p style={{ color: "var(--sage)" }}>No batches yet — create your first one.</p>}
          <ul className="timeline">
            {batches.map((b) => (
              <li key={b.id} className={b.status === "DISTRIBUTED" ? "" : "pend"}>
                <b>{b.batchCode} · {b.quantityKg} kg</b>
                <small>
                  {STAGE_LABELS[b.status] || b.status}
                  {b.currentCustodian && <> · held by {b.currentCustodian.name}</>}
                </small>
                {b.creationTxHash && <code>{b.creationTxHash.slice(0, 10)}…{b.creationTxHash.slice(-6)}</code>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}