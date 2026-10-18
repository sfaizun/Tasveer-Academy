"use client";
import { Fragment, useState } from "react";
import { fmtDate, taka } from "@/lib/format";
import IncomeForm, { type IncomeRow } from "./IncomeForm";
import { removeIncome } from "./actions";

/** The filtered income list with Edit and Remove per row (admin). */
export default function IncomeTable({ rows, today }: { rows: IncomeRow[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr><th>Date</th><th>Details</th><th>Attachment</th><th className="n">Amount</th><th className="n no-print"></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.income_date)}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{r.details}</td>
                <td>
                  {r.attachment_name ? (
                    <>
                      <a className="no-print" href={`/income/file/${r.id}`} target="_blank" rel="noopener" title={r.attachment_name} style={{ fontSize: 12.5 }}>
                        View file
                      </a>
                      <span className="print-only" style={{ fontSize: 11 }}>{r.attachment_name}</span>
                    </>
                  ) : <span className="sub">-</span>}
                </td>
                <td className="n mono">{taka(r.amount)}</td>
                <td className="n no-print" style={{ whiteSpace: "nowrap" }}>
                  {confirming === r.id ? (
                    <form action={removeIncome} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <span className="sub">Remove?</span>
                      <button className="btn" type="submit" style={{ fontSize: 12, padding: "5px 10px" }}>Yes, remove</button>
                      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setConfirming(null)}>No</button>
                    </form>
                  ) : (
                    <>
                      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setEditing(editing === r.id ? null : r.id)}>
                        {editing === r.id ? "Close" : "Edit"}
                      </button>{" "}
                      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px", color: "var(--crit)" }} onClick={() => setConfirming(r.id)}>
                        Remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
              {editing === r.id && (
                <tr className="no-print">
                  <td colSpan={5} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                    <IncomeForm today={today} income={r} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="sub">No income recorded for these dates.</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={3}><b style={{ color: "var(--ink)" }}>Total</b></td>
              <td className="n mono"><b style={{ color: "var(--ink)" }}>{taka(total)}</b></td>
              <td className="no-print"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
