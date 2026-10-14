"use client";
import { taka } from "@/lib/format";

/** A student's invoice, reduced to what the subject/month billing choices need. */
export type InvoiceLite = {
  id: string;
  invoice_no: string;
  billing_month: string; // YYYY-MM-01
  status: string;
  net: number;
  paid: number;
  balance: number;
  enrolment_ids: string[]; // subjects (enrolments) with a tuition line on this invoice
};

export type MonthOption = {
  month: string; // YYYY-MM-01
  invoice: InvoiceLite | null;
  billed: boolean; // this subject is already on that month's invoice
  selectable: boolean; // the subject can be added to that month
  note: string;
};

export const monthKey = (m: string) => m.slice(0, 7) + "-01";

export function addMonths(m: string, n: number): string {
  const [y, mo] = m.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(m: string): string {
  const [y, mo] = m.slice(0, 7).split("-").map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
}

/** Every month from `from` to `to` (inclusive), with what is on file for each. */
export function billingOptions({
  from, to, invoices, current, enrolmentId,
}: {
  from: string;
  to: string;
  invoices: InvoiceLite[];
  current: string;
  enrolmentId?: string;
}): MonthOption[] {
  const out: MonthOption[] = [];
  for (let m = monthKey(from); m <= monthKey(to) && out.length < 60; m = addMonths(m, 1)) {
    const inv = invoices.find((i) => monthKey(i.billing_month) === m) ?? null;
    const billed = !!inv && !!enrolmentId && inv.enrolment_ids.includes(enrolmentId);
    let selectable = true;
    let note = "";
    if (inv?.status === "void") { selectable = false; note = "Invoice is void"; }
    else if (!inv && m >= current) { selectable = false; note = "No invoice yet. Billed when this month's billing is run."; }
    else if (!inv) note = "No invoice for this month. Tick to create one.";
    else if (inv.status === "paid") note = "Already paid. Adding makes it partly paid.";
    else if (inv.status === "partly_paid") note = "Partly paid.";
    else if (inv.status === "waived") note = "Waived invoice.";
    out.push({ month: m, invoice: inv, billed, selectable, note });
  }
  return out;
}

const STATUS_TEXT: Record<string, string> = {
  unpaid: "Unpaid", partly_paid: "Partly paid", paid: "Paid", void: "Void", waived: "Waived", draft: "Draft",
};

/** Ticks per month. `checked` holds the months that should carry the subject. */
export function MonthChecklist({
  options, checked, onChange, rate, mode,
}: {
  options: MonthOption[];
  checked: Set<string>;
  onChange: (next: Set<string>) => void;
  rate?: number;
  mode: "choose" | "edit";
}) {
  const toggle = (m: string, on: boolean) => {
    const next = new Set(checked);
    if (on) next.add(m); else next.delete(m);
    onChange(next);
  };
  const usable = options.filter((o) => (mode === "choose" ? o.selectable && !o.billed : o.selectable || o.billed));
  return (
    <div className="tblwrap" style={{ background: "var(--paper)", borderRadius: 6 }}>
      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }}>
              {mode === "choose" && usable.length > 1 && (
                <input
                  type="checkbox"
                  aria-label="Tick all months"
                  checked={usable.every((o) => checked.has(o.month))}
                  onChange={(e) => onChange(new Set(e.target.checked ? usable.map((o) => o.month) : []))}
                />
              )}
            </th>
            <th>Month</th><th>Invoice</th><th className="n">Invoice total</th><th className="n">Paid</th><th>Note</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => {
            const fixed = mode === "choose" && o.billed; // already on that invoice
            const on = fixed || checked.has(o.month);
            const disabled = fixed || (!o.selectable && !o.billed);
            const change =
              mode === "edit" && on !== o.billed
                ? on
                  ? `Will be added${rate ? ` (+${taka(rate)})` : ""}`
                  : `Will be taken off${o.invoice && o.invoice.paid > 0 ? ". Money already paid moves to the next open invoice, or is kept as advance credit." : ""}`
                : null;
            return (
              <tr key={o.month} style={disabled ? { opacity: 0.6 } : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Bill ${monthLabel(o.month)}`}
                    checked={on}
                    disabled={disabled}
                    onChange={(e) => toggle(o.month, e.target.checked)}
                  />
                </td>
                <td style={{ whiteSpace: "nowrap" }}><b>{monthLabel(o.month)}</b></td>
                <td className="mono sub" style={{ whiteSpace: "nowrap" }}>
                  {o.invoice ? `${o.invoice.invoice_no} · ${STATUS_TEXT[o.invoice.status] ?? o.invoice.status}` : "—"}
                </td>
                <td className="n mono">{o.invoice ? taka(o.invoice.net) : "—"}</td>
                <td className="n mono">{o.invoice ? taka(o.invoice.paid) : "—"}</td>
                <td className="sub">
                  {change ? <b style={{ color: on ? "var(--ok)" : "var(--crit)" }}>{change}</b> : o.billed ? "Already on this invoice" : mode === "edit" ? o.note || "Not on this invoice" : o.note}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
