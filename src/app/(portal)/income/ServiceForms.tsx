"use client";
import { useActionState, useState } from "react";
import { chargeServiceCharges, removeServiceCharge, setServiceRule } from "./service-actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "7px 9px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** One teacher's setting: None / Fixed ৳ / % of fee collection. */
export function RuleForm({ teacherId, kind, value }: { teacherId: string; kind: string | null; value: number | null }) {
  const [state, action, pending] = useActionState(setServiceRule, null);
  const [k, setK] = useState(kind ?? "none");
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <input type="hidden" name="teacher_id" value={teacherId} />
      <select name="kind" value={k} onChange={(e) => setK(e.target.value)} style={input} aria-label="Service charge type">
        <option value="none">None</option>
        <option value="fixed">Fixed ৳ / month</option>
        <option value="percent">% of fee collection</option>
      </select>
      {k !== "none" && (
        <input name="value" inputMode="decimal" required defaultValue={value ?? ""} placeholder={k === "percent" ? "30" : "50000"} style={{ ...input, width: 100 }} aria-label="Amount or percentage" />
      )}
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, padding: "6px 10px" }}>{pending ? "…" : "Save"}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved</span>}
    </form>
  );
}

export function ChargeButton({ month, label }: { month: string; label: string }) {
  const [state, action, pending] = useActionState(chargeServiceCharges, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="month" value={month} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Charging…" : label}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>{state.message}</span>}
    </form>
  );
}

export function RemoveCharge({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeServiceCharge, null);
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="linkbtn" onClick={() => setOpen(true)}>Remove</button>;
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={id} />
      <input name="reason" required placeholder="Reason" style={{ ...input, width: 150 }} />
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "6px 10px" }}>Remove</button>
      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen(false)}>Keep</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}
