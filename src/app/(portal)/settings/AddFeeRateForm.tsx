"use client";
import { useActionState, useRef, useEffect } from "react";
import { addFeeRate } from "./actions";

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "10px 12px",
  fontSize: 14, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddFeeRateForm({ options }: { options: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addFeeRate, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <div className="field">
          <label className="lbl">Rate</label>
          <select style={selStyle} name="target" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">New amount (৳)</label>
          <input type="number" name="amount" min="0" step="1" required />
        </div>
        <div className="field">
          <label className="lbl">Effective from</label>
          <input type="date" name="effective_from" defaultValue={todayISO()} required />
        </div>
        <div className="field">
          <label className="lbl">Note (optional)</label>
          <input type="text" name="note" placeholder="Reason for the change" />
        </div>
      </div>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save new rate"}
        </button>
      </div>
      <div className="sub">
        This adds a new dated rate — it never overwrites the old one, so the history stays intact.
      </div>
      {state?.error && <div className="sub" style={{ color: "var(--crit)" }}>{state.error}</div>}
    </form>
  );
}
