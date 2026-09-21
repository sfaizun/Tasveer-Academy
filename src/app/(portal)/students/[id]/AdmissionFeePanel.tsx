"use client";
import { useActionState } from "react";
import { taka } from "@/lib/format";
import { applyAdmissionDiscount } from "./actions";
import type { InvoiceRow } from "./InvoicesList";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit",
};

// Admin-only. Sourced from the invoices already loaded for the student page — no extra
// query. Finds the earliest non-void invoice carrying an admission-type line (mirroring
// fn_apply_admission_discount's own lookup) and any discount already applied to it, and
// lets admin set or clear a one-time discount against that fee. This panel — and the
// admission amount/discount it shows — is never rendered for teachers: it's admin-only by
// the page that includes it, and teachers have no query path to admission data at all
// (invoice/invoice_line have no teacher RLS policy; teacher fee views come from report
// RPCs that are hard-filtered to tuition lines).
export default function AdmissionFeePanel({ studentId, invoices }: { studentId: string; invoices: InvoiceRow[] }) {
  const [state, action, pending] = useActionState(applyAdmissionDiscount, null);

  const admissionInvoice = [...invoices]
    .filter((inv) => inv.status !== "void" && (inv.invoice_line ?? []).some((l) => l.type === "admission"))
    .sort((a, b) => a.billing_month.localeCompare(b.billing_month))[0];

  if (!admissionInvoice) return null;

  const lines = admissionInvoice.invoice_line ?? [];
  const admissionLine = lines.find((l) => l.type === "admission");
  const discountLine = lines.find((l) => l.type === "discount" && l.description?.startsWith("Admission fee discount"));
  const isPaid = admissionInvoice.status === "paid";
  const reasonDefault = discountLine ? discountLine.description.replace(/^Admission fee discount( — )?/, "") : "";

  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Admission fee</div>
        <div className="spacer" />
        <div className="sub">
          {admissionLine ? taka(admissionLine.amount) : "—"}
          {discountLine ? ` — ${taka(Math.abs(discountLine.amount))} discount applied` : ""}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <form action={action} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <input type="hidden" name="student_id" value={studentId} />
          <label className="sub" style={{ whiteSpace: "nowrap" }}>One-time discount:</label>
          <input
            style={{ ...inputStyle, width: 120 }}
            type="number"
            name="amount"
            min="0"
            step="0.01"
            placeholder="e.g. 500"
            defaultValue={discountLine ? Math.abs(discountLine.amount) : ""}
          />
          <input
            style={{ ...inputStyle, width: 200 }}
            type="text"
            name="reason"
            placeholder="Reason (e.g. sibling, early bird)"
            defaultValue={reasonDefault}
          />
          <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? "Saving…" : "Save"}
          </button>
          {discountLine && <span className="sub">Leave the amount blank and save to clear.</span>}
          {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
          {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
        </form>
        {isPaid && !discountLine && (
          <div className="sub" style={{ marginTop: 8, color: "var(--crit)" }}>
            This admission invoice is already fully paid — a discount can no longer be applied to it.
          </div>
        )}
        <div className="sub" style={{ marginTop: 8 }}>
          Applies only to the admission fee. Subject fees have their own per-subject discounts above.
        </div>
      </div>
    </div>
  );
}
