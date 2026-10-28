"use client";
import { Fragment, useActionState, useEffect, useState } from "react";
import { dhakaTodayISO, fmtDate, taka } from "@/lib/format";
import { recordRefund, voidRefund } from "./actions";

/** A fee on an invoice that money was received for, with what can still be given back. */
export type RefundItem = {
  invoice_id: string;
  line_id: string;
  type: string;
  description: string;
  teacher_name: string | null;
  received: number;
  refunded: number;
  refundable: number;
  ord: number;
};

export type RefundRow = {
  id: string;
  refund_no: string;
  invoice_id: string;
  refunded_on: string;
  method: string;
  amount: number;
  reason: string;
  status: string;
  void_reason: string | null;
  refund_line?: { invoice_line_id: string; amount: number }[] | null;
};

const METHOD: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", card: "Card" };
const TYPE: Record<string, string> = { tuition: "Subject fee", admission: "Admission fee", mock: "Mock exam fee", adjustment: "Other charge" };

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Tick the fees to give back; each amount fills in with what was paid on it and can be lowered
 * for a part refund. Admission fees come off office income, subject and mock fees off the
 * teacher's collection, in the month of the refund. */
export function RefundForm({ studentId, invoiceId, items, onDone }: {
  studentId: string; invoiceId: string; items: RefundItem[]; onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(recordRefund, null);
  const [ticked, setTicked] = useState<Record<string, string>>({});
  useEffect(() => {
    if (state?.ok) onDone(state.message ?? "Refund recorded.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const open = items.filter((i) => i.refundable > 0);
  const total = Object.entries(ticked).reduce((n, [, v]) => n + (Number(v) || 0), 0);
  const over = open.find((i) => i.line_id in ticked && Number(ticked[i.line_id]) > i.refundable);

  if (!open.length) return <div className="sub">Nothing on this invoice has been paid that can be refunded.</div>;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <div className="lbl">Tick what is being refunded</div>
      <div className="tblwrap keep-table">
        <table className="inv-lines">
          <thead>
            <tr><th style={{ width: 36 }}></th><th>Fee</th><th className="n">Paid</th><th className="n">Refunded before</th><th className="n" style={{ width: 150 }}>Refund now</th></tr>
          </thead>
          <tbody>
            {open.map((i) => {
              const on = i.line_id in ticked;
              const id = `rf-${i.line_id}`;
              return (
                <tr key={i.line_id}>
                  <td>
                    <input
                      id={id} type="checkbox" name="line_ids" value={i.line_id} checked={on}
                      onChange={(e) => setTicked((t) => {
                        const n = { ...t };
                        if (e.target.checked) n[i.line_id] = String(i.refundable);
                        else delete n[i.line_id];
                        return n;
                      })}
                      style={{ width: 18, height: 18 }}
                    />
                  </td>
                  <td>
                    <label htmlFor={id} style={{ cursor: "pointer" }}>
                      {i.description}
                      <span className="sub" style={{ display: "block", fontSize: 11.5 }}>
                        {TYPE[i.type] ?? i.type}
                        {i.type === "admission" || i.type === "adjustment" ? " · comes off office income" : i.teacher_name ? ` · comes off ${i.teacher_name}'s fee` : ""}
                      </span>
                    </label>
                  </td>
                  <td className="n mono">{taka(i.received)}</td>
                  <td className="n mono">{i.refunded > 0 ? taka(i.refunded) : <span className="sub">—</span>}</td>
                  <td className="n">
                    {on ? (
                      <input
                        name={`amount_${i.line_id}`} type="number" min="0.01" step="0.01" max={i.refundable}
                        value={ticked[i.line_id]} onChange={(e) => setTicked((t) => ({ ...t, [i.line_id]: e.target.value }))}
                        aria-label={`Refund amount for ${i.description}`} style={{ ...input, textAlign: "right", maxWidth: 140 }} required
                      />
                    ) : (
                      <span className="sub">up to {taka(i.refundable)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        <div className="field">
          <label className="lbl" htmlFor={`rf-method-${invoiceId}`}>Given back by</label>
          <select id={`rf-method-${invoiceId}`} name="method" defaultValue="cash" style={input}>
            {Object.entries(METHOD).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`rf-date-${invoiceId}`}>Refund date</label>
          <input id={`rf-date-${invoiceId}`} type="date" name="refunded_on" defaultValue={dhakaTodayISO()} max={dhakaTodayISO()} style={input} required />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`rf-reason-${invoiceId}`}>Reason</label>
          <input id={`rf-reason-${invoiceId}`} name="reason" maxLength={500} placeholder="e.g. Dropped Physics from October" style={input} required />
        </div>
      </div>
      <div className="sub">
        The refunded amount is taken off the invoice (the fee is cancelled, so the balance does not change) and deducted
        in the month of the refund: admission fees from office income, subject and mock fees from the teacher&apos;s fee.
        Earlier months are not changed.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending || total <= 0 || !!over}>
          {pending ? "Saving…" : `Refund ${taka(Math.round(total * 100) / 100)}`}
        </button>
        {over && <span className="sub" style={{ color: "var(--crit)" }}>{over.description} can be refunded up to {taka(over.refundable)}.</span>}
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}

function CancelRefund({ studentId, refundId, onCancel }: { studentId: string; refundId: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(voidRefund, null);
  return (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="refund_id" value={refundId} />
      <input name="reason" placeholder="Reason for cancelling (required)" required maxLength={500} style={{ ...input, flex: "1 1 220px", width: "auto" }} aria-label="Reason for cancelling" />
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, color: "var(--crit)" }}>{pending ? "Cancelling…" : "Cancel refund"}</button>
      <button className="btn ghost" type="button" onClick={onCancel} style={{ fontSize: 12 }}>Keep</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

/** The refunds given on one invoice. The owner can cancel one recorded by mistake. */
export function RefundsList({ studentId, refunds, lineName, canVoid }: {
  studentId: string; refunds: RefundRow[]; lineName: (id: string) => string; canVoid: boolean;
}) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  if (!refunds.length) return null;
  return (
    <div className="inv-section">
      <div className="lbl">Refunds on this invoice</div>
      <table className="inv-lines">
        <tbody>
          {refunds.map((r) => {
            const off = r.status === "void";
            return (
              <Fragment key={r.id}>
                <tr style={off ? { opacity: 0.6 } : undefined}>
                  <td className="mono" style={{ width: 120 }}><b>{r.refund_no}</b></td>
                  <td className="sub">
                    {fmtDate(r.refunded_on)} · {METHOD[r.method] ?? r.method} · {r.reason}
                    <div style={{ fontSize: 11.5 }}>
                      {(r.refund_line ?? []).map((l) => `${lineName(l.invoice_line_id)} ${taka(l.amount)}`).join(", ")}
                    </div>
                    {off && <div style={{ color: "var(--crit)", fontSize: 11.5 }}>Cancelled{r.void_reason ? `: ${r.void_reason}` : ""}</div>}
                  </td>
                  <td className="n mono" style={{ width: 130, textDecoration: off ? "line-through" : undefined }}>− {taka(r.amount)}</td>
                  {canVoid && (
                    <td className="n" style={{ width: 150 }}>
                      {!off && (
                        <button type="button" className="linkbtn" style={{ color: "var(--crit)" }} onClick={() => setCancelling(cancelling === r.id ? null : r.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {cancelling === r.id && (
                  <tr><td colSpan={4} style={{ padding: "6px 0 12px" }}><CancelRefund studentId={studentId} refundId={r.id} onCancel={() => setCancelling(null)} /></td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
