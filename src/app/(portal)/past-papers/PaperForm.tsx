"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { fileSize, uploadStudyFiles, type UploadedFile } from "@/lib/files";
import { savePaper } from "./actions";

export type SubjectOpt = { id: string; label: string; programme: string };
export type PaperFile = { id: string; kind: string; name: string; size: number | null };
export type PaperRow = {
  id: string;
  subject_id: string;
  subject_label: string;
  programme: string;
  year: number;
  session: string;
  paper: string;
  note: string | null;
  files: PaperFile[];
};

export const SESSIONS: { value: string; label: string }[] = [
  { value: "jan", label: "January" },
  { value: "jun", label: "May/June" },
  { value: "nov", label: "October/November" },
];
export const sessionLabel = (s: string) => SESSIONS.find((x) => x.value === s)?.label ?? s;
export const KIND_LABEL: Record<string, string> = { qp: "Question paper", ms: "Mark scheme", er: "Examiner report" };

const PAPER_ACCEPT = ".pdf,image/jpeg,image/png,image/webp";
const OK_EXT = ["pdf", "jpg", "jpeg", "png", "webp"];
const MAX = 20 * 1024 * 1024;

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

function checkFile(f: File): string | null {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if (!OK_EXT.includes(ext)) return `${f.name}: use a PDF or a photo (JPG, PNG).`;
  if (f.size > MAX) return `${f.name} is larger than 20 MB. Please use a smaller file.`;
  return null;
}

/** Add a past paper (subject, year, session, paper, files), or edit one. */
export default function PaperForm({ subjects, thisYear, paper, onDone }: {
  subjects: SubjectOpt[]; thisYear: number; paper?: PaperRow; onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(savePaper, null);
  const [uploading, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [remove, setRemove] = useState<string[]>([]);
  const ref = useRef<HTMLFormElement>(null);
  const k = paper?.id ?? "new";
  const has = (kind: string) => paper?.files.find((f) => f.kind === kind);

  useEffect(() => {
    if (!state?.ok) return;
    if (paper) onDone?.();
    else ref.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const subjectId = String(fd.get("subject_id") ?? "");
    if (!subjectId) { setErr("Choose the subject."); return; }
    const picked: { kind: string; file: File }[] = [];
    for (const kind of ["qp", "ms", "er"]) {
      const f = fd.get(`file_${kind}`);
      fd.delete(`file_${kind}`);
      if (f instanceof File && f.size > 0) picked.push({ kind, file: f });
    }
    if (!paper && !picked.some((p) => p.kind === "qp")) { setErr("Attach the question paper."); return; }
    for (const p of picked) { const bad = checkFile(p.file); if (bad) { setErr(bad); return; } }
    for (const kind of remove) if (!picked.some((p) => p.kind === kind)) fd.append("remove_kind", kind);
    start(async () => {
      try {
        const up: (UploadedFile & { kind: string })[] = [];
        for (const p of picked) {
          const [u] = await uploadStudyFiles("past-papers", subjectId, [p.file]);
          up.push({ ...u, kind: p.kind });
        }
        fd.set("files", JSON.stringify(up));
      } catch (x) {
        setErr((x as Error).message);
        return;
      }
      start(() => action(fd));
    });
  }
  const busy = pending || uploading;
  const groups = [
    { label: "O Level", list: subjects.filter((s) => s.programme === "o_level") },
    { label: "A Level", list: subjects.filter((s) => s.programme === "a_level") },
  ].filter((g) => g.list.length);

  return (
    <form ref={ref} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {paper && <input type="hidden" name="id" value={paper.id} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <div className="field" style={{ gridColumn: "1 / -1", minWidth: 0 }}>
          <label className="lbl" htmlFor={`pp-sub-${k}`}>Subject <span aria-hidden="true" style={{ color: "var(--coral)" }}>*</span></label>
          <select id={`pp-sub-${k}`} name="subject_id" required defaultValue={paper?.subject_id ?? (subjects.length === 1 ? subjects[0].id : "")} style={input}>
            <option value="" disabled>Choose…</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.list.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`pp-year-${k}`}>Year <span aria-hidden="true" style={{ color: "var(--coral)" }}>*</span></label>
          <input id={`pp-year-${k}`} type="number" name="year" required min={1990} max={thisYear + 1} defaultValue={paper?.year ?? thisYear} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`pp-ses-${k}`}>Session <span aria-hidden="true" style={{ color: "var(--coral)" }}>*</span></label>
          <select id={`pp-ses-${k}`} name="session" required defaultValue={paper?.session ?? ""} style={input}>
            <option value="" disabled>Choose…</option>
            {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1", minWidth: 0 }}>
          <label className="lbl" htmlFor={`pp-paper-${k}`}>Paper / unit <span aria-hidden="true" style={{ color: "var(--coral)" }}>*</span></label>
          <input id={`pp-paper-${k}`} name="paper" required maxLength={120} defaultValue={paper?.paper} placeholder="e.g. Paper 1 or Unit 2 (WAC12)" style={input} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`pp-note-${k}`}>Note (optional)</label>
          <input id={`pp-note-${k}`} name="note" maxLength={1000} defaultValue={paper?.note ?? ""} placeholder="e.g. Insert booklet is on page 20" style={input} />
        </div>
        {(["qp", "ms", "er"] as const).map((kind) => {
          const cur = has(kind);
          const off = remove.includes(kind);
          return (
            <div key={kind} className="field" style={{ minWidth: 0 }}>
              <label className="lbl" htmlFor={`pp-${kind}-${k}`}>
                {KIND_LABEL[kind]}{kind === "qp" && !paper && <> <span aria-hidden="true" style={{ color: "var(--coral)" }}>*</span></>}
              </label>
              {cur && (
                <div className="sub" style={{ fontSize: 12, marginBottom: 4, textDecoration: off ? "line-through" : undefined }}>
                  {cur.name} {fileSize(cur.size)}
                  {kind !== "qp" && (
                    <label style={{ marginLeft: 8, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={off} onChange={(e) => setRemove((r) => e.target.checked ? [...r, kind] : r.filter((x) => x !== kind))} /> Remove
                    </label>
                  )}
                </div>
              )}
              <input id={`pp-${kind}-${k}`} type="file" name={`file_${kind}`} accept={PAPER_ACCEPT} required={kind === "qp" && !paper} style={{ ...input, padding: 8 }} />
              {cur && <span className="sub" style={{ fontSize: 11.5 }}>Choose a file to replace it.</span>}
            </div>
          );
        })}
      </div>
      <span className="sub">PDF or photo, up to 20 MB each.</span>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={busy}>{uploading && !pending ? "Uploading…" : pending ? "Saving…" : paper ? "Save changes" : "Add past paper"}</button>
        {paper && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
        {(err || state?.error) && <span className="sub" style={{ color: "var(--crit)" }}>{err ?? state?.error}</span>}
        {state?.ok && !paper && !busy && <span className="sub" style={{ color: "var(--ok)" }}>Added.</span>}
      </div>
    </form>
  );
}
