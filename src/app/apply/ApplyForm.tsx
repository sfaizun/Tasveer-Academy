"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { submitApplication, type ApplicationPayload } from "./actions";

export type CatalogueData = {
  admissionFee: number;
  mockFee: number;
  classLevels: { id: string; code: string; name: string; monthlyFee: number }[];
  subjects: {
    id: string;
    name: string;
    level: "as" | "a2" | null;
    programmeCode: string;
    monthlyFee: number;
    teachers: { id: string; name: string }[];
  }[];
};

type ProgrammeCode = "" | "junior" | "o_level" | "a_level";

type SubjectRow = { key: string; subjectId: string; teacherId: string; fromMonth: string };
type SiblingRow = { key: string; fullName: string; className: string; schoolName: string };

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 7,
  padding: "10px 12px",
  fontSize: 14,
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "inherit",
  width: "100%",
};

const taStyle: React.CSSProperties = { ...selStyle, resize: "vertical", minHeight: 64 };

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function monthISO(dateISO: string) {
  return dateISO.slice(0, 7);
}
function newKey() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function taka(n: number) {
  return "৳" + n.toLocaleString("en-BD", { maximumFractionDigits: 0 });
}
function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label className="lbl">
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: "var(--coral)" }}>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && <div className="sub">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

