"use client";
import { useActionState, useEffect, useState } from "react";
import Req from "@/components/Req";
import { saveCashCount, setCashStart } from "./actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Set (or correct) the start date and opening cash of the cash book. */
export function StartForm({ startDate, opening, today }: { startDate?: string; opening?: number; today: string }) {
  const [state, action, pending] = useActionState(setCashStart, null);
  return (
    <form action={action} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="field" style={{ flex: "0 1 190px" }}>
        <label className="lbl" htmlFor="cb-start">Start date<Req /></label>
        <input id="cb-start" type="date" name="start_date" required max={today} defaultValue={startDate ?? ""} style={input} />
      </div>
      <div className="field" style={{ flex: "0 1 220px" }}>
        <label className="lbl" htmlFor="cb-open">Cash in hand that morning (৳)<Req /></label>
        <input id="cb-open" name="opening_balance" inputMode="decimal" required defaultValue={opening ?? ""} placeholder="0" style={input} />
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : startDate ? "Save" : "Start the cash book"}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
    </form>
  );
}

/** Counted cash for one day, entered in its row. */
export function CountCell({ date, counted, note, readOnly }: { date: string; counted: number | null; note: string | null; readOnly: boolean }) {
  const [state, action, pending] = useActionState(saveCashCount, null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  if (readOnly || !open) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {counted != null ? <span className="mono">৳{Number(counted).toLocaleString("en-IN")}</span> : <span className="sub">-</span>}
        {!readOnly && (
          <button type="button" className="linkbtn" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>{counted != null ? "Change" : "Enter"}</button>
        )}
        {note && <span className="sub" style={{ width: "100%", textAlign: "right" }}>{note}</span>}
      </span>
    );
  }
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170 }}>
      <input type="hidden" name="date" value={date} />
      <input name="counted" inputMode="decimal" autoFocus defaultValue={counted ?? ""} placeholder="Counted ৳ (empty clears)" style={input} />
      <input name="note" maxLength={300} defaultValue={note ?? ""} placeholder="Note (optional)" style={input} />
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "6px 10px" }}>{pending ? "…" : "Save"}</button>
        <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen(false)}>Cancel</button>
      </span>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}
