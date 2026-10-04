"use client";
import { Fragment, useCallback, useState } from "react";
import { taka, fmtDate } from "@/lib/format";
import PaymentForm from "./PaymentForm";
import InvoiceEditor, { LINE_LABEL } from "./InvoiceEditor";
import { EditForm, VoidForm, type PaymentRow } from "./PaymentsList";

const invoiceStatusMap: Record<string, { cls: string; label: string }> = {
  draft: { cls: "due", label: "Draft" },
  unpaid: { cls: "due", label: "Unpaid" },
  partly_paid: { cls: "part", label: "Partly paid" },
  paid: { cls: "paid", label: "Paid" },
  waived: { cls: "past", label: "Waived" },
  void: { cls: "over", label: "Void" },
};

const METHOD: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", card: "Card" };

function StatusChip({ status }: { status: string }) {
  const m = invoiceStatusMap[status] ?? { cls: "due", label: status };
  return (
    <span className={`st ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

export type InvoiceLine = {
  id: string;
  type: string;
  description: string;
  rate: number;
  quantity: number;
  amount: number;
  enrolment_id?: string | null;
  applies_to_line_id?: string | null;
};
export type InvoiceRow = {
  id: string;
  invoice_no: string;
  billing_month: string;
  due_on: string;
  gross: number;
  discount: number;
  net: number;
  paid: number;
  balance: number;
  status: string;
  invoice_line?: InvoiceLine[] | null;
};

const money = (n: number) => (Number(n) < 0 ? "− " + taka(Math.abs(Number(n))) : taka(n));

/** One invoice opened up: its charges with their discounts, the payments on it, and (admin)
 * recording a payment against it or editing it. */
function InvoiceDetail({
  studentId, inv, payments, canEdit, canVoid,
}: {
  studentId: string;
  inv: InvoiceRow;
  payments: PaymentRow[];
  canEdit: boolean;
  canVoid: boolean;
}) {
  const [mode, setMode] = useState<"pay" | "edit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [managing, setManaging] = useState<{ id: string; kind: "edit" | "void" } | null>(null);
  const closeMode = useCallback(() => setMode(null), []);
  const paid = useCallback(() => {
    setNotice("Payment recorded.");
    setMode(null);
  }, []);
  const onSaved = useCallback((m: string) => {
    setNotice(m);
    setMode(null);
  }, []);

  const lines = inv.invoice_line ?? [];
  const charges = lines.filter((l) => l.type !== "discount");
  const loose = lines.filter((l) => l.type === "discount" && !charges.some((c) => c.id === l.applies_to_line_id));
  const onThis = payments
    .map((p) => ({ p, applied: (p.payment_allocation ?? []).filter((a) => a.invoice_id === inv.id).reduce((s, a) => s + Number(a.amount), 0) }))
    .filter((x) => x.applied > 0 && x.p.status === "confirmed");
  const editable = canEdit && inv.status !== "void";

  return (
    <div className="inv-detail">
      {mode === "edit" ? (
        <InvoiceEditor studentId={studentId} invoice={inv} onClose={closeMode} onSaved={onSaved} />
      ) : (
        <>
          <table className="inv-lines">
            <tbody>
              {charges.map((l) => {
                const ds = lines.filter((d) => d.type === "discount" && d.applies_to_line_id === l.id);
                return (
                  <Fragment key={l.id}>
                    <tr>
                      <td className="sub" style={{ width: 120 }}>{LINE_LABEL[l.type] ?? l.type}</td>
                      <td>{l.description}</td>
                      <td className="n mono" style={{ width: 130 }}>{money(l.amount)}</td>
                    </tr>
                    {ds.map((d) => (
                      <tr key={d.id} className="inv-disc">
                        <td></td>
                        <td className="sub">{d.description}</td>
                        <td className="n mono">{money(d.amount)}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {loose.map((d) => (
                <tr key={d.id} className="inv-disc">
                  <td className="sub">Discount</td>
                  <td className="sub">{d.description}</td>
                  <td className="n mono">{money(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="inv-totals">
            <div className="sub">Gross <b className="mono">{taka(inv.gross)}</b></div>
            <div className="sub">Discount <b className="mono">{Number(inv.discount) > 0 ? "− " + taka(inv.discount) : taka(0)}</b></div>
            <div className="sub">Net <b className="mono">{taka(inv.net)}</b></div>
            <div className="sub">Paid <b className="mono" style={{ color: "var(--ok)" }}>{taka(inv.paid)}</b></div>
            <div className="sub">Balance <b className="mono" style={{ color: Number(inv.balance) > 0 ? "var(--crit)" : undefined }}>{taka(inv.balance)}</b></div>
          </div>
        </>
      )}

      <div className="inv-section">
        <div className="lbl">Payments on this invoice</div>
        {onThis.length === 0 ? (
          <div className="sub">No payments yet.</div>
        ) : (
          <table className="inv-lines">
            <tbody>
              {onThis.map(({ p, applied }) => {
                const open = managing?.id === p.id;
                return (
                  <Fragment key={p.id}>
                    <tr>
                      <td className="mono" style={{ width: 120 }}><b>{p.receipt_no}</b></td>
                      <td className="sub">
                        {fmtDate(p.received_on)} · {METHOD[p.method] ?? p.method}
                        {Number(p.amount) !== applied && <> · {taka(applied)} of a {taka(p.amount)} payment</>}
                        {p.note && <> · {p.note}</>}
                      </td>
                      <td className="n mono" style={{ width: 130 }}>{taka(applied)}</td>
                      {(canEdit || canVoid) && (
                        <td className="n" style={{ width: 150, whiteSpace: "nowrap" }}>
                          {canEdit && (
                            <button type="button" className="linkbtn" onClick={() => setManaging(open && managing?.kind === "edit" ? null : { id: p.id, kind: "edit" })}>
                              Edit
                            </button>
                          )}
                          {canVoid && (
                            <button
                              type="button" className="linkbtn" style={{ marginLeft: 10, color: "var(--crit)" }}
                              onClick={() => setManaging(open && managing?.kind === "void" ? null : { id: p.id, kind: "void" })}
                            >
                              Void
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={4} style={{ padding: "8px 0 12px" }}>
                          {managing?.kind === "edit" ? <EditForm studentId={studentId} payment={p} /> : <VoidForm studentId={studentId} payment={p} />}
                          {managing?.kind === "edit" && Number(p.amount) !== applied && (
                            <div className="sub" style={{ marginTop: 6 }}>This corrects the whole {taka(p.amount)} payment, not just the part on this invoice.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {notice && <div className="sub" style={{ color: "var(--ok)" }}>{notice}</div>}

      {editable && mode !== "edit" && (
        <div className="inv-actions">
          {Number(inv.balance) > 0 && (
            <button type="button" className="btn" onClick={() => { setNotice(null); setMode(mode === "pay" ? null : "pay"); }}>
              {mode === "pay" ? "Cancel payment" : "Record payment"}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => { setNotice(null); setMode("edit"); }}>
            Edit invoice
          </button>
        </div>
      )}
      {mode === "pay" && (
        <div className="inv-section">
          <PaymentForm studentId={studentId} invoiceId={inv.id} defaultAmount={Number(inv.balance)} onDone={paid} />
        </div>
      )}
    </div>
  );
}

export default function InvoicesList({
  studentId,
  invoices,
  payments,
  outstanding,
  canEdit,
  canVoid,
  initialOpen,
}: {
  studentId: string;
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  outstanding: number;
  canEdit: boolean;
  canVoid: boolean;
  initialOpen?: string | null;
}) {
  // Open the requested invoice, else the oldest one still owing (that's the one to collect on).
  const firstOwing = [...invoices]
    .filter((i) => (i.status === "unpaid" || i.status === "partly_paid") && Number(i.balance) > 0)
    .sort((a, b) => a.billing_month.localeCompare(b.billing_month))[0];
  const [open, setOpen] = useState<string | null>(
    initialOpen && invoices.some((i) => i.id === initialOpen) ? initialOpen : canEdit ? firstOwing?.id ?? null : null
  );

  return (
    <div className="panel" id="invoices">
      <div className="phead">
        <div className="ptitle">Invoices</div>
        <div className="sub">Open an invoice to record a payment or edit it</div>
        <div className="spacer" />
        <div className="sub">Outstanding: <b style={{ color: outstanding > 0 ? "var(--crit)" : "var(--ok)" }}>{taka(outstanding)}</b></div>
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th><th>Month</th><th>Due</th><th className="n">Net</th>
              <th className="n">Discount</th><th className="n">Paid</th><th className="n">Balance</th>
              <th className="n">Status</th><th className="n"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const isOpen = open === inv.id;
              return (
                <Fragment key={inv.id}>
                  <tr className={isOpen ? "inv-open" : undefined}>
                    <td className="mono"><b>{inv.invoice_no}</b></td>
                    <td className="mono sub">{fmtDate(inv.billing_month)}</td>
                    <td className="mono sub">{fmtDate(inv.due_on)}</td>
                    <td className="n mono">{taka(inv.net)}</td>
                    <td className="n mono">{Number(inv.discount) > 0 ? taka(inv.discount) : <span className="sub">—</span>}</td>
                    <td className="n mono">{taka(inv.paid)}</td>
                    <td className="n mono">{taka(inv.balance)}</td>
                    <td className="n"><StatusChip status={inv.status} /></td>
                    <td className="n" style={{ whiteSpace: "nowrap" }}>
                      <a
                        className="btn ghost"
                        href={`/invoices/${inv.id}?print=1`}
                        target="_blank"
                        rel="noopener"
                        style={{ fontSize: 12, padding: "6px 10px", marginRight: 6 }}
                        title={`Print ${inv.invoice_no}`}
                      >
                        Print
                      </a>
                      <button
                        className={isOpen ? "btn ghost" : canEdit && Number(inv.balance) > 0 && inv.status !== "void" ? "btn" : "btn ghost"}
                        type="button"
                        style={{ fontSize: 12, padding: "6px 10px", whiteSpace: "nowrap" }}
                        onClick={() => setOpen(isOpen ? null : inv.id)}
                      >
                        {isOpen ? "Close" : canEdit && Number(inv.balance) > 0 && inv.status !== "void" ? "Open to pay" : "Open"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0, background: "var(--tint)" }}>
                        <InvoiceDetail studentId={studentId} inv={inv} payments={payments} canEdit={canEdit} canVoid={canVoid} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {invoices.length === 0 && (
              <tr><td colSpan={9} className="sub">No invoices yet. The monthly billing run will generate one, or run one from Billing.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