export default function ApplyForm({ catalogue }: { catalogue: CatalogueData }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ref: string } | null>(null);
  const [slow, setSlow] = useState(false);

  // If a submission is still pending after a few seconds, say so rather than
  // leaving the button reading "Submitting…" with nothing else to go on —
  // a dropped response shouldn't look identical to a healthy slow connection.
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [pending]);

  const [visitDate, setVisitDate] = useState(todayISO());
  const [previousRegNo, setPreviousRegNo] = useState("");
  const [programme, setProgramme] = useState<ProgrammeCode>("");
  const [startMonth, setStartMonth] = useState(monthISO(todayISO()));
  const [classLevelCode, setClassLevelCode] = useState("");
  // Mock-only candidates (O/A Level) come just to sit mock exams in chosen subjects —
  // no ongoing class, no teacher, no monthly billing, only a one-time invoice.
  const [mockOnly, setMockOnly] = useState(false);
  const isMockEligible = programme === "o_level" || programme === "a_level";
  const isMock = isMockEligible && mockOnly;

  const [student, setStudent] = useState({
    full_name: "",
    gender: "",
    nationality: "Bangladeshi",
    phone: "",
    email: "",
    address: "",
    school_name: "",
  });

  const [guardian, setGuardian] = useState({
    full_name: "",
    relation: "",
    father_name: "",
    mother_name: "",
    phone: "",
    email: "",
    address: "",
  });

  const [siblings, setSiblings] = useState<SiblingRow[]>([]);
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([
    { key: newKey(), subjectId: "", teacherId: "", fromMonth: monthISO(todayISO()) },
  ]);
  const [accepted, setAccepted] = useState(false);

  const subjectOptions = useMemo(
    () => catalogue.subjects.filter((s) => s.programmeCode === programme),
    [catalogue.subjects, programme]
  );
  const selectedClassLevel = catalogue.classLevels.find((c) => c.code === classLevelCode);

  function subjectLabel(s: CatalogueData["subjects"][number]) {
    return s.level ? `${s.name} (${s.level.toUpperCase()})` : s.name;
  }

  function addSibling() {
    setSiblings((rows) => [...rows, { key: newKey(), fullName: "", className: "", schoolName: "" }]);
  }
  function removeSibling(key: string) {
    setSiblings((rows) => rows.filter((r) => r.key !== key));
  }

  function addSubjectRow() {
    setSubjectRows((rows) =>
      rows.length >= 10 ? rows : [...rows, { key: newKey(), subjectId: "", teacherId: "", fromMonth: startMonth }]
    );
  }
  function removeSubjectRow(key: string) {
    setSubjectRows((rows) => rows.filter((r) => r.key !== key));
  }

  const monthlyTotal = useMemo(() => {
    if (isMock) return 0; // mock candidates have no ongoing class, so nothing recurs monthly
    if (programme === "junior") return selectedClassLevel?.monthlyFee ?? 0;
    if (programme === "o_level" || programme === "a_level") {
      return subjectRows.reduce((sum, row) => {
        const s = catalogue.subjects.find((x) => x.id === row.subjectId);
        return sum + (s?.monthlyFee ?? 0);
      }, 0);
    }
    return 0;
  }, [isMock, programme, selectedClassLevel, subjectRows, catalogue.subjects]);

  // Flat, one-time mock exam fee — same whether the candidate is sitting O Level or
  // A Level mocks, and regardless of how many subjects (decision, 14 Sep 2026).
  const mockFeeTotal = isMock ? catalogue.mockFee : 0;

  // Admission fee is charged per subject for O Level / A Level (one unit of the admission
  // rate for every subject enrolled at admission); Junior has no subject concept, so it
  // stays a single flat charge per student.
  const enrolledSubjectCount = useMemo(
    () => subjectRows.filter((r) => r.subjectId).length,
    [subjectRows]
  );
  const admissionFeeTotal = useMemo(() => {
    if (programme === "o_level" || programme === "a_level") {
      return catalogue.admissionFee * enrolledSubjectCount;
    }
    return catalogue.admissionFee;
  }, [programme, catalogue.admissionFee, enrolledSubjectCount]);

  // Always the full month's fee — the academy no longer pro-rates a student's first
  // month by calendar days for a mid-month start; a reduced first-month charge, if one
  // is ever needed, is applied afterwards by admin as a manual discount instead
  // (decision, 14 Sep 2026).
  const firstMonthEstimate = monthlyTotal;

  function validateClient(): string | null {
    if (!student.full_name.trim()) return "Enter the student's full name.";
    if (!student.phone.trim()) return "Enter the student's WhatsApp/mobile number.";
    if (!guardian.full_name.trim()) return "Enter the guardian's full name.";
    if (!guardian.phone.trim()) return "Enter the guardian's WhatsApp/mobile number.";
    if (!programme) return "Choose a programme.";
    if (programme === "junior" && !classLevelCode) return "Choose a class level.";
    if (programme !== "junior") {
      const valid = subjectRows.filter((r) => r.subjectId);
      if (valid.length === 0) return "Add at least one subject.";
      if (!isMock && valid.some((r) => !r.teacherId)) return "Choose a teacher for every subject row.";
      const subjectIds = valid.map((r) => r.subjectId);
      if (new Set(subjectIds).size !== subjectIds.length) return "Each subject can only be selected once.";
    }
    if (!accepted) return "Please accept the declaration to submit.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    const subjectsPayload = subjectRows
      .filter((r) => r.subjectId)
      .map((r) => {
        const s = catalogue.subjects.find((x) => x.id === r.subjectId)!;
        const t = s.teachers.find((x) => x.id === r.teacherId);
        return {
          subject_id: s.id,
          subject_name: s.name,
          level: s.level,
          teacher_id: r.teacherId,
          teacher_name: t?.name ?? "",
          from_month: r.fromMonth,
          monthly_fee: s.monthlyFee,
        };
      });

    const payload: ApplicationPayload = {
      visit_date: visitDate,
      previous_reg_no: previousRegNo.trim() || null,
      programme_code: programme as "junior" | "o_level" | "a_level",
      class_level_code: programme === "junior" ? classLevelCode : null,
      start_month: startMonth,
      mock_only: isMock,
      student,
      guardian,
      siblings: siblings
        .filter((r) => r.fullName.trim())
        .map((r) => ({ full_name: r.fullName, class_name: r.className, school_name: r.schoolName })),
      subjects: subjectsPayload,
      fee_summary: {
        admission_fee: admissionFeeTotal,
        monthly_total: monthlyTotal,
        first_month_estimate: firstMonthEstimate,
        mock_fee: mockFeeTotal,
        note: isMock
          ? "Indicative only. Mock exam candidates pay the admission fee and the flat mock exam fee once, on approval — no monthly billing."
          : "Indicative only. The academy generates the actual first invoice on approval, charging the full month's fee (not pro-rated).",
      },
      declaration_accepted: accepted,
    };

    startTransition(async () => {
      const res = await submitApplication(payload);
      if (res.ok) {
        setResult({ ref: res.ref });
      } else {
        setError(res.error);
      }
    });
  }

  if (result) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--ground)" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div className="panel" style={{ padding: 30, textAlign: "center" }}>
            <div className="mark" style={{ width: 44, height: 44, margin: "0 auto 16px", fontSize: 15 }}>TA</div>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Application submitted</h1>
            <p className="sub" style={{ fontSize: 13.5, marginBottom: 18 }}>
              Please save your reference number. The academy will review your application and
              contact you on the mobile number provided.
            </p>
            <div
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "var(--coral)",
                background: "var(--coral-soft)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "14px 10px",
                marginBottom: 18,
              }}
            >
              {result.ref}
            </div>
            <p className="sub" style={{ fontSize: 12.5, marginBottom: 22 }}>
              Bring the student&apos;s photo and any required documents on your next visit to the
              academy. Admission fee and first month&apos;s fee are collected on approval.
            </p>
            <a
              href="/login"
              className="btn ghost"
              style={{ justifyContent: "center", padding: "10px 15px", textDecoration: "none" }}
            >
              ← Back to portal
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px 60px", background: "var(--ground)" }}>
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <div className="mark" style={{ width: 40, height: 40, flex: "0 0 40px", fontSize: 14 }}>TA</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>
              Tasveer Academy
            </div>
            <div className="lbl">Admission application</div>
          </div>
          <div className="spacer" />
          <ThemeToggle />
        </div>

        <p className="sub" style={{ marginBottom: 6, fontSize: 13.5 }}>
          Fill this in to apply for admission. The academy will review your application and get
          in touch to confirm your seat. No account or sign-in is needed to submit.
        </p>
        <p className="sub" style={{ marginBottom: 22, fontSize: 12.5 }}>
          Fields marked <span style={{ color: "var(--coral)" }}>*</span> are required.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Section title="Visit & Programme">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <Field label="Date of visit" required>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="YYYY-MM-DD"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  pattern="\d{4}-\d{2}-\d{2}"
                  required
                  onFocus={(e) => (e.target.type = "date")}
                />
              </Field>
              <Field label="Previous registration number" hint="If re-admitting, optional">
                <input type="text" value={previousRegNo} onChange={(e) => setPreviousRegNo(e.target.value)} />
              </Field>
              <Field label="Programme" required>
                <select
                  style={selStyle}
                  value={programme ? `${programme}${mockOnly ? "_mock" : ""}` : ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const mock = raw.endsWith("_mock");
                    const v = (mock ? raw.slice(0, -"_mock".length) : raw) as ProgrammeCode;
                    setProgramme(v);
                    setClassLevelCode("");
                    setMockOnly(mock);
                    setSubjectRows([{ key: newKey(), subjectId: "", teacherId: "", fromMonth: startMonth }]);
                  }}
                  required
                >
                  <option value="">Choose…</option>
                  <option value="junior">Junior (STD I–VIII)</option>
                  <option value="o_level">O Level (Edexcel)</option>
                  <option value="o_level_mock">O Level — Mock Exam Only</option>
                  <option value="a_level">A Level (Edexcel)</option>
                  <option value="a_level_mock">A Level — Mock Exam Only</option>
                </select>
              </Field>
              {!isMock && (
                <Field label="Enrolment start month" required>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM"
                    value={startMonth}
                    onChange={(e) => {
                      setStartMonth(e.target.value);
                      setSubjectRows((rows) => rows.map((r) => (r.fromMonth ? r : { ...r, fromMonth: e.target.value })));
                    }}
                    onFocus={(e) => (e.target.type = "month")}
                    required
                  />
                </Field>
              )}
            </div>
            {isMock && (
              <div className="sub" style={{ fontSize: 12.5 }}>
                Mock exam only — sitting {programme === "o_level" ? "O Level" : "A Level"} mock
                exams in chosen subjects below, not enrolling in regular tuition classes. No
                teacher assignment or monthly billing.
              </div>
            )}
          </Section>

          <Section title="Student Details">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <Field label="Full name" required>
                <input
                  type="text"
                  required
                  value={student.full_name}
                  onChange={(e) => setStudent({ ...student, full_name: e.target.value })}
                />
              </Field>
              <Field label="Gender">
                <select
                  style={selStyle}
                  value={student.gender}
                  onChange={(e) => setStudent({ ...student, gender: e.target.value })}
                >
                  <option value="">Choose…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Nationality">
                <input
                  type="text"
                  value={student.nationality}
                  onChange={(e) => setStudent({ ...student, nationality: e.target.value })}
                />
              </Field>
              <Field label="Student WhatsApp / mobile" hint="A delivery address for class notices" required>
                <input
                  type="text"
                  required
                  value={student.phone}
                  onChange={(e) => setStudent({ ...student, phone: e.target.value })}
                />
              </Field>
              <Field label="Student email" hint="Optional, also used for notices">
                <input
                  type="email"
                  value={student.email}
                  onChange={(e) => setStudent({ ...student, email: e.target.value })}
                />
              </Field>
              <Field label="Current / previous school">
                <input
                  type="text"
                  value={student.school_name}
                  onChange={(e) => setStudent({ ...student, school_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Address">
              <textarea
                style={taStyle}
                value={student.address}
                onChange={(e) => setStudent({ ...student, address: e.target.value })}
              />
            </Field>
            <div className="sub">
              A student photo is collected in person at the academy — there&apos;s no need to
              upload one here.
            </div>
          </Section>

          <Section title="Guardian Details">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <Field label="Guardian full name" required>
                <input
                  type="text"
                  required
                  value={guardian.full_name}
                  onChange={(e) => setGuardian({ ...guardian, full_name: e.target.value })}
                />
              </Field>
              <Field label="Relation to student">
                <select
                  style={selStyle}
                  value={guardian.relation}
                  onChange={(e) => setGuardian({ ...guardian, relation: e.target.value })}
                >
                  <option value="">Choose…</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Father's name">
                <input
                  type="text"
                  value={guardian.father_name}
                  onChange={(e) => setGuardian({ ...guardian, father_name: e.target.value })}
                />
              </Field>
              <Field label="Mother's name">
                <input
                  type="text"
                  value={guardian.mother_name}
                  onChange={(e) => setGuardian({ ...guardian, mother_name: e.target.value })}
                />
              </Field>
              <Field label="Guardian WhatsApp / mobile" hint="This is the portal login once enrolled" required>
                <input
                  type="text"
                  required
                  value={guardian.phone}
                  onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })}
                />
              </Field>
              <Field label="Guardian email">
                <input
                  type="email"
                  value={guardian.email}
                  onChange={(e) => setGuardian({ ...guardian, email: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Guardian address">
              <textarea
                style={taStyle}
                value={guardian.address}
                onChange={(e) => setGuardian({ ...guardian, address: e.target.value })}
              />
            </Field>
          </Section>

          <Section title="Siblings" sub="Optional — add any brothers or sisters also at the academy or elsewhere">
            {siblings.length === 0 && <div className="sub">No sibling rows added.</div>}
            {siblings.map((row) => (
              <div
                key={row.key}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}
              >
                <Field label="Name">
                  <input
                    type="text"
                    value={row.fullName}
                    onChange={(e) =>
                      setSiblings((rows) => rows.map((r) => (r.key === row.key ? { ...r, fullName: e.target.value } : r)))
                    }
                  />
                </Field>
                <Field label="Class">
                  <input
                    type="text"
                    value={row.className}
                    onChange={(e) =>
                      setSiblings((rows) => rows.map((r) => (r.key === row.key ? { ...r, className: e.target.value } : r)))
                    }
                  />
                </Field>
                <Field label="School">
                  <input
                    type="text"
                    value={row.schoolName}
                    onChange={(e) =>
                      setSiblings((rows) => rows.map((r) => (r.key === row.key ? { ...r, schoolName: e.target.value } : r)))
                    }
                  />
                </Field>
                <button type="button" className="btn ghost" onClick={() => removeSibling(row.key)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn ghost" onClick={addSibling} style={{ alignSelf: "flex-start" }}>
              + Add sibling
            </button>
          </Section>

          {programme === "junior" && (
            <Section title="Class Level">
              <Field label="Class" required>
                <select
                  style={selStyle}
                  value={classLevelCode}
                  onChange={(e) => setClassLevelCode(e.target.value)}
                  required
                >
                  <option value="">Choose…</option>
                  {catalogue.classLevels.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedClassLevel && selectedClassLevel.monthlyFee === 0 && (
                <div className="sub">
                  The monthly rate for this class hasn&apos;t been set yet — the academy will
                  confirm it when reviewing your application.
                </div>
              )}
            </Section>
          )}

          {(programme === "o_level" || programme === "a_level") && (
            <Section
              title={isMock ? "Mock Exam Subjects" : "Subjects"}
              sub={
                isMock
                  ? `${programme === "o_level" ? "O Level" : "A Level"} — up to 10 subjects to sit mocks in, no teacher assignment needed`
                  : `${programme === "o_level" ? "O Level" : "A Level"} — up to 10 subjects, ${taka(
                      subjectOptions[0]?.monthlyFee ?? 0
                    )}/subject/month varies by level`
              }
            >
              {subjectRows.map((row, i) => {
                const chosen = catalogue.subjects.find((s) => s.id === row.subjectId);
                // A subject already picked in another row is hidden here, so the same
                // subject can't be selected twice (decision, 14 Sep 2026).
                const takenElsewhere = new Set(
                  subjectRows.filter((r) => r.key !== row.key && r.subjectId).map((r) => r.subjectId)
                );
                const rowOptions = subjectOptions.filter((s) => s.id === row.subjectId || !takenElsewhere.has(s.id));
                return (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMock ? "1fr auto" : "2fr 2fr 1fr auto",
                      gap: 10,
                      alignItems: "end",
                    }}
                  >
                    <Field label={`Subject ${i + 1}`} required={i === 0}>
                      <select
                        style={selStyle}
                        value={row.subjectId}
                        onChange={(e) =>
                          setSubjectRows((rows) =>
                            rows.map((r) => (r.key === row.key ? { ...r, subjectId: e.target.value, teacherId: "" } : r))
                          )
                        }
                      >
                        <option value="">Choose…</option>
                        {rowOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {subjectLabel(s)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {!isMock && (
                      <>
                        <Field label="Teacher" required={i === 0}>
                          <select
                            style={selStyle}
                            value={row.teacherId}
                            onChange={(e) =>
                              setSubjectRows((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, teacherId: e.target.value } : r))
                              )
                            }
                            disabled={!chosen}
                          >
                            <option value="">Choose…</option>
                            {chosen?.teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Fee/month">
                          <input type="text" readOnly value={chosen ? taka(chosen.monthlyFee) : "—"} />
                        </Field>
                      </>
                    )}
                    <button type="button" className="btn ghost" onClick={() => removeSubjectRow(row.key)}>
                      Remove
                    </button>
                  </div>
                );
              })}
              {subjectRows.length < 10 && (
                <button type="button" className="btn ghost" onClick={addSubjectRow} style={{ alignSelf: "flex-start" }}>
                  + Add subject
                </button>
              )}
            </Section>
          )}

          {programme && (
            <Section title="Fee Summary" sub="Indicative — the academy confirms the exact first invoice on approval">
              <div className="tblwrap">
                <table>
                  <tbody>
                    <tr>
                      <td>
                        Admission fee (one time)
                        {(programme === "o_level" || programme === "a_level") && enrolledSubjectCount > 0 && (
                          <div className="sub" style={{ fontSize: 12 }}>
                            {taka(catalogue.admissionFee)} × {enrolledSubjectCount} subject{enrolledSubjectCount === 1 ? "" : "s"}
                          </div>
                        )}
                      </td>
                      <td className="n mono">{taka(admissionFeeTotal)}</td>
                    </tr>
                    {isMock ? (
                      <>
                        <tr>
                          <td>Mock exam fee (flat, one time)</td>
                          <td className="n mono">{taka(mockFeeTotal)}</td>
                        </tr>
                        <tr>
                          <td>
                            <b>Total due on approval</b>
                          </td>
                          <td className="n mono">
                            <b>{taka(admissionFeeTotal + mockFeeTotal)}</b>
                          </td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <td>Monthly fee ({startMonth}, full month)</td>
                          <td className="n mono">{taka(monthlyTotal)}</td>
                        </tr>
                        <tr>
                          <td>
                            <b>Total due on approval</b>
                          </td>
                          <td className="n mono">
                            <b>{taka(admissionFeeTotal + monthlyTotal)}</b>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section title="Declaration">
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "var(--body)" }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                I confirm the information given above is correct to the best of my knowledge, and
                I accept Tasveer Academy&apos;s rules on fees, attendance and conduct.
              </span>
            </label>
          </Section>

          {error && (
            <div
              role="alert"
              style={{
                background: "var(--crit-soft)",
                color: "var(--crit)",
                border: "1px solid var(--crit-soft)",
                borderRadius: 7,
                padding: "10px 12px",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button className="btn" type="submit" disabled={pending} style={{ justifyContent: "center", padding: "12px 15px" }}>
            {pending ? "Submitting…" : "Submit application"}
          </button>
          {slow && (
            <div className="sub" role="status" style={{ textAlign: "center" }}>
              Still working — please don&apos;t close this tab or submit again. If your
              connection is slow this can take a little while, and your application may
              already be received even if this message doesn&apos;t change right away.
            </div>
          )}
        </form>

        <p className="sub" style={{ textAlign: "center", marginTop: 18 }}>
          105/A (2nd &amp; 3rd Floor), Kakrail, Dhaka 1000
        </p>
      </div>
    </main>
  );
}
