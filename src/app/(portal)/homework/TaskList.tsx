"use client";
import { Fragment, useActionState, useState } from "react";
import { fmtDate } from "@/lib/format";
import { fileSize } from "@/lib/files";
import TaskForm, { type BatchOpt, type TaskFile } from "./TaskForm";
import { Review, type HomeworkRow } from "./HomeworkList";
import { removeTask } from "./actions";

export type RosterEntry = { student_id: string; name: string; reg_no: string | null; sub: HomeworkRow | null; late: boolean };
export type TaskRow = {
  id: string;
  class_group_id: string;
  batch_label: string;
  teacher_name: string | null;
  title: string;
  instructions: string | null;
  set_on: string;
  due_on: string;
  files: TaskFile[];
  roster: RosterEntry[];
  submitted: number;
  late: number;
};

export function TaskFiles({ files }: { files: TaskFile[] }) {
  if (!files.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
      {files.map((f) => (
        <span key={f.id} style={{ fontSize: 12.5 }}>
          <a href={`/homework/task-file/${f.id}`} target="_blank" rel="noopener">{f.name}</a>{" "}<span className="sub">{fileSize(f.size)}</span>
        </span>
      ))}
    </div>
  );
}

export function SubStatus({ sub, late, due, today }: { sub: HomeworkRow | null; late: boolean; due: string; today: string }) {
  if (!sub) {
    return due < today
      ? <span className="st over"><span className="dot" />Not submitted</span>
      : <span className="st due"><span className="dot" />Not submitted yet</span>;
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      {sub.status === "reviewed"
        ? <span className="st paid"><span className="dot" />Reviewed</span>
        : <span className="st part"><span className="dot" />Submitted</span>}
      {late && <span className="st over"><span className="dot" />Late</span>}
    </span>
  );
}

function Remove({ id, onCancel }: { id: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(removeTask, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={id} />
      <span className="sub">Remove this homework?</span>
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>{pending ? "Removing…" : "Yes, remove"}</button>
      <button className="btn ghost" type="button" onClick={onCancel} style={{ fontSize: 12, padding: "5px 10px" }}>No</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

function Roster({ task, today, canReview }: { task: TaskRow; today: string; canReview: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = [...task.roster].sort((a, b) => Number(!!a.sub) - Number(!!b.sub) || a.name.localeCompare(b.name));
  return (
    <div className="tblwrap" style={{ background: "var(--paper)", borderRadius: 8, border: "1px solid var(--line)" }}>
      <table>
        <thead>
          <tr><th>Student</th><th>Status</th><th>Submitted on</th><th>Files</th><th>Comment</th>{canReview && <th className="n"></th>}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.student_id}>
              <tr>
                <td>{r.name}{r.reg_no && <div className="sub mono">{r.reg_no}</div>}</td>
                <td><SubStatus sub={r.sub} late={r.late} due={task.due_on} today={today} /></td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{r.sub ? fmtDate(r.sub.homework_date) : <span className="sub">-</span>}</td>
                <td>
                  {r.sub ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {r.sub.files.map((f) => (
                        <span key={f.id} style={{ fontSize: 12.5 }}>
                          <a href={`/homework/file/${f.id}`} target="_blank" rel="noopener">{f.name}</a>{" "}<span className="sub">{fileSize(f.size)}</span>
                        </span>
                      ))}
                      {r.sub.note && <span className="sub" style={{ whiteSpace: "pre-wrap" }}>{r.sub.note}</span>}
                    </div>
                  ) : <span className="sub">-</span>}
                </td>
                <td style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{r.sub?.teacher_comment ?? <span className="sub">-</span>}</td>
                {canReview && (
                  <td className="n">
                    {r.sub && (
                      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setOpen(open === r.student_id ? null : r.student_id)}>
                        {open === r.student_id ? "Close" : r.sub.status === "reviewed" ? "Edit review" : "Review"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
              {canReview && r.sub && open === r.student_id && (
                <tr><td colSpan={6} style={{ background: "var(--tint)", padding: "12px 16px" }}><Review row={r.sub} onDone={() => setOpen(null)} /></td></tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="sub">No students in this batch.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Homework a teacher has set, with who has and hasn't submitted. */
export default function TaskList({ tasks, batches, today, canManage, canReview, showTeacher }: {
  tasks: TaskRow[]; batches: BatchOpt[]; today: string; canManage: boolean; canReview: boolean; showTeacher: boolean;
}) {
  const [view, setView] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const cols = 5 + (showTeacher ? 1 : 0);

  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr><th>Homework</th><th>Subject and batch</th>{showTeacher && <th>Teacher</th>}<th>Set</th><th>Due</th><th>Submitted</th></tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const total = t.roster.length;
            const missing = total - t.submitted;
            return (
              <Fragment key={t.id}>
                <tr>
                  <td>
                    <b style={{ color: "var(--ink)" }}>{t.title}</b>
                    {t.instructions && <div className="sub" style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{t.instructions}</div>}
                    <TaskFiles files={t.files} />
                  </td>
                  <td>{t.batch_label}</td>
                  {showTeacher && <td>{t.teacher_name ?? <span className="sub">-</span>}</td>}
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(t.set_on)}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>
                    {fmtDate(t.due_on)}
                    {t.due_on >= today && <div className="sub" style={{ fontFamily: "inherit" }}>{t.due_on === today ? "Due today" : "Open"}</div>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <b className="mono">{t.submitted} / {total}</b>
                    {t.late > 0 && <span className="sub"> · {t.late} late</span>}
                    {missing > 0 && t.due_on < today && <div className="sub" style={{ color: "var(--crit)" }}>{missing} not submitted</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }} className="no-print">
                      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setView(view === t.id ? null : t.id)}>
                        {view === t.id ? "Hide" : "Submissions"}
                      </button>
                      {canManage && (confirming === t.id ? (
                        <Remove id={t.id} onCancel={() => setConfirming(null)} />
                      ) : (
                        <>
                          <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setEditing(editing === t.id ? null : t.id)}>
                            {editing === t.id ? "Close" : "Edit"}
                          </button>
                          {t.submitted === 0 && (
                            <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px", color: "var(--crit)" }} onClick={() => setConfirming(t.id)}>Remove</button>
                          )}
                        </>
                      ))}
                    </div>
                  </td>
                </tr>
                {canManage && editing === t.id && (
                  <tr className="no-print">
                    <td colSpan={cols} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                      <TaskForm batches={batches} today={today} onDone={() => setEditing(null)}
                        task={{ id: t.id, class_group_id: t.class_group_id, title: t.title, instructions: t.instructions, set_on: t.set_on, due_on: t.due_on, files: t.files, submitted: t.submitted }} />
                    </td>
                  </tr>
                )}
                {view === t.id && (
                  <tr>
                    <td colSpan={cols} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                      <Roster task={t} today={today} canReview={canReview} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {tasks.length === 0 && <tr><td colSpan={cols} className="sub">No homework set yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
