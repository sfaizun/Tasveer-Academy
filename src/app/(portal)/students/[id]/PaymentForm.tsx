"use client";
import { useActionState, useRef, useEffect } from "react";
import { recordPayment } from "./actions";
import Req from "@/components/Req";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "10px 12px",
  fontSize: 14, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentForm({ studentId, outstanding }: { studentId: string; outstanding: number }) {
  const [state, action, pending] = useActionState(recordPayment, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        <div className="field">
          <label className="lbl">Amount (৳)<Req /></label>
          <input
            style={inputStyle}
            type="number"
            name="amount"
            min="1"
            step="1"
            required
            defaultValue={outstanding > 0 ? outstanding : undefined}
          />
        </div>
        <div className="field">
          <label className="lbl">Method<Req /></label>
          <select style={inputStyle} name="method" defaultValue="cash" required>
            <option value="cash">Cash</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="field">
          <label className="lbl">Date received<Req /></label>
          <input style={inputStyle} type="date" name="received_on" defaultValue={todayISO()} required />
        </div>
        <div className="field">
          <label className="lbl">Note (optional)</label>
          <input style={inputStyle} type="text" name="note" placeholder="e.g. paid by father" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Payment recorded and allocated to the oldest open invoice.</span>}
      </div>
      <div className="sub">
        Applies to the oldest outstanding invoice first. Anything left over after every invoice is
        settled stays as advance credit. Fields marked <span style={{ color: "var(--coral)" }}>*</span> are required.
      </div>
    </form>
  );
}
