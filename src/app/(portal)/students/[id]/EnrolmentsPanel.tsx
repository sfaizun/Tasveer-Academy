"use client";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import Req from "@/components/Req";
import { taka, fmtDate, currentBillingMonth } from "@/lib/format";
import { addEnrolment, removeEnrolment, setEnrolmentStart, setEnrolmentEnd, setEnrolmentClassGroup, setEnrolmentDiscount, setEnrolmentMonths } from "./actions";
import { type InvoiceLite, type MonthOption, MonthChecklist, addMonths, billingOptions, monthKey, monthLabel } from "./BillMonths";
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

const warnBox: React.CSSProperties = {
  border: "1px solid var(--warn)", background: "var(--warn-soft)", borderRadius: 8, padding: "12px 14px",
  display: "flex", flexDirection: "column", gap: 10,
};

/** Keeps the ticks in step with the month list: months that already have an invoice are
 * ticked again whenever the list changes (a different start month was picked). Months
 * with no invoice start unticked, since ticking them creates a new invoice. */
function useMonthTicks(options: MonthOption[]) {
  const sig = options.filter((o) => o.selectable && !o.billed && o.invoice).map((o) => o.month).join(",");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    setChecked(new Set(sig ? sig.split(",") : []));
  }, [sig]);
  return [checked, setChecked] as const;
}

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
  invoices,
  showFees,
}: {
  studentId: string;
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  classGroups: ClassGroup[];
  invoices: InvoiceLite[];
  showFees: boolean;
}) {
  const [state, action, pending] = useActionState(addEnrolment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const current = useMemo(() => currentBillingMonth(), []);
  const currentMonth = current.slice(0, 7);
  const [fromMonth, setFromMonth] = useState(currentMonth);

  // Months from the chosen start up to now that already have an invoice (or would get one).
  // The admin decides which of them this subject is added to.
  const options = useMemo(
    () => (/^\d{4}-\d{2}$/.test(fromMonth) && `${fromMonth}-01` <= current
      ? billingOptions({ from: `${fromMonth}-01`, to: current, invoices, current })
      : []),
    [fromMonth, current, invoices]
  );
  const choices = options.filter((o) => o.selectable);
  const [checked, setChecked] = useMonthTicks(options);
  // Without fee access the month choice isn't shown; earlier months are billed as before.
  const askMonths = showFees && choices.length > 0;
  const existing = choices.filter((o) => o.invoice).length;

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSubjectId("");
      setTeacherId("");
      setFromMonth(currentMonth);
    }
  }, [state, currentMonth]);

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
          <input style={inputStyle} type="month" name="from_month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
        </div>
      </div>

      {askMonths && (
        <div style={warnBox} role="alert">
          <div style={{ fontWeight: 600, color: "var(--warn)" }}>
            {existing > 0
              ? `${existing === 1 ? "An invoice already exists" : `Invoices already exist for ${existing} months`} from ${monthLabel(`${fromMonth}-01`)}. Adding a subject does not change them unless you tick them below.`
              : `Starting in ${monthLabel(`${fromMonth}-01`)} covers months already past. Which months should be billed?`}
          </div>
          <div className="sub" style={{ marginTop: -4 }}>
            Ticked months get this subject&apos;s monthly fee. Unticked months are left as they are; you can add the
            subject to them later from Manage, under &ldquo;Months billed&rdquo;.
          </div>
          <MonthChecklist options={options} checked={checked} onChange={setChecked} mode="choose" />
          <input type="hidden" name="bill_months" value={JSON.stringify([...checked].sort())} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending
            ? "Adding…"
            : askMonths && checked.size > 0
              ? `+ Add subject and bill ${checked.size} ${checked.size === 1 ? "month" : "months"}`
              : askMonths
                ? "+ Add subject without billing these months"
                : "+ Add subject"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Added.</span>}
      </div>
      <div className="sub">
        Pick an existing batch to put this student on the routine they&apos;ll actually attend, or type a
        new batch name to start one. You can start from a past month: you&apos;ll be asked which of the
        months up to now should carry this subject&apos;s fee. A future month starts on that month&apos;s bill.
        {!showFees && " Earlier months' invoices get this subject automatically."}
      </div>
    </form>
  );
}

