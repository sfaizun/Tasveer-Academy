import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import ExportCsvButton from "@/components/ExportCsvButton";
import { dhakaTodayISO, fmtDate } from "@/lib/format";
import { subjectLabel } from "@/lib/mock";
import { type GradeScale, scaleForProgramme, scaleText } from "@/lib/grade";
import TestMarkForm, { type StudentOpt } from "./TestMarkForm";
import { MARK_COLS, toMarkRow } from "./marks";
import TestMarkTable from "./TestMarkTable";
import StudentMarks from "./StudentMarks";

export const dynamic = "force-dynamic";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", minWidth: 150,
};
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);

/** Test marks: admin records marks for any student, a teacher for their own students and
 * subjects, and a student (or guardian) sees their own results read only. */
export default async function TestMarksPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; subject?: string; teacher?: string; from?: string; to?: string }>;
}) {
  const { me } = await getViewer();
  if (!me) redirect("/login");
  if (me.role === "canteen_manager") redirect("/canteen");
  const supabase = await createClient();
  const today = dhakaTodayISO();

  if (me.role !== "admin" && me.role !== "teacher") {
    return (
      <>
        <header className="top">
          <h1>My test marks</h1>
          <div className="sub">Results of mock exams and class tests</div>
          <div className="spacer" />
          <ThemeToggle />
        </header>
        <div className="content">
          <StudentMarks supabase={supabase} />
        </div>
      </>
    );
  }

  const isAdmin = me.role === "admin";
  const sp = await searchParams;
  const studentId = isId(sp.student) ? sp.student : "";
  const subjectId = isId(sp.subject) ? sp.subject : "";
  const teacherId = isAdmin && isId(sp.teacher) ? sp.teacher : "";
  const from = isDate(sp.from) ? sp.from : studentId ? "" : `${today.slice(0, 4)}-01-01`;
  const to = isDate(sp.to) ? sp.to : today;

  let q = supabase.from("test_mark").select(MARK_COLS).lte("test_date", to)
    .order("test_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  if (from) q = q.gte("test_date", from);
  if (studentId) q = q.eq("student_id", studentId);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (teacherId) q = q.eq("teacher_id", teacherId);

  const [{ data: marksData }, { data: enrolData }, { data: teacherData }] = await Promise.all([
    q,
    // RLS limits a teacher to enrolments in their own classes.
    supabase.from("enrolment")
      .select("student_id, subject_id, student(full_name, reg_no), subject(name, level, sort_order, programme(code))")
      .eq("status", "active"),
    isAdmin ? supabase.from("teacher").select("id, full_name").order("full_name") : Promise.resolve({ data: [] as any[] }),
  ]);

  // Students and the subjects each is enrolled in, for the form and filters.
  const byStudent = new Map<string, StudentOpt>();
  const subjectNames = new Map<string, string>();
  for (const e of (enrolData ?? []) as any[]) {
    if (!e.student || !e.subject) continue;
    const s: StudentOpt = byStudent.get(e.student_id) ?? { id: e.student_id, name: e.student.full_name, reg_no: e.student.reg_no, subjects: [] };
    const label = subjectLabel(e.subject);
    if (!s.subjects.some((x) => x.id === e.subject_id)) s.subjects.push({ id: e.subject_id, label, scale: scaleForProgramme(e.subject.programme?.code) });
    byStudent.set(e.student_id, s);
    subjectNames.set(e.subject_id, label);
  }
  const students = [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const s of students) s.subjects.sort((a, b) => a.label.localeCompare(b.label));

  const rows = ((marksData ?? []) as any[]).map(toMarkRow);
  for (const r of rows) {
    if (!subjectNames.has(r.subject_id)) subjectNames.set(r.subject_id, r.subject_label);
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, { id: r.student_id, name: r.student_name, reg_no: r.reg_no, subjects: [] });
  }
  const filterStudents = [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
  const filterSubjects = [...subjectNames.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const teachers = (teacherData ?? []) as { id: string; full_name: string }[];

  const avg = rows.length ? rows.reduce((s, r) => s + r.percentage, 0) / rows.length : null;

  const studentName = byStudent.get(studentId)?.name;
  const filterText = [
    from ? `${fmtDate(from)} to ${fmtDate(to)}` : `Up to ${fmtDate(to)}`,
    studentName,
    subjectId ? subjectNames.get(subjectId) : null,
    teacherId ? teachers.find((t) => t.id === teacherId)?.full_name : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <header className="top no-print">
        <h1>Test marks</h1>
        <div className="sub">{isAdmin ? "Mock and class test results for each student" : "Your students and subjects only"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <details className="panel collapsible no-print" open>
          <summary className="phead">
            <div className="ptitle">Add test marks</div>
            <div className="sub">The student sees these on their own Test marks page</div>
          </summary>
          <div style={{ padding: 18 }}>
            {students.length ? (
              <TestMarkForm students={students} today={today} defaultStudentId={studentId || undefined} />
            ) : (
              <div className="sub">{isAdmin ? "No students with active enrolments yet." : "You have no students in your classes yet."}</div>
            )}
          </div>
        </details>

        <div className="panel print-flow">
          <div className="print-only" style={{ padding: "4px 0 12px", borderBottom: "2px solid #000", marginBottom: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Tasveer Academy</div>
            <div className="sub">105/A (2nd &amp; 3rd Floor), Kakrail, Dhaka 1000</div>
            <div style={{ marginTop: 6, fontWeight: 600 }}>Test marks: {filterText}</div>
          </div>
          <div className="phead no-print">
            <div className="ptitle">Results</div>
            <div className="sub">{filterText}</div>
            <div className="spacer" />
            <ExportCsvButton
              filename={`test-marks-${from || "all"}-to-${to}`}
              headers={["Date", "Student ID", "Student", "Subject", "Teacher", "Test", "Marks", "Out of", "Percentage", "Grade", "Remarks", "Attachment"]}
              rows={rows.map((r) => [r.test_date, r.reg_no ?? "", r.student_name, r.subject_label, r.teacher_name ?? "", r.test_name, r.marks, r.out_of, r.percentage, r.grade, r.remarks ?? "", r.attachment_name ?? ""])}
            />
            <PrintButton />
          </div>

          <form method="GET" className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", padding: "14px 18px 4px" }}>
            <div className="field">
              <label className="lbl" htmlFor="f-student">Student</label>
              <select id="f-student" style={inputStyle} name="student" defaultValue={studentId}>
                <option value="">All students</option>
                {filterStudents.map((s) => <option key={s.id} value={s.id}>{s.name}{s.reg_no ? ` (${s.reg_no})` : ""}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="f-subject">Subject</label>
              <select id="f-subject" style={inputStyle} name="subject" defaultValue={subjectId}>
                <option value="">All subjects</option>
                {filterSubjects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div className="field">
                <label className="lbl" htmlFor="f-teacher">Teacher</label>
                <select id="f-teacher" style={inputStyle} name="teacher" defaultValue={teacherId}>
                  <option value="">All teachers</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
            <div className="field"><label className="lbl" htmlFor="f-from">From</label><input id="f-from" style={inputStyle} type="date" name="from" defaultValue={from} /></div>
            <div className="field"><label className="lbl" htmlFor="f-to">To</label><input id="f-to" style={inputStyle} type="date" name="to" defaultValue={to} /></div>
            <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Filter</button>
            <a className="btn ghost" href="/test-marks" style={{ fontSize: 12, padding: "8px 12px" }}>Clear</a>
          </form>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", padding: "14px 18px" }}>
            <div><div className="lbl">Tests recorded</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{rows.length}</b></div>
            <div><div className="lbl">Average</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{avg === null ? "-" : `${avg.toFixed(1)}%`}</b></div>
          </div>

          <TestMarkTable rows={rows} students={students} today={today} showTeacher={isAdmin} />
          {rows.length === 1000 && <div className="sub" style={{ padding: "10px 18px" }}>Showing the latest 1,000 results. Narrow the filters to see older ones.</div>}

          <div className="print-only" style={{ marginTop: 28 }}>
            <span className="sub">Printed {fmtDate(today)} by {me.full_name}</span>
            <span className="sub" style={{ float: "right" }}>Signature: ____________________</span>
          </div>
          <div className="sub no-print" style={{ padding: "4px 18px 16px" }}>
            {(["o_level", "a_level", "junior"] as GradeScale[]).map((sc) => <div key={sc}>{scaleText(sc)}</div>)}
          </div>
        </div>
      </div>
    </>
  );
}
