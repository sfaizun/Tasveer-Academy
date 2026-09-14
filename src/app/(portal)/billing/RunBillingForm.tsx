"use client";
import { useActionState } from "react";
import { runBilling } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "10px 12px",
  fontSize: 14, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit",
};

export default function RunBillingForm({ defaultMonth }: { defaultMonth: string }) {
  const [state, action, pending] = useActionState(runBilling, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field">
          <label className="lbl">Billing month</label>
          <input style={inputStyle} type="month" name="month" defaultValue={defaultMonth} required />
        </div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Running…" : "Run billing for this month"}
        </button>
      </div>
      {state?.error && <div className="sub" style={{ color: "var(--crit)" }}>{state.error}</div>}
      {state?.ok && (
        <div className="sub" style={{ color: "var(--ok)" }}>
          Done — {state.created} invoice{state.created === 1 ? "" : "s"} created,{" "}
          {state.skipped} skipped (already billed, or nothing billable that month).
        </div>
      )}
      <div className="sub">
        Idempotent — running the same month again never creates a duplicate invoice. Only bills
        active students / active enrolments whose billing has already started; the first month
        (a full month's fee, never pro-rated) is created automatically when an application is
        approved. If a reduced first-month charge is ever needed, add it as a manual discount
        on that invoice instead.
      </div>
    </form>
  );
}
