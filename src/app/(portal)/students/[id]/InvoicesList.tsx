"use client";
import { Fragment, useState } from "react";
import { taka, fmtDate } from "@/lib/format";

const invoiceStatusMap: Record<string, { cls: string; label: string }> = {
  draft: { cls: "due", label: "Draft" },
  unpaid: { cls: "due", label: "Unpaid" },
  partly_paid: { cls: "part", label: "Partly paid" },
  paid: { cls: "paid", label: "Paid" },
  waived: { cls: "past", label: "Waived" },
  void: { cls: "over", label: "Void" },
};

function StatusChip({ status }: { status: string }) {
  const m = invoiceStatusMap[status] ?? { cls: "due", label: status };
  return (
    <span className={`st ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

const lineTypeLabel: Record<string, string> = {
  admission: "Admission fee",
  tuition: "Tuition",
  discount: "Discount",
  adjustment: "Adjustment",
};

export type InvoiceLine = {
  id: string;
  type: string;
  description: string;
  rate: number;
  quantity: number;
  amount: number;
  enrolment_id?: string | null;
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

export default function InvoicesList({ invoices, outstanding }: { invoices: InvoiceRow[]; outstanding: number }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Invoices — full history</div>
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
              const lines = inv.invoice_line ?? [];
              return (
                <Fragment key={inv.id}>
                  <tr>
                    <td className="mono"><b>{inv.invoice_no}</b></td>
                    <td className="mono sub">{fmtDate(inv.billing_month)}</td>
                    <td className="mono sub">{fmtDate(inv.due_on)}</td>
                    <td className="n mono">{taka(inv.net)}</td>
                    <td className="n mono">{Number(inv.discount) > 0 ? taka(inv.discount) : <span className="sub">—</span>}</td>
                    <td className="n mono">{taka(inv.paid)}</td>
                    <td className="n mono">{taka(inv.balance)}</td>
                    <td className="n">
                      <StatusChip status={inv.status} />
                      {Number(inv.discount) > 0 && <div className="sub" style={{ marginTop: 3 }}>Discounted</div>}
                    </td>
                    <td className="n">
                      {lines.length > 0 && (
                        <button
                          className="btn ghost"
                          type="button"
                          style={{ fontSize: 12, padding: "6px 10px" }}
                          onClick={() => setOpen(isOpen ? null : inv.id)}
                        >
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} style={{ padding: "10px 16px", background: "var(--tint)" }}>
                        <table style={{ width: "100%" }}>
                          <tbody>
                            {lines.map((l) => (
                              <tr key={l.id}>
                                <td className="sub" style={{ width: 110 }}>{lineTypeLabel[l.type] ?? l.type}</td>
                                <td>{l.description}</td>
                                <td className="n mono" style={{ width: 120 }}>
                                  {Number(l.amount) < 0 ? "− " + taka(Math.abs(l.amount)) : taka(l.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {invoices.length === 0 && (
              <tr><td colSpan={9} className="sub">No invoices yet — the monthly billing run will generate one, or run one from Billing.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
