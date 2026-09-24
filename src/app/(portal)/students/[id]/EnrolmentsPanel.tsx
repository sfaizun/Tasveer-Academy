"use client";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import Req from "@/components/Req";
import { taka, fmtDate, currentBillingMonth } from "@/lib/format";
import { addEnrolment, removeEnrolment, setEnrolmentStart, setEnrolmentEnd, setEnrolmentClassGroup, setEnrolmentDiscount } from "./actions";
import { groupSubjects, type SubjectForGrouping } from "@/lib/subjectGroups";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type Subject = SubjectForGrouping;
type Teacher = { id: string; full_name: string };
type TeacherSubject = { teacher_id: string; subject_id: string };
type ClassGroup = { subject_id: string; teacher_id: string; batch_name: string };
export type Enrolment = {
  id: string;
  level: string | null;
  from_month: string;
  to_month: string | null;
  rate_applied: number;
  status: string;
  subject: { id: string; name: string } | null;
  teacher: { id: string; full_name: string } | null;
  batch_name: string | null;
  discount_pct: number | null;
  discount_amt: number | null;
  discount_reason: string | null;
};

function discountLabel(e: Enrolment) {
  if (e.discount_pct) return `${e.discount_pct}%${e.discount_reason ? ` — ${e.discount_reason}` : ""}`;
  if (e.discount_amt) return `${taka(e.discount_amt)}/mo${e.discount_reason ? ` — ${e.discount_reason}` : ""}`;
  return null;
}

function AddSubjectForm({
  studentId,
  subjects,
  teachers,
  teacherSubjects,
  classGroups,
}: {
  studentId: string;
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  classGroups: ClassGroup[];
}) {
  const [state, action, pending] = useActionState(addEnrolment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const currentMonth = useMemo(() => currentBillingMonth().slice(0, 7), []);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSubjectId("");
      setTeacherId("");
    }
  }, [state]);

  const subjectGroups = useMemo(() => groupSubjects(subjects), [subjects]);
  const eligibleTeachers = useMemo(() => {
    if (!subjectId) return [];
    const ids = new Set(teacherSubjects.filter((ts) => ts.subject_id === subjectId).map((ts) => ts.teacher_id));
    return teachers.filter((t) => ids.has(t.id));
  }, [subjectId, teacherSubjects, teachers]);
  const existingBatches = useMemo(
    () =>
      Array.from(
        new Set(
          classGroups.filter((g) => g.subject_id === subjectId && g.teacher_id === teacherId).map((g) => g.batch_name)
        )
      ),
    [classGroups, subjectId, teacherId]
  );

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
          <select
            key={subjectId}
            style={inputStyle}
            name="teacher_id"
            required
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={!subjectId}
          >
            <option value="" disabled>
              {subjectId ? (eligibleTeachers.length ? "Choose…" : "No teacher mapped to this subject") : "Choose a subject first"}
            </option>
            {eligibleTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Batch</label>
          <input style={inputStyle} type="text" name="batch" placeholder="1" list="existing-batches" />
          <datalist id="existing-batches">
            {existingBatches.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          {existingBatches.length > 0 && (
            <div className="sub" style={{ marginTop: 4 }}>
              Existing batches for this subject/teacher: {existingBatches.join(", ")}
            </div>
          )}
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
        Pick an existing batch to put this student on the routine they&apos;ll actually attend, or type a
        new batch name to start one. If this month&apos;s bill has already been issued and isn&apos;t
        fully paid yet, the new subject&apos;s fee is added to it right away. Otherwise it starts on the
        next monthly bill.
      </div>
    </form>
  );
}

// Edits when this subject started. Blocked server-side (fn_set_enrolment_start) once the
// subject has already been billed for a month before the requested start — moving past
// that would leave this record disagreeing with an invoice that's already gone out, so
// the database names the exact month and refuses instead of silently allowing it.
function StartSubjectForm({ studentId, enrolment }: { studentId: string; enrolment: Enrolment }) {
  const [state, action, pending] = useActionState(setEnrolmentStart, null);

  return (
    <form action={action} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="enrolment_id" value={enrolment.id} />
      <label className="sub" style={{ whiteSpace: "nowrap" }}>Studying since:</label>
      <input
        style={{ ...inputStyle, width: "auto" }}
        type="month"
        name="from_month"
        max={enrolment.to_month ? enrolment.to_month.slice(0, 7) : undefined}
        defaultValue={enrolment.from_month.slice(0, 7)}
      />
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12 }}>
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
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

