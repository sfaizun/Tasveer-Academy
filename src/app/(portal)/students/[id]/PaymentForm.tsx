"use client";
import { useActionState, useRef, useEffect, useMemo, useState } from "react";
import { recordPayment } from "./actions";
import { taka, fmtDate, dhakaTodayISO } from "@/lib/format";
import Req from "@/components/Req";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "10px 12px",
  fontSize: 14, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

export type DiscountableFee = { line_id: string; label: string; left: number; kind: "admission" | "subject" | "other" };
export type OpenInvoice = { id: string; invoice_no: string; billing_month: string; balance: number; fees: DiscountableFee[] };

export default function PaymentForm({
  studentId,
  outstanding,
  openInvoices,
}: {
  studentId: string;
  outstanding: number;
  openInvoices: OpenInvoice[];
}) {
  const [state, action, pending] = useActionState(recordPayment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [withDiscount, setWithDiscount] = useState(false);
  const [discountInvoiceId, setDiscountInvoiceId] = useState("");
  const [discountLineId, setDiscountLineId] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const today = dhakaTodayISO();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setWithDiscount(false);
      setDiscountInvoiceId("");
      setDiscountLineId("");
      setDiscountAmount("");
    }
  }, [state]);

  const selectedInvoice = useMemo(
    () => openInvoices.find((inv) => inv.id === discountInvoiceId) ?? null,
    [discountInvoiceId, openInvoices]
  );
  const selectedFee = selectedInvoice?.fees.find((f) => f.line_id === discountLineId) ?? null;
  const discountNum = Number(discountAmount) || 0;
  const toCoverInvoice = selectedInvoice ? Math.max(selectedInvoice.balance - discountNum, 0) : null;

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
          <input style={inputStyle} type="date" name="received_on" defaultValue={today} max={today} required />
        </div>
        <div className="field">
          <label className="lbl">Note (optional)</label>
          <input style={inputStyle} type="text" name="note" placeholder="e.g. paid by father" />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: openInvoices.length ? "pointer" : "not-allowed" }}>
        <input
          type="checkbox"
          checked={withDiscount}
          disabled={!openInvoices.length}
          onChange={(e) => setWithDiscount(e.target.checked)}
        />
        Apply a discount on this payment
      </label>

      {withDiscount && (
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12,
            padding: 12, borderRadius: 8, background: "var(--tint)", border: "1px solid var(--line)",
          }}
        >
          <div className="field">
            <label className="lbl">Invoice<Req /></label>
            <select
              style={inputStyle}
              name="discount_invoice_id"
              required
              value={discountInvoiceId}
              onChange={(e) => {
                setDiscountInvoiceId(e.target.value);
                setDiscountLineId("");
              }}
            >
              <option value="" disabled>Choose…</option>
              {openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_no} — {fmtDate(inv.billing_month)} (balance {taka(inv.balance)})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Discount on<Req /></label>
            <select
              style={inputStyle}
              name="discount_line_id"
              required
              disabled={!selectedInvoice}
              value={discountLineId}
              onChange={(e) => setDiscountLineId(e.target.value)}
            >
              <option value="" disabled>
                {!selectedInvoice
                  ? "Choose an invoice first"
                  : selectedInvoice.fees.length
                    ? "Choose admission or a subject…"
                    : "Nothing left to discount on this invoice"}
              </option>
              {(selectedInvoice?.fees ?? []).map((f) => (
                <option key={f.line_id} value={f.line_id}>
                  {f.label} ({taka(f.left)} left)
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Discount amount (৳)<Req /></label>
            <input
              style={inputStyle}
              type="number"
              name="discount_amount"
              min="1"
              max={selectedFee ? selectedFee.left : undefined}
              step="1"
              required
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label className="lbl">Reason for discount<Req /></label>
            <input style={inputStyle} type="text" name="discount_note" placeholder="e.g. sibling discount, hardship" required />
          </div>
          <div className="sub" style={{ gridColumn: "1 / -1" }}>
            {selectedFee?.kind === "admission" && "Counts as an admission discount. It never affects any teacher's figures. "}
            {selectedFee?.kind === "subject" &&
              `Counts as a subject discount on ${selectedFee.label}, so it comes off that subject's teacher figures only. `}
            {selectedFee?.kind === "other" && `Comes off ${selectedFee.label} only. `}
            {selectedInvoice
              ? `This invoice is settled the moment the payment plus the discount cover its ${taka(selectedInvoice.balance)} balance — pay at least ${taka(toCoverInvoice ?? 0)} to mark it fully paid now.`
              : "The discounted amount is recorded on the invoice — it's settled the moment the payment plus the discount cover its balance."}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Payment recorded and allocated to the oldest open invoice.</span>}
      </div>
      <div className="sub">
        Applies to the discounted invoice first (if any), then the oldest outstanding invoice.
        Anything left over after every invoice is settled stays as advance credit. Fields marked{" "}
        <span style={{ color: "var(--coral)" }}>*</span> are required.
      </div>
    </form>
  );
}
