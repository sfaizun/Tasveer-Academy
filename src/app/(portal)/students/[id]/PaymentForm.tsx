"use client";
import { useActionState, useRef, useEffect } from "react";
import { recordPayment } from "./actions";
import { dhakaTodayISO } from "@/lib/format";
import Req from "@/components/Req";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13.5, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

/** Records a payment. Inside an invoice it settles that invoice first; anything over goes to
 * the oldest open invoice, then stays as advance credit. Discounts are not taken here: they
 * are set per line when editing the invoice, or recurring on the subject. */
export default function PaymentForm({
  studentId,
  invoiceId,
  defaultAmount,
  onDone,
}: {
  studentId: string;
  invoiceId?: string;
  defaultAmount?: number;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(recordPayment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const today = dhakaTodayISO();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="student_id" value={studentId} />
      {invoiceId && <input type="hidden" name="invoice_id" value={invoiceId} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Amount (৳)<Req /></label>
          <input
            style={inputStyle}
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            required
            defaultValue={defaultAmount && defaultAmount > 0 ? defaultAmount : undefined}
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
          <input style={inputStyle} type="date" name="received_on" defaultValue={today} max={today} required />
        </div>
        <div className="field">
          <label className="lbl">Note (optional)</label>
          <input style={inputStyle} type="text" name="note" placeholder="e.g. paid by father" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Payment recorded.</span>}
      </div>
      <div className="sub">
        {invoiceId
          ? "Settles this invoice first. Anything over goes to the oldest open invoice, then stays as advance credit."
          : "Goes to the oldest open invoice first. Anything left over stays as advance credit and is used on the next invoice."}
      </div>
    </form>
  );
}
