"use client";
import { Fragment, useActionState, useState } from "react";
import { taka, fmtDate, dhakaTodayISO } from "@/lib/format";
import { editPayment, voidPayment } from "./actions";

export type PaymentRow = {
  id: string;
  receipt_no: string;
  amount: number;
  method: string;
  received_on: string;
  status: string;
  note: string | null;
  void_reason: string | null;
  payment_allocation?: { invoice_id: string; amount: number }[] | null;
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

function StatusChip({ status }: { status: string }) {
  if (status === "void") return <span className="st over"><span className="dot" />Void</span>;
  return <span className="st paid"><span className="dot" />Confirmed</span>;
}

function EditForm({ studentId, payment }: { studentId: string; payment: PaymentRow }) {
  const [state, action, pending] = useActionState(editPayment, null);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="payment_id" value={payment.id} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
        <input style={inputStyle} type="number" name="amount" min="1" step="1" defaultValue={payment.amount} required />
        <select style={inputStyle} name="method" defaultValue={payment.method}>
          <option value="cash">Cash</option>
          <option value="bkash">bKash</option>
          <option value="nagad">Nagad</option>
          <option value="bank">Bank</option>
          <option value="card">Card</option>
        </select>
        <input style={inputStyle} type="date" name="received_on" defaultValue={payment.received_on} max={dhakaTodayISO()} />
        <input style={inputStyle} type="text" name="note" defaultValue={payment.note ?? ""} placeholder="Note" />
      </div>
      <input style={inputStyle} type="text" name="reason" placeholder="Reason for this correction (required)" required />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12 }}>
          {pending ? "Saving…" : "Save correction"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Corrected.</span>}
      </div>
    </form>
  );
}

function VoidForm({ studentId, payment }: { studentId: string; payment: PaymentRow }) {
  const [state, action, pending] = useActionState(voidPayment, null);
  return (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="payment_id" value={payment.id} />
      <input style={{ ...inputStyle, minWidth: 220, flex: "1 1 220px" }} type="text" name="reason" placeholder="Reason for voiding (required)" required />
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, color: "var(--crit)" }}>
        {pending ? "Voiding…" : "Void this payment"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

export default function PaymentsList({
  studentId,
  payments,
  canEdit,
  canVoid,
}: {
  studentId: string;
  payments: PaymentRow[];
  canEdit: boolean;
  canVoid: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "void" | null>(null);

  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Date</th>
            <th>Method</th>
            <th className="n">Amount</th>
            <th className="n">Status</th>
            <th className="n"></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const isOpen = open === p.id;
            return (
              <Fragment key={p.id}>
                <tr>
                  <td className="mono"><b>{p.receipt_no}</b></td>
                  <td className="mono sub">{fmtDate(p.received_on)}</td>
                  <td className="sub">{p.method}</td>
                  <td className="n mono">{taka(p.amount)}</td>
                  <td className="n"><StatusChip status={p.status} /></td>
                  <td className="n">
                    {(canEdit || canVoid) && p.status === "confirmed" && (
                      <button
                        className="btn ghost"
                        type="button"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={() => {
                          setOpen(isOpen ? null : p.id);
                          setMode(null);
                        }}
                      >
                        {isOpen ? "Close" : "Manage"}
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={6} style={{ padding: "12px 16px", background: "var(--tint)" }}>
                      {p.note && <div className="sub" style={{ marginBottom: 8 }}>Note: {p.note}</div>}
                      {p.void_reason && (
                        <div className="sub" style={{ marginBottom: 8, color: "var(--crit)" }}>
                          Voided: {p.void_reason}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                        {canEdit && (
                          <button className="btn ghost" type="button" style={{ fontSize: 12 }} onClick={() => setMode(mode === "edit" ? null : "edit")}>
                            Correct amount / method / date
                          </button>
                        )}
                        {canVoid && (
                          <button className="btn ghost" type="button" style={{ fontSize: 12, color: "var(--crit)" }} onClick={() => setMode(mode === "void" ? null : "void")}>
                            Void payment
                          </button>
                        )}
                      </div>
                      {mode === "edit" && <EditForm studentId={studentId} payment={p} />}
                      {mode === "void" && <VoidForm studentId={studentId} payment={p} />}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {payments.length === 0 && (
            <tr>
              <td colSpan={6} className="sub">No payments recorded yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
