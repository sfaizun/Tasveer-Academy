"use client";
import { Fragment, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { fmtDate } from "@/lib/format";
import { STUDY_ACCEPT, checkStudyFiles, fileSize, uploadStudyFiles } from "@/lib/files";
import type { TaskFile } from "./TaskForm";
import type { HomeworkRow } from "./HomeworkList";
import { SubStatus, TaskFiles } from "./TaskList";
import { removeHomework, submitTask } from "./actions";

export type StudentTask = {
  id: string;
  batch_label: string;
  teacher_name: string | null;
  title: string;
  instructions: string | null;
  set_on: string;
  due_on: string;
  files: TaskFile[];
  sub: HomeworkRow | null;
  late: boolean;
};

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

function SubmitForm({ task, studentId, today, onDone }: { task: StudentTask; studentId: string; today: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(submitTask, null);
  const [uploading, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) onDone(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const files = fd.getAll("upload").filter((f): f is File => f instanceof File && f.size > 0);
    fd.delete("upload");
    if (!files.length) { setErr("Attach your homework file."); return; }
    const bad = checkStudyFiles(files);
    if (bad) { setErr(bad); return; }
    start(async () => {
      try {
        fd.set("files", JSON.stringify(await uploadStudyFiles("homework-files", studentId, files)));
      } catch (x) {
        setErr((x as Error).message);
        return;
      }
      start(() => action(fd));
    });
  }
  const busy = pending || uploading;
  return (
    <form ref={ref} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620 }}>
      <input type="hidden" name="task_id" value={task.id} />
      {task.due_on < today && (
        <div className="sub" style={{ color: "var(--warn)" }}>The due date was {fmtDate(task.due_on)}. You can still submit, but it will show as late.</div>
      )}
      <div className="field">
        <label className="lbl" htmlFor={`hs-f-${task.id}`}>Your homework <span aria-hidden="true" style={{ color: "var(--coral)" }}>*</span></label>
        <input id={`hs-f-${task.id}`} type="file" name="upload" multiple required accept={STUDY_ACCEPT} style={{ ...input, padding: 8 }} />
        <span className="sub">Photos of your pages, PDF, Word or PowerPoint. Up to 10 files, 20 MB each.</span>
      </div>
      <div className="field">
        <label className="lbl" htmlFor={`hs-n-${task.id}`}>Note for the teacher (optional)</label>
        <textarea id={`hs-n-${task.id}`} name="note" rows={2} maxLength={2000} style={{ ...input, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={busy}>{uploading && !pending ? "Uploading…" : pending ? "Submitting…" : "Submit homework"}</button>
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
        {(err || state?.error) && <span className="sub" style={{ color: "var(--crit)" }}>{err ?? state?.error}</span>}
      </div>
    </form>
  );
}

function Withdraw({ id, onCancel }: { id: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(removeHomework, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={id} />
      <span className="sub">Remove your submission to submit again?</span>
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>{pending ? "Removing…" : "Yes, remove"}</button>
      <button className="btn ghost" type="button" onClick={onCancel} style={{ fontSize: 12, padding: "5px 10px" }}>No</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

/** A student's (or guardian's) homework: what the teachers have set, and what has been submitted. */
export default function StudentTasks({ tasks, studentId, today, canSubmit }: {
  tasks: StudentTask[]; studentId: string | null; today: string; canSubmit: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr><th>Homework</th><th>Subject and batch</th><th>Due</th><th>Status</th><th>Submitted</th></tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <Fragment key={t.id}>
              <tr>
                <td>
                  <b style={{ color: "var(--ink)" }}>{t.title}</b>
                  {t.instructions && <div className="sub" style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{t.instructions}</div>}
                  <TaskFiles files={t.files} />
                </td>
                <td>{t.batch_label}{t.teacher_name && <div className="sub">{t.teacher_name}</div>}</td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>
                  {fmtDate(t.due_on)}
                  {!t.sub && t.due_on === today && <div className="sub" style={{ color: "var(--warn)", fontFamily: "inherit" }}>Due today</div>}
                </td>
                <td><SubStatus sub={t.sub} late={t.late} due={t.due_on} today={today} /></td>
                <td>
                  {t.sub ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span className="sub mono">{fmtDate(t.sub.homework_date)}</span>
                      {t.sub.files.map((f) => (
                        <span key={f.id} style={{ fontSize: 12.5 }}>
                          <a href={`/homework/file/${f.id}`} target="_blank" rel="noopener">{f.name}</a>{" "}<span className="sub">{fileSize(f.size)}</span>
                        </span>
                      ))}
                      {t.sub.teacher_comment && <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>Teacher: &ldquo;{t.sub.teacher_comment}&rdquo;</div>}
                      {canSubmit && t.sub.status === "submitted" && (confirming === t.id
                        ? <Withdraw id={t.sub.id} onCancel={() => setConfirming(null)} />
                        : <button className="btn ghost no-print" type="button" style={{ fontSize: 12, padding: "5px 10px", alignSelf: "flex-start" }} onClick={() => setConfirming(t.id)}>Remove and submit again</button>)}
                    </div>
                  ) : canSubmit && studentId ? (
                    <button className="btn no-print" type="button" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setOpen(open === t.id ? null : t.id)}>
                      {open === t.id ? "Close" : "Submit"}
                    </button>
                  ) : <span className="sub">-</span>}
                </td>
              </tr>
              {canSubmit && studentId && !t.sub && open === t.id && (
                <tr className="no-print">
                  <td colSpan={5} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                    <SubmitForm task={t} studentId={studentId} today={today} onDone={() => setOpen(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {tasks.length === 0 && <tr><td colSpan={5} className="sub">No homework here.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
