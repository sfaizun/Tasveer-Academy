"use client";
import { Fragment, useActionState, useState } from "react";
import { taka } from "@/lib/format";
import { EXAM_STATUS, subjectLabel, type MockExam } from "@/lib/mock";
import { teacherUpdateMockExam } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** A teacher's own mock exams: they can change the series name, the note and whether
 * registration is open. Subject, fee and teacher stay with admin. */
function EditRow({ exam }: { exam: MockExam }) {
  const [state, action, pending] = useActionState(teacherUpdateMockExam, null);
  return (
    <form action={action} style={{ padding: "12px 16px", display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", alignItems: "end" }}>
      <input type="hidden" name="id" value={exam.id} />
      <div className="field">
        <label className="lbl">Series</label>
        <input style={inputStyle} name="series" required defaultValue={exam.series} />
      </div>
      <div className="field">
        <label className="lbl">Registration</label>
        <select style={inputStyle} name="status" defaultValue={exam.status}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label className="lbl">Note</label>
        <input style={inputStyle} name="note" defaultValue={exam.note ?? ""} placeholder="Optional, e.g. Paper 1 and Paper 2, bring a calculator" />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
      </div>
    </form>
  );
}

export default function TeacherMockList({ exams }: { exams: MockExam[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (exams.length === 0) {
    return <div className="panel sub" style={{ padding: 16 }}>No mock exams are assigned to you yet. Admin assigns a teacher to each exam.</div>;
  }
  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Your mock exams</div>
        <div className="sub">You can change the series name, the note and whether registration is open. The fee is set by admin.</div>
      </div>
      <div className="tblwrap">
        <table>
          <thead><tr><th>Subject</th><th>Series</th><th className="n">Fee</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {exams.map((e) => {
              const st = EXAM_STATUS[e.status];
              const isOpen = open === e.id;
              return (
                <Fragment key={e.id}>
                  <tr>
                    <td><b style={{ color: "var(--ink)" }}>{subjectLabel(e.subject)}</b>{e.note && <div className="sub">{e.note}</div>}</td>
                    <td className="sub">{e.series}</td>
                    <td className="n mono">{taka(e.fee)}</td>
                    <td style={{ whiteSpace: "nowrap" }}><span className={`st ${st.cls}`}><span className="dot" />{st.text}</span></td>
                    <td className="n">
                      {e.status !== "cancelled" && (
                        <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setOpen(isOpen ? null : e.id)}>
                          {isOpen ? "Close" : "Edit"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0, background: "var(--tint)" }}><EditRow exam={e} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
