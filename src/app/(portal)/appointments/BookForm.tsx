"use client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Req from "@/components/Req";
import { bookAppointment } from "./actions";
import { LENGTHS, REASONS, type BookStudent } from "./shared";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Book an appointment.
 * Office staff: student, date, time, then the teacher (or the office) and subject.
 * Teacher: student, date, time, subject; the appointment is with the teacher.
 * Student: teacher (or the office), subject, date, time.
 * Choosing the office hides the subject and asks for the reason instead. */
export default function BookForm({ mode, students, teacherName, today }: {
  mode: "office" | "teacher" | "student";
  students: BookStudent[];
  /** Teacher mode: the signed-in teacher (their id is the only one in each student's pairs). */
  teacherName?: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(bookAppointment, null);
  const ref = useRef<HTMLFormElement>(null);
  const [studentId, setStudentId] = useState(mode === "student" ? students[0]?.id ?? "" : "");
  const [withWho, setWithWho] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const student = students.find((s) => s.id === studentId);
  const teachers = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of student?.pairs ?? []) m.set(p.teacher_id, p.teacher_name);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [student]);
  // A teacher's appointments are always with themselves.
  const teacherId = mode === "teacher" ? teachers[0]?.id ?? "" : withWho;
  const office = mode !== "teacher" && withWho === "office";
  const subjects = (student?.pairs ?? []).filter((p) => p.teacher_id === teacherId);

  useEffect(() => {
    if (!state?.ok) return;
    ref.current?.reset();
    if (mode !== "student") setStudentId("");
    setWithWho("");
    setSubjectId("");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const studentField = mode !== "student" && (
    <div className="field">
      <label className="lbl" htmlFor="ap-student">Student<Req /></label>
      <select id="ap-student" name="student_id" required value={studentId} style={input}
        onChange={(e) => { setStudentId(e.target.value); setWithWho(""); setSubjectId(""); }}>
        <option value="" disabled>Choose…</option>
        {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.reg_no ? ` (${s.reg_no})` : ""}</option>)}
      </select>
    </div>
  );
  const withField = mode === "teacher" ? (
    <input type="hidden" name="with" value={teacherId} />
  ) : (
    <div className="field">
      <label className="lbl" htmlFor="ap-with">Teacher or office<Req /></label>
      <select id="ap-with" name="with" required value={withWho} style={input} disabled={!student}
        onChange={(e) => { setWithWho(e.target.value); setSubjectId(""); }}>
        <option value="" disabled>{student ? "Choose…" : "Choose the student first"}</option>
        {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        <option value="office">Office admin</option>
      </select>
    </div>
  );
  const subjectField = !office && (
    <div className="field">
      <label className="lbl" htmlFor="ap-subject">Subject<Req /></label>
      <select id="ap-subject" name="subject_id" required value={subjectId} style={input} disabled={!teacherId}
        onChange={(e) => setSubjectId(e.target.value)}>
        <option value="" disabled>{teacherId ? "Choose…" : mode === "teacher" ? "Choose the student first" : "Choose the teacher first"}</option>
        {subjects.map((p) => <option key={p.subject_id} value={p.subject_id}>{p.subject_name}</option>)}
      </select>
    </div>
  );
  const whenFields = (
    <>
      <div className="field">
        <label className="lbl" htmlFor="ap-date">Date<Req /></label>
        <input id="ap-date" type="date" name="date" required min={today} style={input} />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="ap-time">Time<Req /></label>
        <input id="ap-time" type="time" name="time" required step={300} style={input} />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="ap-len">Length<Req /></label>
        <select id="ap-len" name="minutes" required defaultValue="30" style={input}>
          {LENGTHS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
      </div>
    </>
  );
  const reasonFields = (
    <>
      {office && (
        <div className="field">
          <label className="lbl" htmlFor="ap-reason">Reason<Req /></label>
          <select id="ap-reason" name="reason" required defaultValue="" style={input}>
            <option value="" disabled>Choose…</option>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      )}
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label className="lbl" htmlFor="ap-note">{office ? "Details (optional)" : "What to discuss (optional)"}</label>
        <textarea id="ap-note" name="note" rows={2} maxLength={1000} style={{ ...input, resize: "vertical" }} />
      </div>
    </>
  );

  return (
    <form ref={ref} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {mode === "student" && <input type="hidden" name="student_id" value={studentId} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        {mode === "student" ? (
          <>{withField}{subjectField}{whenFields}</>
        ) : (
          <>{studentField}{whenFields}{withField}{subjectField}</>
        )}
        {reasonFields}
      </div>
      {mode === "teacher" && teacherName && <div className="sub">The appointment is with you ({teacherName}).</div>}
      {mode === "student" && <div className="sub">Your teacher or the office will accept it, or suggest another time.</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Booking…" : mode === "student" ? "Request appointment" : "Book appointment"}</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && !pending && (
          <span className="sub" style={{ color: "var(--ok)" }}>{mode === "student" ? "Request sent." : "Appointment booked."}</span>
        )}
      </div>
    </form>
  );
}
