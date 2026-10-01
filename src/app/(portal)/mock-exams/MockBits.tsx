"use client";
import { useActionState, useState } from "react";
import { cancelMockExam, registerForMock, setMockAttendance, withdrawFromMock } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** Register one student for an exam. Used on the exam page (pick a student) and the student
 * page (pick an exam): whichever list is passed becomes the dropdown. */
export function RegisterForm({
  examId, studentId, students, exams, disabledReason,
}: {
  examId?: string;
  studentId?: string;
  students?: { id: string; label: string }[];
  exams?: { id: string; label: string }[];
  disabledReason?: string | null;
}) {
  const [state, action, pending] = useActionState(registerForMock, null);
  const [q, setQ] = useState("");
  const opts = students
    ? students.filter((s) => !q || s.label.toLowerCase().includes(q.toLowerCase())).slice(0, 200)
    : exams ?? [];
  if (disabledReason) return <div className="sub">{disabledReason}</div>;
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      {examId && <input type="hidden" name="mock_exam_id" value={examId} />}
      {studentId && <input type="hidden" name="student_id" value={studentId} />}
      {students && (
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label className="lbl" htmlFor="rg-q">Find student</label>
          <input id="rg-q" style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or reg. no." />
        </div>
      )}
      <div className="field" style={{ flex: "2 1 260px" }}>
        <label className="lbl" htmlFor="rg-pick">{students ? "Student" : "Mock exam"}</label>
        <select id="rg-pick" style={{ ...inputStyle, width: "100%" }} name={students ? "student_id" : "mock_exam_id"} required defaultValue="">
          <option value="" disabled>{opts.length ? "Choose…" : students ? "No matching students" : "No open mock exams"}</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <button className="btn" type="submit" disabled={pending || opts.length === 0}>{pending ? "Registering…" : "Register"}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)", width: "100%" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)", width: "100%" }}>{state.message}</span>}
    </form>
  );
}

export function WithdrawButton({ registrationId, examId, studentId }: { registrationId: string; examId?: string; studentId?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(withdrawFromMock, null);
  if (state?.ok) return <span className="sub" style={{ color: "var(--ok)" }}>{state.message}</span>;
  if (!open) return <button type="button" className="linkbtn no-print" onClick={() => setOpen(true)}>Withdraw</button>;
  return (
    <form action={action} className="no-print" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <input type="hidden" name="registration_id" value={registrationId} />
      {examId && <input type="hidden" name="mock_exam_id" value={examId} />}
      {studentId && <input type="hidden" name="student_id" value={studentId} />}
      <input name="reason" required autoFocus placeholder="Reason" style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, width: 170 }} />
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>{pending ? "…" : "Withdraw"}</button>
      <button type="button" className="linkbtn" onClick={() => setOpen(false)}>Cancel</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)", width: "100%", textAlign: "right" }}>{state.error}</span>}
    </form>
  );
}

export function AttendanceSelect({ registrationId, examId, status }: { registrationId: string; examId: string; status: string }) {
  return (
    <form action={setMockAttendance} className="no-print">
      <input type="hidden" name="registration_id" value={registrationId} />
      <input type="hidden" name="mock_exam_id" value={examId} />
      <select
        name="status" defaultValue={status} aria-label="Attendance"
        style={{ ...inputStyle, padding: "4px 8px", fontSize: 12 }}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="registered">Not marked</option>
        <option value="sat">Sat</option>
        <option value="absent">Absent</option>
      </select>
    </form>
  );
}

export function CancelExamForm({ examId, candidates }: { examId: string; candidates: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(cancelMockExam, null);
  if (state?.ok) return <div className="sub" style={{ color: "var(--ok)" }}>{state.message}</div>;
  if (!open) {
    return <button type="button" className="btn ghost no-print" onClick={() => setOpen(true)} style={{ fontSize: 12, padding: "6px 10px" }}>Cancel this exam</button>;
  }
  return (
    <form action={action} className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="id" value={examId} />
      <input name="reason" required autoFocus placeholder="Reason, e.g. hall unavailable" style={{ ...inputStyle, width: 240 }} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Cancelling…" : "Cancel exam"}</button>
      <button type="button" className="linkbtn" onClick={() => setOpen(false)}>Keep it</button>
      <span className="sub" style={{ width: "100%" }}>
        {candidates
          ? `All ${candidates} candidate(s) will be withdrawn; unpaid fees come off their invoices, paid ones stay for you to refund or credit.`
          : "No candidates are registered."}
      </span>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}
