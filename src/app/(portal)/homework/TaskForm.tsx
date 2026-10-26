"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { STUDY_ACCEPT, checkStudyFiles, fileSize, uploadStudyFiles } from "@/lib/files";
import { saveTask } from "./actions";

export type BatchOpt = { id: string; label: string };
export type TaskFile = { id: string; name: string; size: number | null };

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};
const star = <span aria-hidden="true" style={{ color: "var(--coral)" }}> *</span>;

/** Teacher: set homework for a batch (title, instructions, due date, optional files), or edit it. */
export default function TaskForm({ batches, today, task, onDone }: {
  batches: BatchOpt[];
  today: string;
  task?: { id: string; class_group_id: string; title: string; instructions: string | null; set_on: string; due_on: string; files: TaskFile[]; submitted: number };
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveTask, null);
  const [uploading, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const ref = useRef<HTMLFormElement>(null);
  const k = task?.id ?? "new";

  useEffect(() => {
    if (!state?.ok) return;
    if (task) onDone?.();
    else ref.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const files = fd.getAll("upload").filter((f): f is File => f instanceof File && f.size > 0);
    fd.delete("upload");
    const groupId = String(fd.get("class_group_id") ?? "");
    if (!groupId) { setErr("Choose the batch."); return; }
    const bad = checkStudyFiles(files);
    if (bad) { setErr(bad); return; }
    for (const id of removed) fd.append("remove_file", id);
    start(async () => {
      try {
        fd.set("files", JSON.stringify(files.length ? await uploadStudyFiles("homework-tasks", groupId, files) : []));
      } catch (x) {
        setErr((x as Error).message);
        return;
      }
      start(() => action(fd));
    });
  }
  const busy = pending || uploading;

  return (
    <form ref={ref} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {task && <input type="hidden" name="id" value={task.id} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`ht-title-${k}`}>Homework{star}</label>
          <input id={`ht-title-${k}`} name="title" required maxLength={200} defaultValue={task?.title} placeholder="e.g. Exercise 5.2, questions 1 to 10" style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`ht-batch-${k}`}>Subject and batch{star}</label>
          <select id={`ht-batch-${k}`} name="class_group_id" required defaultValue={task?.class_group_id ?? (batches.length === 1 ? batches[0].id : "")}
            disabled={!!task && task.submitted > 0} style={input}>
            <option value="" disabled>Choose…</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          {task && task.submitted > 0 && <input type="hidden" name="class_group_id" value={task.class_group_id} />}
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`ht-due-${k}`}>Due date{star}</label>
          <input id={`ht-due-${k}`} type="date" name="due_on" required min={task ? task.set_on : today} defaultValue={task?.due_on} style={input} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`ht-ins-${k}`}>Instructions (optional)</label>
          <textarea id={`ht-ins-${k}`} name="instructions" rows={3} maxLength={4000} defaultValue={task?.instructions ?? ""} style={{ ...input, resize: "vertical" }} />
        </div>
        {task && task.files.length > 0 && (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="lbl">Attached files</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {task.files.map((f) => {
                const off = removed.includes(f.id);
                return (
                  <label key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, textDecoration: off ? "line-through" : undefined, color: off ? "var(--muted)" : undefined }}>
                    <input type="checkbox" checked={off} onChange={(e) => setRemoved((r) => e.target.checked ? [...r, f.id] : r.filter((x) => x !== f.id))} />
                    Remove {f.name} <span className="sub">{fileSize(f.size)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`ht-files-${k}`}>{task ? "Add files (optional)" : "Worksheet or files (optional)"}</label>
          <input id={`ht-files-${k}`} type="file" name="upload" multiple accept={STUDY_ACCEPT} style={{ ...input, padding: 8 }} />
          <span className="sub">PDF, Word, PowerPoint or photos. Up to 10 files, 20 MB each.</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={busy}>{uploading && !pending ? "Uploading…" : pending ? "Saving…" : task ? "Save changes" : "Set homework"}</button>
        {task && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
        {(err || state?.error) && <span className="sub" style={{ color: "var(--crit)" }}>{err ?? state?.error}</span>}
        {state?.ok && !task && !busy && <span className="sub" style={{ color: "var(--ok)" }}>Set. The batch&apos;s students can see it now.</span>}
      </div>
    </form>
  );
}