// Edits when this subject started. Blocked server-side (fn_set_enrolment_start) once the
// subject has already been billed for a month before the requested start — moving past
// that would leave this record disagreeing with an invoice that's already gone out, so
// the database names the exact month and refuses instead of silently allowing it.
function StartSubjectForm({ studentId, enrolment, invoices, showFees }: { studentId: string; enrolment: Enrolment; invoices: InvoiceLite[]; showFees: boolean }) {
  const [state, action, pending] = useActionState(setEnrolmentStart, null);
  const oldFrom = monthKey(enrolment.from_month);
  const [fromMonth, setFromMonth] = useState(oldFrom.slice(0, 7));
  const current = useMemo(() => currentBillingMonth(), []);

  // Moving the start earlier: the months between the new and the old start already have
  // invoices (or would need one). Ask which of them should get this subject.
  const newFrom = /^\d{4}-\d{2}$/.test(fromMonth) ? `${fromMonth}-01` : oldFrom;
  const options = useMemo(() => {
    if (newFrom >= oldFrom) return [];
    let to = addMonths(oldFrom, -1);
    if (to > current) to = current;
    return billingOptions({ from: newFrom, to, invoices, current, enrolmentId: enrolment.id });
  }, [newFrom, oldFrom, current, invoices, enrolment.id]);
  const choices = options.filter((o) => o.selectable && !o.billed);
  const [checked, setChecked] = useMonthTicks(options);
  const askMonths = showFees && choices.length > 0;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="enrolment_id" value={enrolment.id} />
        <label className="sub" style={{ whiteSpace: "nowrap" }}>Studying since:</label>
        <input
          style={{ ...inputStyle, width: "auto" }}
          type="month"
          name="from_month"
          max={enrolment.to_month ? enrolment.to_month.slice(0, 7) : undefined}
          value={fromMonth}
          onChange={(e) => setFromMonth(e.target.value)}
        />
        <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12 }}>
          {pending ? "Saving…" : askMonths && checked.size > 0 ? `Save and bill ${checked.size} ${checked.size === 1 ? "month" : "months"}` : askMonths ? "Save without billing these months" : "Save"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>{state.message ?? "Saved."}</span>}
      </div>
      {askMonths && (
        <div style={warnBox} role="alert">
          <div style={{ fontWeight: 600, color: "var(--warn)" }}>
            Moving the start to {monthLabel(newFrom)} does not change invoices already issued. Tick the months this subject should be added to.
          </div>
          <div className="sub" style={{ marginTop: -4 }}>
            Ticked months get this subject&apos;s fee ({taka(enrolment.rate_applied)}
            {discountLabel(enrolment) ? `, less its discount` : ""}). Unticked months stay as they are.
          </div>
          <MonthChecklist options={options} checked={checked} onChange={setChecked} rate={enrolment.rate_applied} mode="choose" />
          <input type="hidden" name="bill_months" value={JSON.stringify([...checked].sort())} />
        </div>
      )}
    </form>
  );
}