// Moves this subject to a different teacher and/or batch — "editing" which class the
// student is actually on, e.g. after a schedule clash, without touching billing history.
function ChangeClassForm({
  studentId,
  enrolment,
  teachers,
  teacherSubjects,
  classGroups,
}: {
  studentId: string;
  enrolment: Enrolment;
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  classGroups: ClassGroup[];
}) {
  const [state, action, pending] = useActionState(setEnrolmentClassGroup, null);
  const [teacherId, setTeacherId] = useState(enrolment.teacher?.id ?? "");

  const eligibleTeachers = useMemo(() => {
    const subjectId = enrolment.subject?.id;
    if (!subjectId) return teachers;
    const ids = new Set(teacherSubjects.filter((ts) => ts.subject_id === subjectId).map((ts) => ts.teacher_id));
    return teachers.filter((t) => ids.has(t.id));
  }, [enrolment.subject?.id, teacherSubjects, teachers]);

  const existingBatches = useMemo(
    () =>
      Array.from(
        new Set(
          classGroups
            .filter((g) => g.subject_id === enrolment.subject?.id && g.teacher_id === teacherId)
            .map((g) => g.batch_name)
        )
      ),
    [classGroups, enrolment.subject?.id, teacherId]
  );

  return (
    <form action={action} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="enrolment_id" value={enrolment.id} />
      <label className="sub" style={{ whiteSpace: "nowrap" }}>Teacher:</label>
      <select
        style={{ ...inputStyle, width: "auto" }}
        name="teacher_id"
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
      >
        {eligibleTeachers.map((t) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
      <label className="sub" style={{ whiteSpace: "nowrap" }}>Batch:</label>
      <input
        style={{ ...inputStyle, width: 90 }}
        type="text"
        name="batch"
        defaultValue={enrolment.batch_name ?? ""}
        list={`existing-batches-${enrolment.id}`}
      />
      <datalist id={`existing-batches-${enrolment.id}`}>
        {existingBatches.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12 }}>
        {pending ? "Saving…" : "Move"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Moved.</span>}
    </form>
  );
}

// Sets or clears a recurring monthly discount on this one subject — a percentage or a
// fixed amount, applied automatically on every future bill (and to this month's, if it's
// already issued and still open).
function DiscountForm({ studentId, enrolment }: { studentId: string; enrolment: Enrolment }) {
  const [state, action, pending] = useActionState(setEnrolmentDiscount, null);
  const [kind, setKind] = useState<"pct" | "amt">(enrolment.discount_amt ? "amt" : "pct");

  return (
    <form action={action} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="enrolment_id" value={enrolment.id} />
      <label className="sub" style={{ whiteSpace: "nowrap" }}>Discount:</label>
      <select
        style={{ ...inputStyle, width: "auto" }}
        name="discount_kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as "pct" | "amt")}
      >
        <option value="pct">Percentage</option>
        <option value="amt">Fixed amount / month</option>
      </select>
      <input
        style={{ ...inputStyle, width: 100 }}
        type="number"
        name="discount_value"
        min="0"
        step="0.01"
        placeholder={kind === "pct" ? "e.g. 10" : "e.g. 200"}
        defaultValue={enrolment.discount_pct ?? enrolment.discount_amt ?? ""}
      />
      <input
        style={{ ...inputStyle, width: 160 }}
        type="text"
        name="discount_reason"
        placeholder="Reason (e.g. sibling)"
        defaultValue={enrolment.discount_reason ?? ""}
      />
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12 }}>
        {pending ? "Saving…" : "Save"}
      </button>
      {(enrolment.discount_pct || enrolment.discount_amt) && (
        <span className="sub">Leave the value blank and save to clear the discount.</span>
      )}
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
    </form>
  );
}

export default function EnrolmentsPanel({
  studentId,
  enrolments,
  subjects,
  teachers,
  teacherSubjects,
  classGroups,
  canEdit,
}: {
  studentId: string;
  enrolments: Enrolment[];
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  classGroups: ClassGroup[];
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
              <th>Subject</th><th>Teacher</th><th>Batch</th><th>From</th><th>Till</th>
              <th className="n">Rate / month</th><th>Discount</th><th className="n"></th>
            </tr>
          </thead>
          <tbody>
            {enrolments.map((e) => {
              const ended = !!e.to_month && e.to_month < today;
              const isOpen = open === e.id;
              const discount = discountLabel(e);
              return (
                <Fragment key={e.id}>
                  <tr>
                    <td>{e.subject?.name}{e.level ? ` (${String(e.level).toUpperCase()})` : ""}</td>
                    <td className="sub">{e.teacher?.full_name}</td>
                    <td className="mono sub">{e.batch_name ?? "—"}</td>
                    <td className="mono sub">{fmtDate(e.from_month)}</td>
                    <td className="mono sub">{e.to_month ? fmtDate(e.to_month) : "—"}</td>
                    <td className="n mono">{taka(e.rate_applied)}</td>
                    <td className="sub">{discount ?? "—"}</td>
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
                      <td colSpan={8} style={{ padding: "12px 16px", background: "var(--tint)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div className="lbl" style={{ marginBottom: 6 }}>Change class (teacher / batch)</div>
                            <ChangeClassForm
                              studentId={studentId}
                              enrolment={e}
                              teachers={teachers}
                              teacherSubjects={teacherSubjects}
                              classGroups={classGroups}
                            />
                          </div>
                          <div>
                            <div className="lbl" style={{ marginBottom: 6 }}>Subject discount</div>
                            <DiscountForm studentId={studentId} enrolment={e} />
                          </div>
                          <div>
                            <div className="lbl" style={{ marginBottom: 6 }}>Start month</div>
                            <StartSubjectForm studentId={studentId} enrolment={e} />
                          </div>
                          <div>
                            <div className="lbl" style={{ marginBottom: 6 }}>End date</div>
                            <EndSubjectForm studentId={studentId} enrolment={e} />
                          </div>
                          <div>
                            <RemoveSubjectForm studentId={studentId} enrolment={e} />
                            <div className="sub" style={{ marginTop: 6 }}>
                              &ldquo;Remove subject&rdquo; only works if this subject hasn&apos;t appeared on an
                              invoice yet — once it&apos;s been billed, set an end month instead so the invoice
                              history stays intact.
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {enrolments.length === 0 && (
              <tr><td colSpan={8} className="sub">No subjects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div style={{ padding: 16, borderTop: "1px solid var(--line)" }}>
          <div className="lbl" style={{ marginBottom: 8 }}>Add a subject</div>
          <AddSubjectForm
            studentId={studentId}
            subjects={subjects}
            teachers={teachers}
            teacherSubjects={teacherSubjects}
            classGroups={classGroups}
          />
        </div>
      )}
    </div>
  );
}
