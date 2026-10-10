"use client";
import { Fragment, useState } from "react";
import { fmtDate, taka } from "@/lib/format";
import ExpenseForm, { type ExpenseRow, type TeacherOpt } from "./ExpenseForm";
import { removeExpense } from "./actions";

/** The filtered expenses list with Edit and Remove per row (admin). */
export default function ExpenseTable({
  rows, teachers, today,
}: {
  rows: (ExpenseRow & { teacher_name: string | null })[];
  teachers: TeacherOpt[];
  today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr><th>Date</th><th>For</th><th>Teacher</th><th>Details</th><th className="n">Amount</th><th className="n no-print"></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.expense_date)}</td>
                <td>
                  <span className={`st ${r.expense_for === "office" ? "part" : "due"}`}><span className="dot" />{r.expense_for === "office" ? "Office" : "Teacher"}</span>
                </td>
                <td>{r.teacher_name ?? <span className="sub">-</span>}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{r.details}</td>
                <td className="n mono">{taka(r.amount)}</td>
                <td className="n no-print" style={{ whiteSpace: "nowrap" }}>
                  {confirming === r.id ? (
                    <form action={removeExpense} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
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
                  <td colSpan={6} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                    <ExpenseForm teachers={teachers} today={today} expense={r} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="sub">No expenses match these filters.</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={4}><b style={{ color: "var(--ink)" }}>Total</b></td>
              <td className="n mono"><b style={{ color: "var(--ink)" }}>{taka(total)}</b></td>
              <td className="no-print"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
