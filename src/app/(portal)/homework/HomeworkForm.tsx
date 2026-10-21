"use client";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { STUDY_ACCEPT, checkStudyFiles, uploadStudyFiles } from "@/lib/files";
import { submitHomework } from "./actions";

export type EnrolOpt = { enrolment_id: string; teacher_id: string; teacher_name: string; subject_label: string; batch_label: string };

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Student: upload homework. Pick the teacher, then one of their subjects you study; the batch
 * fills in from your enrolment. */
export default function HomeworkForm({ options, studentId, today }: { options: EnrolOpt[]; studentId: string; today: string }) {
  const [state, action, pending] = useActionState(submitHomework, null);
  const [uploading, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  const teachers = useMemo(
    () => [...new Map(options.map((o) => [o.teacher_id, o.teacher_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [options],
  );
  const [teacherId, setTeacherId] = useState(teachers.length === 1 ? teachers[0][0] : "");
  const subjects = options.filter((o) => o.teacher_id === teacherId);
  const [enrolmentId, setEnrolmentId] = useState("");
  useEffect(() => { setEnrolmentId(subjects.length === 1 ? subjects[0].enrolment_id : ""); }, [teacherId]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = options.find((o) => o.enrolment_id === enrolmentId);

  useEffect(() => {
    if (!state?.ok) return;
    ref.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const files = fd.getAll("upload").filter((f): f is File => f instanceof File && f.size > 0);
    fd.delete("upload");
    if (!enrolmentId) { setErr("Choose the teacher and subject."); return; }
    if (!files.length) { setErr("Attach your homework file."); return; }
    const bad = checkStudyFiles(files);
    if (bad) { setErr(bad); return; }
    fd.set("enrolment_id", enrolmentId);
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
    <form ref={ref} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <div className="field">
          <label className="lbl" htmlFor="hw-date">Date</label>
          <input id="hw-date" type="date" name="homework_date" required defaultValue={today} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="hw-teacher">Teacher</label>
          <select id="hw-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required style={input}>
            <option value="" disabled>Choose…</option>
            {teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="hw-subject">Subject</label>
          <select id="hw-subject" value={enrolmentId} onChange={(e) => setEnrolmentId(e.target.value)} required disabled={!teacherId} style={input}>
            <option value="" disabled>{teacherId ? "Choose…" : "Choose the teacher first"}</option>
            {subjects.map((o) => <option key={o.enrolment_id} value={o.enrolment_id}>{o.subject_label}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="lbl">Batch</span>
          <div style={{ ...input, background: "var(--tint)", color: chosen ? "var(--ink)" : "var(--muted)" }}>{chosen ? chosen.batch_label : "Fills in from your subject"}</div>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor="hw-title">Homework / assignment</label>
          <input id="hw-title" name="title" required maxLength={200} placeholder="e.g. Exercise 5.2, questions 1 to 10" style={input} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor="hw-note">Note for the teacher (optional)</label>
          <textarea id="hw-note" name="note" rows={2} maxLength={2000} style={{ ...input, resize: "vertical" }} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor="hw-files">Upload homework</label>
          <input id="hw-files" type="file" name="upload" multiple required accept={STUDY_ACCEPT} style={{ ...input, padding: 8 }} />
          <span className="sub">Photos of your pages, PDF, Word or PowerPoint. Up to 10 files, 20 MB each.</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={busy}>{uploading && !pending ? "Uploading…" : pending ? "Saving…" : "Submit homework"}</button>
        {(err || state?.error) && <span className="sub" style={{ color: "var(--crit)" }}>{err ?? state?.error}</span>}
        {state?.ok && !busy && <span className="sub" style={{ color: "var(--ok)" }}>Submitted. Your teacher will see it now.</span>}
      </div>
    </form>
  );
}
