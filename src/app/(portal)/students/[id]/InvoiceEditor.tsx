"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { taka } from "@/lib/format";
import { editInvoice } from "./actions";
import type { InvoiceLine, InvoiceRow } from "./InvoicesList";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "7px 9px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

export const LINE_LABEL: Record<string, string> = {
  admission: "Admission fee",
  tuition: "Tuition",
  mock: "Mock exam",
  adjustment: "Other charge",
  discount: "Discount",
};

// "Subject discount — sibling" -> "sibling"; matches how the database reads a discount's reason.
export function discountReason(description: string): string | null {
  const i = description.indexOf(" — ");
  return i >= 0 ? description.slice(i + 3) : null;
}

type Row = {
  id: string;
  type: string;
  description: string;
  amount: string;
  disc: string;
  mode: "amt" | "pct";
  reason: string;
  remove: boolean;
  origDisc: number;
  origReason: string;
};
type Add = { key: number; description: string; amount: string };

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Edit one invoice: each charge's amount and discount (৳ or %), remove a charge, add other
 * charges. Paid invoices can be edited too; money already paid beyond the new total moves to
 * the next open invoice or stays as advance credit. */
export default function InvoiceEditor({
  studentId,
  invoice,
  onClose,
  onSaved,
}: {
  studentId: string;
  invoice: InvoiceRow;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(editInvoice, null);
  useEffect(() => {
    if (state?.ok) onSaved(state.message ?? "Saved.");
  }, [state, onSaved]);
  const lines = invoice.invoice_line ?? [];
  const charges = lines.filter((l) => l.type !== "discount");
  const discountsFor = (id: string) => lines.filter((l) => l.type === "discount" && l.applies_to_line_id === id);
  const looseDiscount = lines
    .filter((l) => l.type === "discount" && (!l.applies_to_line_id || !charges.some((c) => c.id === l.applies_to_line_id)))
    .reduce((s, l) => s + Math.abs(Number(l.amount)), 0);

  const [rows, setRows] = useState<Row[]>(() =>
    charges.map((c: InvoiceLine) => {
      const ds = discountsFor(c.id);
      const total = round2(ds.reduce((s, d) => s + Math.abs(Number(d.amount)), 0));
      const reason = ds.map((d) => discountReason(d.description)).filter(Boolean).join("; ");
      return {
        id: c.id, type: c.type, description: c.description,
        amount: String(Number(c.amount)), disc: total ? String(total) : "", mode: "amt",
        reason, remove: false, origDisc: total, origReason: reason,
      };
    })
  );
  const [adds, setAdds] = useState<Add[]>([]);
  const [reason, setReason] = useState("");

  const set = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const discAmount = (r: Row) => {
    const v = num(r.disc);
    return round2(r.mode === "pct" ? (num(r.amount) * v) / 100 : v);
  };

  const totals = useMemo(() => {
    const live = rows.filter((r) => !r.remove);
    const gross = live.reduce((s, r) => s + num(r.amount), 0) + adds.reduce((s, a) => s + num(a.amount), 0);
    const disc = live.reduce((s, r) => s + discAmount(r), 0) + looseDiscount;
    return { gross: round2(gross), disc: round2(disc), net: round2(gross - disc) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, adds, looseDiscount]);
  const paid = Number(invoice.paid);
  const over = round2(paid - Math.max(totals.net, 0));

  const linesPayload = JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      remove: r.remove,
      amount: num(r.amount),
      discount: discAmount(r),
      discount_reason: r.reason.trim(),
      description: r.type === "adjustment" ? r.description : undefined,
    }))
  );
  const addPayload = JSON.stringify(
    adds.filter((a) => a.description.trim() || a.amount).map((a) => ({ description: a.description.trim(), amount: num(a.amount) }))
  );

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="invoice_id" value={invoice.id} />
      <input type="hidden" name="lines" value={linesPayload} />
      <input type="hidden" name="add" value={addPayload} />

      <div className="tblwrap">
        <table className="inv-edit">
          <thead>
            <tr>
              <th>Item</th>
              <th className="n" style={{ width: 120 }}>Amount (৳)</th>
              <th style={{ width: 190 }}>Discount</th>
              <th>Discount reason</th>
              <th className="n" style={{ width: 70 }}>Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = discAmount(r);
              const discChanged = d !== r.origDisc || (d > 0 && r.reason.trim() !== r.origReason);
              return (
                <tr key={r.id} style={r.remove ? { opacity: 0.45 } : undefined}>
                  <td>
                    <div className="sub" style={{ fontSize: 11 }}>{LINE_LABEL[r.type] ?? r.type}</div>
                    {r.type === "adjustment" ? (
                      <input style={inputStyle} value={r.description} disabled={r.remove} onChange={(e) => set(r.id, { description: e.target.value })} />
                    ) : (
                      <b style={{ color: "var(--ink)", fontWeight: 500 }}>{r.description}</b>
                    )}
                    {r.type === "tuition" && !r.remove && (
                      <div className="sub" style={{ fontSize: 11, marginTop: 2 }}>
                        Changes here are for this invoice only. For every month, set the discount on the subject.
                      </div>
                    )}
                    {r.type === "mock" && r.remove && (
                      <div className="sub" style={{ fontSize: 11, marginTop: 2, color: "var(--crit)" }}>
                        The student will be withdrawn from this mock exam.
                      </div>
                    )}
                  </td>
                  <td className="n">
                    <input
                      style={{ ...inputStyle, textAlign: "right" }} type="number" min="0.01" step="0.01"
                      value={r.amount} disabled={r.remove} aria-label={`Amount for ${r.description}`}
                      onChange={(e) => set(r.id, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        style={{ ...inputStyle, textAlign: "right" }} type="number" min="0" step="0.01"
                        value={r.disc} disabled={r.remove} placeholder="0" aria-label={`Discount for ${r.description}`}
                        onChange={(e) => set(r.id, { disc: e.target.value })}
                      />
                      <select
                        style={{ ...inputStyle, width: 62 }} value={r.mode} disabled={r.remove} aria-label="Discount type"
                        onChange={(e) => set(r.id, { mode: e.target.value as Row["mode"] })}
                      >
                        <option value="amt">৳</option>
                        <option value="pct">%</option>
                      </select>
                    </div>
                    {r.mode === "pct" && d > 0 && <div className="sub" style={{ fontSize: 11, marginTop: 2 }}>= {taka(d)}</div>}
                  </td>
                  <td>
                    <input
                      style={inputStyle} value={r.reason} disabled={r.remove || d <= 0}
                      placeholder={d > 0 ? "Required" : "No discount"}
                      required={!r.remove && d > 0 && discChanged}
                      onChange={(e) => set(r.id, { reason: e.target.value })}
                    />
                  </td>
                  <td className="n">
                    <input type="checkbox" checked={r.remove} aria-label={`Remove ${r.description}`} onChange={(e) => set(r.id, { remove: e.target.checked })} />
                  </td>
                </tr>
              );
            })}
            {adds.map((a) => (
              <tr key={a.key}>
                <td>
                  <div className="sub" style={{ fontSize: 11 }}>New charge</div>
                  <input
                    style={inputStyle} value={a.description} placeholder="e.g. Books, late fee" required
                    onChange={(e) => setAdds((as) => as.map((x) => (x.key === a.key ? { ...x, description: e.target.value } : x)))}
                  />
                </td>
                <td className="n">
                  <input
                    style={{ ...inputStyle, textAlign: "right" }} type="number" min="0.01" step="0.01" required value={a.amount}
                    onChange={(e) => setAdds((as) => as.map((x) => (x.key === a.key ? { ...x, amount: e.target.value } : x)))}
                  />
                </td>
                <td colSpan={2} className="sub" style={{ fontSize: 11 }}>Save first, then edit again to discount it.</td>
                <td className="n">
                  <button type="button" className="linkbtn" onClick={() => setAdds((as) => as.filter((x) => x.key !== a.key))}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button
          type="button" className="btn ghost" style={{ fontSize: 12, padding: "6px 10px" }}
          onClick={() => setAdds((as) => [...as, { key: Date.now(), description: "", amount: "" }])}
        >
          + Add a charge
        </button>
      </div>

      <div className="inv-totals">
        <div className="sub">Gross <b className="mono">{taka(totals.gross)}</b></div>
        <div className="sub">Discount <b className="mono">{totals.disc > 0 ? "− " + taka(totals.disc) : taka(0)}</b></div>
        <div className="sub">New total <b className="mono">{taka(totals.net)}</b></div>
        <div className="sub">Paid so far <b className="mono">{taka(paid)}</b></div>
        <div className="sub">New balance <b className="mono">{taka(Math.max(totals.net - paid, 0))}</b></div>
      </div>
      {over > 0 && (
        <div className="sub" style={{ color: "var(--warn)" }}>
          {taka(over)} already paid is more than the new total. It will move to the next open invoice, or be kept as
          advance credit for the next one.
        </div>
      )}
      {totals.net < 0 && <div className="sub" style={{ color: "var(--crit)" }}>Discounts are more than the charges.</div>}

      <div className="field">
        <label className="lbl" htmlFor={`rsn-${invoice.id}`}>Reason for this change<span style={{ color: "var(--coral)" }}> *</span></label>
        <input
          id={`rsn-${invoice.id}`} style={{ ...inputStyle, padding: "9px 11px" }} required value={reason}
          placeholder="e.g. wrong amount entered, sibling discount agreed"
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <input type="hidden" name="reason" value={reason} />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending || totals.net < 0}>{pending ? "Saving…" : "Save changes"}</button>
        <button className="btn ghost" type="button" onClick={onClose}>Close</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
      <div className="sub">Every change is kept in the Audit log with this reason.</div>
    </form>
  );
}
