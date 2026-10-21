"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { STUDY_ACCEPT, checkStudyFiles, fileSize, uploadStudyFiles } from "@/lib/files";
import { saveMaterial } from "./actions";

export type BatchOpt = { id: string; label: string };
export type MaterialRow = {
  id: string;
  class_group_id: string;
  title: string;
  material_date: string;
  note: string | null;
  batch_label: string;
  teacher_name: string | null;
  files: { id: string; name: string; size: number | null }[];
};

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Add a course material (topic, batch, date, files), or edit one. */
export default function MaterialForm({ batches, today, material, onDone }: {
  batches: BatchOpt[]; today: string; material?: MaterialRow; onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(saveMaterial, null);
  const [uploading, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    if (material) onDone?.();
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
    if (!groupId) { setErr("Choose the subject and batch."); return; }
    const kept = (material?.files.length ?? 0) - removed.length;
    if (files.length === 0 && kept <= 0) { setErr("Attach at least one file."); return; }
    const bad = checkStudyFiles(files);
    if (bad) { setErr(bad); return; }
    for (const id of removed) fd.append("remove_file", id);
    start(async () => {
      try {
        const up = files.length ? await uploadStudyFiles("course-materials", groupId, files) : [];
        fd.set("files", JSON.stringify(up));
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
      {material && <input type="hidden" name="id" value={material.id} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`cm-title-${material?.id ?? "new"}`}>Topic / name of material</label>
          <input id={`cm-title-${material?.id ?? "new"}`} name="title" required maxLength={200} defaultValue={material?.title}
            placeholder="e.g. Chapter 4: Partnership accounts" style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`cm-batch-${material?.id ?? "new"}`}>Subject and batch</label>
          <select id={`cm-batch-${material?.id ?? "new"}`} name="class_group_id" required defaultValue={material?.class_group_id ?? (batches.length === 1 ? batches[0].id : "")} style={input}>
            <option value="" disabled>Choose…</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`cm-date-${material?.id ?? "new"}`}>Date</label>
          <input id={`cm-date-${material?.id ?? "new"}`} type="date" name="material_date" required defaultValue={material?.material_date ?? today} style={input} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`cm-note-${material?.id ?? "new"}`}>Note for students (optional)</label>
          <textarea id={`cm-note-${material?.id ?? "new"}`} name="note" rows={2} maxLength={2000} defaultValue={material?.note ?? ""} style={{ ...input, resize: "vertical" }} />
        </div>
        {material && material.files.length > 0 && (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="lbl">Attached files</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {material.files.map((f) => {
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
          <label className="lbl" htmlFor={`cm-files-${material?.id ?? "new"}`}>{material ? "Add more files" : "Attachments"}</label>
          <input id={`cm-files-${material?.id ?? "new"}`} type="file" name="upload" multiple accept={STUDY_ACCEPT} style={{ ...input, padding: 8 }} />
          <span className="sub">PDF, Word, PowerPoint or photos. Up to 10 files, 20 MB each.</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={busy}>{uploading && !pending ? "Uploading…" : pending ? "Saving…" : material ? "Save changes" : "Share material"}</button>
        {material && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
        {(err || state?.error) && <span className="sub" style={{ color: "var(--crit)" }}>{err ?? state?.error}</span>}
        {state?.ok && !material && !busy && <span className="sub" style={{ color: "var(--ok)" }}>Shared with the batch.</span>}
      </div>
    </form>
  );
}
