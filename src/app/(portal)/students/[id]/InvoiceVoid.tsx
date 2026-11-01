"use client";
import { useActionState, useEffect } from "react";
import { restoreInvoice, voidInvoice } from "./actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", flex: "1 1 240px",
};

/** Owner: void this invoice (reason required) or, when it is void, restore it. */
export default function InvoiceVoid({ studentId, invoiceId, invoiceNo, mode, onDone, onCancel }: {
  studentId: string; invoiceId: string; invoiceNo: string; mode: "void" | "restore";
  onDone: (message: string) => void; onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(mode === "void" ? voidInvoice : restoreInvoice, null);
  useEffect(() => {
    if (state?.ok) onDone(state.message ?? "Saved.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <div className="sub">
        {mode === "void"
          ? `Voiding ${invoiceNo} cancels all its fees: it will owe nothing and the billing run will not bill this month again. The invoice stays on record, marked Void.`
          : `Restoring ${invoiceNo} makes its fees owed again.`}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input name="reason" required maxLength={500} placeholder={mode === "void" ? "Reason for voiding (required)" : "Reason for restoring (required)"} aria-label="Reason" style={input} />
        <button className="btn" type="submit" disabled={pending} style={mode === "void" ? { background: "var(--crit)", borderColor: "var(--crit)" } : undefined}>
          {pending ? "Saving…" : mode === "void" ? "Void invoice" : "Restore invoice"}
        </button>
        <button className="btn ghost" type="button" onClick={onCancel}>Keep as is</button>
      </div>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}
