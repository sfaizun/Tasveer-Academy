import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import { fmtDateTime, taka } from "@/lib/format";
import { EXAM_STATUS, MOCK_EXAM_COLS, REG_STATUS, subjectLabel, type MockExam } from "@/lib/mock";
import MockExamForm from "../MockExamForm";
import { AttendanceSelect, CancelExamForm, RegisterForm, WithdrawButton } from "../MockBits";

export const dynamic = "force-dynamic";

const PAY: Record<string, { text: string; cls: string }> = {
  paid: { text: "Paid", cls: "paid" },
  partly_paid: { text: "Part paid", cls: "due" },
  unpaid: { text: "Unpaid", cls: "due" },
  waived: { text: "Waived", cls: "" },
  void: { text: "Void", cls: "past" },
};

export default async function MockExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { me } = await getViewer();
  if (me?.role !== "admin") redirect("/dashboard");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: examRow }, { data: regs }, { data: subjects }, { data: seriesRows }, { data: teachers }, { data: teacherSubjects }] = await Promise.all([
    supabase.from("mock_exam").select(MOCK_EXAM_COLS).eq("id", id).maybeSingle(),
    supabase
      .from("mock_registration")
      .select(
        `id, status, fee, created_at, withdrawn_reason, withdrawn_at,
         student(id, full_name, reg_no, phone, enrolment_type, programme(code)),
         invoice_line(id, invoice(id, invoice_no, status))`
      )
      .eq("mock_exam_id", id)
      .order("created_at"),
    supabase.from("subject").select("id, name, level, programme(code, name)").eq("active", true).order("sort_order"),
    supabase.from("mock_exam").select("series"),
    supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("teacher_subject").select("teacher_id, subject_id").eq("active", true),
  ]);
  if (!examRow) notFound();
  const exam = examRow as unknown as MockExam;
  const all = (regs ?? []) as any[];
  const active = all
    .filter((r) => r.status !== "withdrawn")
    .sort((a, b) => String(a.student?.full_name).localeCompare(String(b.student?.full_name)));
  const withdrawn = all.filter((r) => r.status === "withdrawn");

  // Students who can be added: active O/A Level students not already on this exam.
  // Candidates whose fee is missing from every invoice can be registered again to bill it.
  const taken = new Set(active.filter((r) => r.invoice_line).map((r) => r.student?.id));
  const { data: studentRows } = await supabase
    .from("student")
    .select("id, full_name, reg_no, programme(code)")
    .eq("status", "active")
    .order("full_name");
  const candidates = ((studentRows ?? []) as any[])
    .filter((s) => (s.programme?.code === "o_level" || s.programme?.code === "a_level") && !taken.has(s.id))
    .map((s) => ({ id: s.id, label: `${s.full_name.trim()} · ${s.reg_no}${s.programme?.code === "a_level" ? " · A Level" : " · O Level"}` }));

  const st = EXAM_STATUS[exam.status];
  const collected = active.filter((r) => r.invoice_line?.invoice?.status === "paid").length;
  const regDisabled =
    exam.status === "cancelled" ? "This exam is cancelled." : exam.status === "closed" ? "Registration is closed for this exam. Reopen it below to add students." : null;

  return (
    <>
      <header className="top no-print">
        <h1>{subjectLabel(exam.subject)} mock</h1>
        <span className={`st ${st.cls}`}><span className="dot" />{st.text}</span>
        <div className="spacer" />
        <Link className="btn ghost" href="/mock-exams" style={{ fontSize: 12, padding: "6px 10px" }}>All mock exams</Link>
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="panel">
          <div className="phead">
            <div className="ptitle">{exam.series}: {subjectLabel(exam.subject)}</div>
            <div className="spacer" />
            <PrintButton label="Print attendance sheet" />
          </div>
          <div style={{ padding: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
            <div>
              <div className="lbl">Teacher</div>
              <b style={{ color: exam.teacher ? "var(--ink)" : "var(--warn)" }}>{exam.teacher?.full_name ?? "Not set"}</b>
              <div className="sub">for candidates not in this subject&apos;s class</div>
            </div>
            <div><div className="lbl">Fee</div><b className="mono" style={{ color: "var(--ink)" }}>{taka(exam.fee)}</b></div>
            <div><div className="lbl">Candidates</div><b style={{ color: "var(--ink)" }}>{active.length}</b><div className="sub">{collected} fully paid</div></div>
          </div>
          {exam.note && <div className="sub" style={{ padding: "0 16px 14px" }}>{exam.note}</div>}
          {exam.status === "cancelled" && exam.cancel_reason && (
            <div className="sub" style={{ padding: "0 16px 14px", color: "var(--crit)" }}>Cancelled: {exam.cancel_reason}</div>
          )}
        </div>

        <div className="panel print-flow">
          <div className="phead">
            <div className="ptitle">Candidates</div>
            <div className="sub">{active.length} registered · attendance sheet prints from here</div>
          </div>
          <div className="no-print" style={{ padding: 16, borderBottom: "1px solid var(--line2)" }}>
            <RegisterForm examId={exam.id} students={candidates} disabledReason={regDisabled} />
            <div className="sub" style={{ marginTop: 8 }}>
              The fee goes on the student&apos;s invoice for this month. A student who has never paid an admission fee is also
              charged the one-time admission fee. New candidate from outside? Use the <Link href="/apply">admission form</Link> with
              &ldquo;Mock Exam Only&rdquo;.
            </div>
          </div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr><th>#</th><th>Student</th><th>Reg. no.</th><th>Phone</th><th>Fee</th><th>Attendance</th><th className="print-only">Signature</th><th className="no-print"></th></tr>
              </thead>
              <tbody>
                {active.map((r, i) => {
                  const inv = r.invoice_line?.invoice;
                  const pay = inv ? PAY[inv.status] ?? { text: inv.status, cls: "" } : null;
                  const rs = REG_STATUS[r.status];
                  return (
                    <tr key={r.id}>
                      <td className="mono">{i + 1}</td>
                      <td>
                        <Link href={`/students/${r.student?.id}`}><b>{r.student?.full_name}</b></Link>
                        {r.student?.enrolment_type === "mock_only" && <span className="sub"> · mock only</span>}
                      </td>
                      <td className="mono">{r.student?.reg_no}</td>
                      <td className="mono">{r.student?.phone ?? ""}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="mono">{taka(r.fee)}</span>{" "}
                        {pay && <span className={`st ${pay.cls}`}><span className="dot" />{pay.text}</span>}
                        {inv && <div className="sub mono">{inv.invoice_no}</div>}
                      </td>
                      <td>
                        <span className="print-only">{r.status === "registered" ? "" : rs.text}</span>
                        {exam.status !== "cancelled" ? (
                          <AttendanceSelect registrationId={r.id} examId={exam.id} status={r.status} />
                        ) : (
                          <span className={`st ${rs.cls}`}><span className="dot" />{rs.text}</span>
                        )}
                      </td>
                      <td className="print-only" style={{ minWidth: 140 }}></td>
                      <td className="n no-print">
                        {r.status !== "sat" && <WithdrawButton registrationId={r.id} examId={exam.id} studentId={r.student?.id} />}
                      </td>
                    </tr>
                  );
                })}
                {active.length === 0 && <tr><td colSpan={8} className="sub">No candidates yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {withdrawn.length > 0 && (
            <div className="sub no-print" style={{ padding: "10px 16px 14px" }}>
              Withdrawn: {withdrawn.map((r) => `${r.student?.full_name?.trim()} (${r.withdrawn_reason ?? "no reason"}, ${fmtDateTime(r.withdrawn_at)})`).join("; ")}
            </div>
          )}
        </div>

        {exam.status !== "cancelled" && (
          <details className="panel collapsible no-print">
            <summary className="phead"><div className="ptitle">Edit exam</div><div className="sub">date, time, room, fee, registration open or closed</div></summary>
            <MockExamForm
              subjects={((subjects ?? []) as any[]).filter((s) => s.programme?.code === "o_level" || s.programme?.code === "a_level")}
              defaultFee={exam.fee}
              exam={exam}
              seriesOptions={[...new Set(((seriesRows ?? []) as any[]).map((s) => s.series))].sort()}
              hasRegistrations={all.length > 0}
              teachers={(teachers ?? []) as any}
              teacherSubjects={(teacherSubjects ?? []) as any}
            />
            <div style={{ padding: "0 16px 16px" }}>
              <CancelExamForm examId={exam.id} candidates={active.filter((r) => r.status !== "sat").length} />
            </div>
          </details>
        )}
      </div>
    </>
  );
}
