"use client";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import Req from "@/components/Req";
import { taka, fmtDate, currentBillingMonth } from "@/lib/format";
import { addEnrolment, removeEnrolment, setEnrolmentEnd } from "./actions";
import { groupSubjects, type SubjectForGrouping } from "@/lib/subjectGroups";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type Subject = SubjectForGrouping;
type Teacher = { id: string; full_name: string };
type TeacherSubject = { teacher_id: string; subject_id: string };
export type Enrolment = {
  id: string;
  level: string | null;
  from_month: string;
  to_month: string | null;
  rate_applied: number;
  status: string;
  subject: { name: string } | null;
  teacher: { full_name: string } | null;
};

function AddSubjectForm({
  studentId,
  subjects,
  teachers,
  teacherSubjects,
}: {
  studentId: string;
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
}) {
  const [state, action, pending] = useActionState(addEnrolment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [subjectId, setSubjectId] = useState("");
  const currentMonth = useMemo(() => currentBillingMonth().slice(0, 7), []);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSubjectId("");
    }
  }, [state]);

  const subjectGroups = useMemo(() => groupSubjects(subjects), [subjects]);
  const eligibleTeachers = useMemo(() => {
    if (!subjectId) return [];
    const ids = new Set(teacherSubjects.filter((ts) => ts.subject_id === subjectId).map((ts) => ts.teacher_id));
    return teachers.filter((t) => ids.has(t.id));
  }, [subjectId, teacherSubjects, teachers]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Subject<Req /></label>
          <select
            style={inputStyle}
            name="subject_id"
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="" disabled>Choose…</option>
            {subjectGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Teacher<Req /></label>
          <select key={subjectId} style={inputStyle} name="teacher_id" required defaultValue="" disabled={!subjectId}>
            <option value="" disabled>
              {subjectId ? (eligibleTeachers.length ? "Choose…" : "No teacher mapped to this subject") : "Choose a subject first"}
            </option>
            {eligibleTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Starting from</label>
          <input style={inputStyle} type="month" name="from_month" min={currentMonth} defaultValue={currentMonth} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Adding…" : "+ Add subject"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Added.</span>}
      </div>
      <div className="sub">
        If this month's bill has already been issued and isn't fully paid yet, the new subject's
        fee is added to it right away. Otherwise it starts on the next monthly bill.
      </div>
    </form>
  );
}

function EndSubjectForm({ studentId, enrolment }: { studentId: string; enrolment: Enrolment }) {
  const [state, action, pending] = useActionState(setEnrolmentEnd, null);
  const [clearState, clearAction, clearPending] = useActionState(setEnrolmentEnd, null);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <form action={action} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="enrolment_id" value={enrolment.id} />
        <label className="sub" style={{ whiteSpace: "nowrap" }}>Study till (last billed month):</label>
        <input
          style={{ ...inputStyle, width: "auto" }}
          type="month"
          name="to_month"
          min={enrolment.from_month.slice(0, 7)}
          defaultValue={enrolment.to_month ? enrolment.to_month.slice(0, 7) : ""}
        />
        <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12 }}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
      </form>
      {enrolment.to_month && (
        <form action={clearAction}>
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="enrolment_id" value={enrolment.id} />
          <button className="btn ghost" type="submit" disabled={clearPending} style={{ fontSize: 12 }}>
            {clearPending ? "Clearing…" : "Clear (open-ended)"}
          </button>
          {clearState?.error && <span className="sub" style={{ color: "var(--crit)", marginLeft: 8 }}>{clearState.error}</span>}
        </form>
      )}
    </div>
  );
}

function RemoveSubjectForm({ studentId, enrolment }: { studentId: string; enrolment: Enrolment }) {
  const [state, action, pending] = useActionState(removeEnrolment, null);
  return (
    <form action={action} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="enrolment_id" value={enrolment.id} />
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, color: "var(--crit)" }}>
        {pending ? "Removing…" : "Remove subject"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

export default function EnrolmentsPanel({
  studentId,
  enrolments,
  subjects,
  teachers,
  teacherSubjects,
  canEdit,
}: {
  studentId: string;
  enrolments: Enrolment[];
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const today = useMemo(() => currentBillingMonth(), []);

  return (
    <div className="panel">
      <div className="phead"><div className="ptitle">Subjects</div></div>

      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Subject</th><th>Teacher</th><th>From</th><th>Till</th>
              <th className="n">Rate / month</th><th className="n"></th>
            </tr>
          </thead>
          <tbody>
            {enrolments.map((e) => {
              const ended = !!e.to_month && e.to_month < today;
              const isOpen = open === e.id;
              return (
                <Fragment key={e.id}>
                  <tr>
                    <td>{e.subject?.name}{e.level ? ` (${String(e.level).toUpperCase()})` : ""}</td>
                    <td className="sub">{e.teacher?.full_name}</td>
                    <td className="mono sub">{fmtDate(e.from_month)}</td>
                    <td className="mono sub">{e.to_month ? fmtDate(e.to_month) : "—"}</td>
                    <td className="n mono">{taka(e.rate_applied)}</td>
                    <td className="n">
                      {ended ? (
                        <span className="sub">Ended</span>
                      ) : canEdit ? (
                        <button
                          className="btn ghost"
                          type="button"
                          style={{ fontSize: 12, padding: "6px 10px" }}
                          onClick={() => setOpen(isOpen ? null : e.id)}
                        >
                          {isOpen ? "Close" : "Manage"}
                        </button>
                      ) : (
                        <span className="sub">Active</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && canEdit && (
                    <tr>
                      <td colSpan={6} style={{ padding: "12px 16px", background: "var(--tint)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <EndSubjectForm studentId={studentId} enrolment={e} />
                          <RemoveSubjectForm studentId={studentId} enrolment={e} />
                          <div className="sub">
                            "Remove subject" only works if this subject hasn't appeared on an
                            invoice yet — once it's been billed, set an end month instead so the
                            invoice history stays intact.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {enrolments.length === 0 && (
              <tr><td colSpan={6} className="sub">No subjects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div style={{ padding: 16, borderTop: "1px solid var(--line)" }}>
          <div className="lbl" style={{ marginBottom: 8 }}>Add a subject</div>
          <AddSubjectForm studentId={studentId} subjects={subjects} teachers={teachers} teacherSubjects={teacherSubjects} />
        </div>
      )}
    </div>
  );
}
