"use client";
import { Fragment, useState } from "react";
import { fmtDate } from "@/lib/format";
import { fmtNum, gradeTone } from "@/lib/grade";
import TestMarkForm, { type MarkRow, type StudentOpt } from "./TestMarkForm";
import { removeTestMark } from "./actions";

const sm: React.CSSProperties = { fontSize: 12, padding: "5px 10px" };

/** Results list with Edit and Delete per row (admin, and teachers for their own students). */
export default function TestMarkTable({
  rows, students, today, showStudent = true, showTeacher = false,
}: {
  rows: MarkRow[];
  students: StudentOpt[];
  today: string;
  showStudent?: boolean;
  showTeacher?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const cols = 8 + (showStudent ? 1 : 0) + (showTeacher ? 1 : 0);
  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {showStudent && <th>Student</th>}
            <th>Subject</th>
            {showTeacher && <th>Teacher</th>}
            <th>Test</th>
            <th className="n">Marks</th>
            <th className="n">%</th>
            <th>Grade</th>
            <th>Attachment</th>
            <th className="n no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.test_date)}</td>
                {showStudent && (
                  <td>
                    <a href={`/test-marks?student=${r.student_id}`} className="no-print" style={{ color: "var(--ink)" }}>{r.student_name}</a>
                    <span className="print-only">{r.student_name}</span>
                    <div className="sub mono" style={{ whiteSpace: "nowrap" }}>{r.reg_no}</div>
                  </td>
                )}
                <td>{r.subject_label}</td>
                {showTeacher && <td className="sub">{r.teacher_name ?? "-"}</td>}
                <td>
                  {r.test_name}
                  {r.remarks && <div className="sub" style={{ whiteSpace: "pre-wrap" }}>{r.remarks}</div>}
                </td>
                <td className="n mono" style={{ whiteSpace: "nowrap" }}>{fmtNum(r.marks)} / {fmtNum(r.out_of)}</td>
                <td className="n mono">{Number(r.percentage).toFixed(2)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className={`grade ${gradeTone(r.grade)}`}>{r.grade}</span>
                  {r.auto_grade && r.auto_grade !== r.grade && <span className="sub" style={{ fontSize: 10, marginLeft: 4 }} title={`Auto grade was ${r.auto_grade}`}>changed</span>}
                </td>
                <td>
                  {r.attachment_name ? (
                    <>
                      <a className="no-print" href={`/test-marks/file/${r.id}`} target="_blank" rel="noopener" title={r.attachment_name} style={{ fontSize: 12.5 }}>View file</a>
                      <span className="print-only" style={{ fontSize: 11 }}>{r.attachment_name}</span>
                    </>
                  ) : <span className="sub">-</span>}
                </td>
                <td className="n no-print" style={{ whiteSpace: "nowrap" }}>
                  {confirming === r.id ? (
                    <form action={removeTestMark} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <span className="sub">Delete{r.attachment_name ? " with its file" : ""}?</span>
                      <button className="btn" type="submit" style={sm}>Yes, delete</button>
                      <button className="btn ghost" type="button" style={sm} onClick={() => setConfirming(null)}>No</button>
                    </form>
                  ) : (
                    <>
                      <button className="btn ghost" type="button" style={sm} onClick={() => setEditing(editing === r.id ? null : r.id)}>
                        {editing === r.id ? "Close" : "Edit"}
                      </button>{" "}
                      <button className="btn ghost" type="button" style={{ ...sm, color: "var(--crit)" }} onClick={() => setConfirming(r.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
              {editing === r.id && (
                <tr className="no-print">
                  <td colSpan={cols} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                    <TestMarkForm students={students} today={today} mark={r} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols} className="sub">No test marks match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