// Which months' invoices carry this subject. Tick to add the subject to a month's invoice,
// untick to take it off. Covers the months the subject is studied, plus any month outside
// that range where it still appears on an invoice.
function MonthsBilledForm({ studentId, enrolment, invoices }: { studentId: string; enrolment: Enrolment; invoices: InvoiceLite[] }) {
  const [state, action, pending] = useActionState(setEnrolmentMonths, null);
  const current = useMemo(() => currentBillingMonth(), []);

  const options = useMemo(() => {
    const latest = invoices.reduce((m, i) => (monthKey(i.billing_month) > m ? monthKey(i.billing_month) : m), current);
    const from = monthKey(enrolment.from_month);
    const to = enrolment.to_month && monthKey(enrolment.to_month) < latest ? monthKey(enrolment.to_month) : latest;
    const inRange = from <= to ? billingOptions({ from, to, invoices, current, enrolmentId: enrolment.id }) : [];
    const outside: MonthOption[] = invoices
      .filter((i) => i.enrolment_ids.includes(enrolment.id) && !inRange.some((o) => o.month === monthKey(i.billing_month)))
      .map((i) => ({ month: monthKey(i.billing_month), invoice: i, billed: true, selectable: false, note: "Outside the months studied" }));
    return [...inRange, ...outside].sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [invoices, enrolment.from_month, enrolment.to_month, enrolment.id, current]);

  const billedSig = options.filter((o) => o.billed).map((o) => o.month).join(",");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    setChecked(new Set(billedSig ? billedSig.split(",") : []));
  }, [billedSig]);

  const add = options.filter((o) => !o.billed && checked.has(o.month)).map((o) => o.month);
  const remove = options.filter((o) => o.billed && !checked.has(o.month)).map((o) => o.month);
  const dirty = add.length + remove.length > 0;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="enrolment_id" value={enrolment.id} />
      <input type="hidden" name="add" value={JSON.stringify(add)} />
      <input type="hidden" name="remove" value={JSON.stringify(remove)} />
      {options.length ? (
        <MonthChecklist options={options} checked={checked} onChange={setChecked} rate={enrolment.rate_applied} mode="edit" />
      ) : (
        <div className="sub">No months to show yet.</div>
      )}
      {dirty && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="sub">
            {add.length > 0 && <>Add to {add.map(monthLabel).join(", ")}. </>}
            {remove.length > 0 && <>Take off {remove.map(monthLabel).join(", ")}.</>}
          </span>
          {remove.length > 0 && (
            <input
              style={{ ...inputStyle, width: 260 }}
              type="text"
              name="reason"
              required
              maxLength={300}
              placeholder="Reason for taking it off (required)"
            />
          )}
          <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "7px 14px" }}>
            {pending ? "Saving…" : "Save months"}
          </button>
          <button className="btn ghost" type="button" style={{ fontSize: 12 }} onClick={() => setChecked(new Set(billedSig ? billedSig.split(",") : []))}>
            Undo
          </button>
        </div>
      )}
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && !dirty && <span className="sub" style={{ color: "var(--ok)" }}>{state.message ?? "Saved."}</span>}
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
  invoices = [],
  canEdit,
  showFees = true,
}: {
  studentId: string;
  enrolments: Enrolment[];
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  classGroups: ClassGroup[];
  invoices?: InvoiceLite[];
  canEdit: boolean;
  showFees?: boolean;
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
              {showFees && <><th className="n">Rate / month</th><th>Discount</th></>}<th className="n"></th>
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
                    {showFees && <td className="n mono">{taka(e.rate_applied)}</td>}
                    {showFees && <td className="sub">{discount ?? "—"}</td>}
                    <td className="n">
                      {ended && canEdit && showFees ? (
                        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          <span className="sub">Ended</span>
                          <button
                            className="btn ghost"
                            type="button"
                            style={{ fontSize: 12, padding: "6px 10px" }}
                            onClick={() => setOpen(isOpen ? null : e.id)}
                          >
                            {isOpen ? "Close" : "Months"}
                          </button>
                        </span>
                      ) : ended ? (
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
                  {isOpen && canEdit && ended && (
                    <tr>
                      <td colSpan={showFees ? 8 : 6} style={{ padding: "12px 16px", background: "var(--tint)" }}>
                        <div className="lbl" style={{ marginBottom: 6 }}>Months billed</div>
                        <MonthsBilledForm studentId={studentId} enrolment={e} invoices={invoices} />
                      </td>
                    </tr>
                  )}
                  {isOpen && canEdit && !ended && (
                    <tr>
                      <td colSpan={showFees ? 8 : 6} style={{ padding: "12px 16px", background: "var(--tint)" }}>
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
                          {showFees && (
                            <div>
                              <div className="lbl" style={{ marginBottom: 6 }}>Subject discount</div>
                              <DiscountForm studentId={studentId} enrolment={e} />
                            </div>
                          )}
                          <div>
                            <div className="lbl" style={{ marginBottom: 6 }}>Start month</div>
                            <StartSubjectForm studentId={studentId} enrolment={e} invoices={invoices} showFees={showFees} />
                          </div>
                          {showFees && <div>
                            <div className="lbl" style={{ marginBottom: 6 }}>Months billed</div>
                            <div className="sub" style={{ marginBottom: 6 }}>
                              Tick a month to add this subject to that month&apos;s invoice, untick to take it off.
                            </div>
                            <MonthsBilledForm studentId={studentId} enrolment={e} invoices={invoices} />
                          </div>}
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
              <tr><td colSpan={showFees ? 8 : 6} className="sub">No subjects yet.</td></tr>
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
            invoices={invoices}
            showFees={showFees}
          />
        </div>
      )}
    </div>
  );
}
