"use client";
import { Fragment, useActionState, useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import { fileSize } from "@/lib/files";
import { removeHomework, reviewHomework } from "./actions";

export type HomeworkRow = {
  id: string;
  homework_date: string;
  title: string;
  note: string | null;
  student_name: string;
  reg_no: string | null;
  subject_batch: string;
  teacher_name: string | null;
  status: "submitted" | "reviewed";
  teacher_comment: string | null;
  submitted_at: string;
  files: { id: string; name: string; size: number | null }[];
};

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

export function Review({ row, onDone }: { row: HomeworkRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(reviewHomework, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
      <input type="hidden" name="id" value={row.id} />
      <label className="lbl" htmlFor={`hw-c-${row.id}`}>Comment for {row.student_name.split(" ")[0]} (optional)</label>
      <textarea id={`hw-c-${row.id}`} name="comment" rows={3} maxLength={2000} defaultValue={row.teacher_comment ?? ""} style={{ ...input, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" type="submit" name="reviewed" value="1" disabled={pending}>{row.status === "reviewed" ? "Save comment" : "Mark reviewed"}</button>
        {row.status === "reviewed" && (
          <button className="btn ghost" type="submit" name="reviewed" value="0" disabled={pending}>Move back to submitted</button>
        )}
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}

function Remove({ id, onCancel }: { id: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(removeHomework, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={id} />
      <span className="sub">Remove it?</span>
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>{pending ? "Removing…" : "Yes, remove"}</button>
      <button className="btn ghost" type="button" onClick={onCancel} style={{ fontSize: 12, padding: "5px 10px" }}>No</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

/** Homework list. Students can remove their own until it is reviewed; the subject teacher (or an
 * admin who can edit Homework) marks it reviewed with a comment. */
export default function HomeworkList({ rows, showStudent, showTeacher, canReview, canRemoveOwn }: {
  rows: HomeworkRow[]; showStudent: boolean; showTeacher: boolean; canReview: boolean; canRemoveOwn: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const hasActions = canReview || canRemoveOwn;
  const cols = 5 + (showStudent ? 1 : 0) + (showTeacher ? 1 : 0) + (hasActions ? 1 : 0);
  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th>Homework</th><th>Date</th>{showStudent && <th>Student</th>}<th>Subject and batch</th>{showTeacher && <th>Teacher</th>}
            <th>Files</th><th>Status</th>{hasActions && <th className="n"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td>
                  <b style={{ color: "var(--ink)" }}>{r.title}</b>
                  {r.note && <div className="sub" style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{r.note}</div>}
                </td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.homework_date)}</td>
                {showStudent && <td>{r.student_name}{r.reg_no && <div className="sub mono">{r.reg_no}</div>}</td>}
                <td>{r.subject_batch}</td>
                {showTeacher && <td>{r.teacher_name ?? <span className="sub">-</span>}</td>}
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {r.files.map((f) => (
                      <span key={f.id} style={{ fontSize: 12.5 }}>
                        <a href={`/homework/file/${f.id}`} target="_blank" rel="noopener">{f.name}</a>
                        {" "}<span className="sub">{fileSize(f.size)}</span>
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  {r.status === "reviewed"
                    ? <span className="st paid"><span className="dot" />Reviewed</span>
                    : <span className="st part"><span className="dot" />Submitted</span>}
                  {r.teacher_comment && <div style={{ fontSize: 12.5, marginTop: 4, whiteSpace: "pre-wrap" }}>&ldquo;{r.teacher_comment}&rdquo;</div>}
                </td>
                {hasActions && (
                  <td className="n" style={{ whiteSpace: "nowrap" }}>
                    {canReview && (
                      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                        {open === r.id ? "Close" : r.status === "reviewed" ? "Edit review" : "Review"}
                      </button>
                    )}
                    {canRemoveOwn && r.status === "submitted" && (confirming === r.id
                      ? <Remove id={r.id} onCancel={() => setConfirming(null)} />
                      : <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px", color: "var(--crit)" }} onClick={() => setConfirming(r.id)}>Remove</button>)}
                  </td>
                )}
              </tr>
              {canReview && open === r.id && (
                <tr className="no-print">
                  <td colSpan={cols} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                    <Review row={r} onDone={() => setOpen(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols} className="sub">No homework here yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
