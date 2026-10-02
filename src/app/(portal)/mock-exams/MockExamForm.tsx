"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Req from "@/components/Req";
import { groupSubjects } from "@/lib/subjectGroups";
import { hm, type MockExam } from "@/lib/mock";
import { createMockExam, updateMockExam } from "./actions";

type SubjectOpt = { id: string; name: string; level: string | null; programme: { code: string; name: string } | null };

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Add a mock exam, or edit one (when `exam` is given). */
export default function MockExamForm({
  subjects, defaultFee, exam, seriesOptions, hasRegistrations, teachers, teacherSubjects,
}: {
  subjects: SubjectOpt[];
  teachers: { id: string; full_name: string }[];
  teacherSubjects: { teacher_id: string; subject_id: string }[];
  defaultFee: number;
  exam?: MockExam;
  seriesOptions: string[];
  hasRegistrations?: boolean;
}) {
  const [state, action, pending] = useActionState(exam ? updateMockExam : createMockExam, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !exam) ref.current?.reset();
  }, [state, exam]);
  const groups = groupSubjects(subjects);
  const [subjectId, setSubjectId] = useState(exam?.subject_id ?? "");
  const subjectTeachers = teachers.filter((t) => teacherSubjects.some((ts) => ts.subject_id === subjectId && ts.teacher_id === t.id));
  const [teacherId, setTeacherId] = useState(exam?.teacher_id ?? "");
  // One teacher for the subject: pick them. Several: leave the choice to admin.
  const effectiveTeacher = teacherId || (subjectTeachers.length === 1 ? subjectTeachers[0].id : "");

  return (
    <form ref={ref} action={action} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {exam && <input type="hidden" name="id" value={exam.id} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <div className="field">
          <label className="lbl" htmlFor="me-series">Series<Req /></label>
          <input id="me-series" style={inputStyle} name="series" list="me-series-list" required defaultValue={exam?.series ?? ""} placeholder="e.g. Winter Mocks 2026" />
          <datalist id="me-series-list">{seriesOptions.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="me-subject">Subject<Req /></label>
          <select id="me-subject" style={inputStyle} name="subject_id" required value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTeacherId(""); }}>
            <option value="" disabled>Choose…</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.level ? ` (${s.level.toUpperCase()})` : ""}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="me-date">Exam date<Req /></label>
          <input id="me-date" style={inputStyle} type="date" name="exam_date" required defaultValue={exam?.exam_date ?? ""} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="me-time">Start time</label>
          <input id="me-time" style={inputStyle} type="time" name="start_time" defaultValue={hm(exam?.start_time)} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="me-dur">Duration (minutes)</label>
          <input id="me-dur" style={inputStyle} type="number" name="duration_min" min="10" max="600" step="5" defaultValue={exam?.duration_min ?? ""} placeholder="e.g. 120" />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="me-room">Room</label>
          <input id="me-room" style={inputStyle} name="room" defaultValue={exam?.room ?? ""} placeholder="e.g. Room 3" />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="me-fee">Fee (৳)<Req /></label>
          <input id="me-fee" style={inputStyle} type="number" name="fee" min="0" step="0.01" inputMode="decimal" required defaultValue={exam?.fee ?? defaultFee} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="me-teacher">Teacher</label>
          <select id="me-teacher" style={inputStyle} name="teacher_id" value={effectiveTeacher} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">{subjectTeachers.length > 1 ? "Choose…" : "Not set"}</option>
            {(subjectTeachers.length ? subjectTeachers : teachers).map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
        {exam && (
          <div className="field">
            <label className="lbl" htmlFor="me-status">Registration</label>
            <select id="me-status" style={inputStyle} name="status" defaultValue={exam.status}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        )}
      </div>
      <div className="field">
        <label className="lbl" htmlFor="me-note">Note</label>
        <input id="me-note" style={inputStyle} name="note" defaultValue={exam?.note ?? ""} placeholder="Optional, e.g. Paper 1 and Paper 2, bring a calculator" />
      </div>
      <div className="sub">
        Mock fees show in the teacher&apos;s report. A candidate who studies this subject here counts for their own class
        teacher; the teacher above gets everyone else (for example mock-only candidates).
      </div>
      {exam && hasRegistrations && (
        <div className="sub">A new fee applies to new registrations only; students already registered keep the fee on their invoice.</div>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : exam ? "Save changes" : "+ Add mock exam"}</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>{exam ? "Saved." : "Added."}</span>}
      </div>
    </form>
  );
}
