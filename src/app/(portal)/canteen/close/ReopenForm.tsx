"use client";
import { useActionState, useState } from "react";
import { reopenDay } from "../day-actions";

export function ReopenForm({ dayId }: { dayId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reopenDay, null);
  if (!open) return <button className="linkbtn" type="button" onClick={() => setOpen(true)}>Reopen</button>;
  return (
    <form action={action} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <input type="hidden" name="day_id" value={dayId} />
      <input
        name="reason" required autoFocus placeholder="Reason, e.g. a sale was missed"
        style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "5px 8px", fontSize: 12, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: 210 }}
      />
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>{pending ? "Reopening…" : "Reopen"}</button>
      <button className="linkbtn" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)", width: "100%", textAlign: "right" }}>{state.error}</span>}
    </form>
  );
}
