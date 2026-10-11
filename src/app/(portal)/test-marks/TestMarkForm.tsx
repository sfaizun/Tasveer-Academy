"use client";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Req from "@/components/Req";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_ACCEPT, checkAttachment } from "@/lib/attachments";
import { GRADES, gradeFor, percentOf } from "@/lib/grade";
import { addTestMark, updateTestMark } from "./actions";

export type SubjectOpt = { id: string; label: string };
export type StudentOpt = { id: string; name: string; reg_no: string | null; subjects: SubjectOpt[] };
export type MarkRow = {
  id: string;
  student_id: string;
  student_name: string;
  reg_no: string | null;
  subject_id: string;
  subject_label: string;
  teacher_name: string | null;
  test_name: string;
  test_date: string;
  marks: number;
  out_of: number;
  percentage: number;
  grade: string;
  auto_grade: string | null;
  remarks: string | null;
  attachment_name: string | null;
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};
const readOnlyStyle: React.CSSProperties = { ...inputStyle, background: "var(--tint)", fontFamily: "var(--mono, monospace)" };

/** Add test marks, or edit them when `mark` is given. Percentage is worked out from the marks;
 * the grade fills in from the percentage and can be changed. The attachment is optional. */
export default function TestMarkForm({
  students, today, mark, defaultStudentId, onDone,
}: {
  students: StudentOpt[];
  today: string;
  mark?: MarkRow;
  defaultStudentId?: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(mark ? updateTestMark : addTestMark, null);
  const [uploading, startUpload] = useTransition();
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [fileRemoved, setFileRemoved] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const id = mark?.id ?? "new";

  const [studentId, setStudentId] = useState(mark?.student_id ?? defaultStudentId ?? "");
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState(mark?.subject_id ?? "");
  const [marks, setMarks] = useState(mark ? String(mark.marks) : "");
  const [outOf, setOutOf] = useState(mark ? String(mark.out_of) : "100");
  const [grade, setGrade] = useState(mark && mark.auto_grade !== mark.grade ? mark.grade : "");

  const student = students.find((s) => s.id === studentId);
  const subjects = useMemo(() => {
    const list = student?.subjects ?? [];
    if (mark && !list.some((s) => s.id === mark.subject_id)) return [{ id: mark.subject_id, label: mark.subject_label }, ...list];
    return list;
  }, [student, mark]);
  const shownStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || (s.reg_no ?? "").toLowerCase().includes(q) || s.id === studentId);
  }, [students, search, studentId]);

  useEffect(() => {
    if (subjects.length === 1) setSubjectId(subjects[0].id);
    else if (!subjects.some((s) => s.id === subjectId)) setSubjectId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const pct = percentOf(Number(marks), Number(outOf));
  const autoGrade = marks.trim() && outOf.trim() ? gradeFor(pct) : null;
  const overMax = marks.trim() !== "" && outOf.trim() !== "" && Number(marks) > Number(outOf);

  useEffect(() => {
    if (!state?.ok) return;
    if (mark) onDone?.();
    else {
      ref.current?.reset();
      setSubjectId(subjects.length === 1 ? subjects[0].id : "");
      setMarks("");
      setGrade("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFileErr(null);
    if (overMax) { setFileErr("Marks obtained can't be more than Out of."); return; }
    const fd = new FormData(e.currentTarget);
    const file = fd.get("attachment");
    fd.delete("attachment");
    const hasFile = file instanceof File && file.size > 0;
    startUpload(async () => {
      if (hasFile) {
        const chk = checkAttachment(file);
        if ("error" in chk) { setFileErr(chk.error); return; }
        const date = String(fd.get("test_date") || today);
        const path = `marks/${date.slice(0, 7)}/${crypto.randomUUID()}.${chk.ext}`;
        setSendingFile(true);
        const { error } = await createClient().storage
          .from("test-mark-attachments")
          .upload(path, file, { contentType: chk.type, upsert: false });
        setSendingFile(false);
        if (error) { setFileErr("Could not upload the file: " + error.message); return; }
        fd.set("attachment_path", path);
        fd.set("attachment_name", file.name);
        fd.set("attachment_type", chk.type);
        fd.set("attachment_size", String(file.size));
      }
      if (fileRemoved) fd.set("attachment_removed", "1");
      startUpload(() => action(fd));
    });
  }
  const busy = pending || uploading;

  return (
    <form ref={ref} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mark && <input type="hidden" name="id" value={mark.id} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {mark ? (
          <div className="field">
            <span className="lbl">Student</span>
            <input type="hidden" name="student_id" value={mark.student_id} />
            <div style={{ padding: "9px 0", color: "var(--ink)", fontSize: 13 }}>
              {mark.student_name} <span className="sub mono">{mark.reg_no}</span>
            </div>
          </div>
        ) : (
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label className="lbl" htmlFor={`tm-s-${id}`}>Student<Req /></label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                aria-label="Search students" placeholder="Search name or ID" value={search}
                onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 170 }}
              />
              <select id={`tm-s-${id}`} style={inputStyle} name="student_id" required value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="" disabled>{shownStudents.length ? "Choose…" : "No match"}</option>
                {shownStudents.map((s) => <option key={s.id} value={s.id}>{s.name}{s.reg_no ? ` (${s.reg_no})` : ""}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="field">
          <label className="lbl" htmlFor={`tm-sub-${id}`}>Subject<Req /></label>
          <select id={`tm-sub-${id}`} style={inputStyle} name="subject_id" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!studentId}>
            <option value="" disabled>{studentId ? (subjects.length ? "Choose…" : "No subjects") : "Choose the student first"}</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`tm-n-${id}`}>Test name<Req /></label>
          <input id={`tm-n-${id}`} style={inputStyle} name="test_name" required maxLength={200} defaultValue={mark?.test_name ?? ""} placeholder="e.g. Mock 1, Class test: Algebra" />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`tm-d-${id}`}>Date of test<Req /></label>
          <input id={`tm-d-${id}`} style={inputStyle} type="date" name="test_date" required max={today} defaultValue={mark?.test_date ?? today} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
        <div className="field">
          <label className="lbl" htmlFor={`tm-m-${id}`}>Marks obtained<Req /></label>
          <input id={`tm-m-${id}`} style={inputStyle} type="number" name="marks" min="0" step="0.01" inputMode="decimal" required value={marks} onChange={(e) => setMarks(e.target.value)} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`tm-o-${id}`}>Out of<Req /></label>
          <input id={`tm-o-${id}`} style={inputStyle} type="number" name="out_of" min="0.01" step="0.01" inputMode="decimal" required value={outOf} onChange={(e) => setOutOf(e.target.value)} />
        </div>
        <div className="field">
          <span className="lbl">Percentage</span>
          <input aria-label="Percentage" readOnly tabIndex={-1} style={readOnlyStyle} value={overMax ? "Check marks" : pct === null ? "" : `${pct.toFixed(2)}%`} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`tm-g-${id}`}>Grade<Req /></label>
          <select id={`tm-g-${id}`} style={inputStyle} name="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">{autoGrade ? `${autoGrade} (auto)` : "Auto"}</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {grade && autoGrade && grade !== autoGrade && <span className="sub">Changed from {autoGrade}</span>}
        </div>
      </div>

      <div className="field">
        <label className="lbl" htmlFor={`tm-r-${id}`}>Remarks</label>
        <textarea id={`tm-r-${id}`} name="remarks" rows={2} maxLength={1000} defaultValue={mark?.remarks ?? ""} style={{ ...inputStyle, resize: "vertical" }} placeholder="Optional. The student can see this." />
      </div>

      <div className="field">
        {mark?.attachment_name && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6, fontSize: 13 }}>
            <span className="lbl" style={{ margin: 0 }}>Current file</span>
            {fileRemoved ? (
              <>
                <s className="sub">{mark.attachment_name}</s>
                <span className="sub" style={{ color: "var(--crit)" }}>Will be deleted when you save</span>
                <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setFileRemoved(false)}>Undo</button>
              </>
            ) : (
              <>
                <a href={`/test-marks/file/${mark.id}`} target="_blank" rel="noopener">{mark.attachment_name}</a>
                <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 10px", color: "var(--crit)" }} onClick={() => setFileRemoved(true)}>Delete file</button>
              </>
            )}
          </div>
        )}
        <label className="lbl" htmlFor={`tm-f-${id}`}>{mark?.attachment_name ? "Replace attachment" : "Attachment"}</label>
        <input id={`tm-f-${id}`} name="attachment" type="file" accept={ATTACHMENT_ACCEPT} style={{ ...inputStyle, padding: "7px 9px" }} onChange={() => setFileErr(null)} />
        <span className="sub">Optional. Marked script or result sheet. Photo, PDF, Word or Excel, up to 10 MB.</span>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={busy}>{sendingFile ? "Uploading…" : busy ? "Saving…" : mark ? "Save changes" : "+ Add marks"}</button>
        {mark && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
        {fileErr && <span className="sub" style={{ color: "var(--crit)" }}>{fileErr}</span>}
        {!fileErr && state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && !mark && <span className="sub" style={{ color: "var(--ok)" }}>Added.</span>}
      </div>
    </form>
  );
}
