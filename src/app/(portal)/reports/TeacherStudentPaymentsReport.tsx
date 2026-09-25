import { createClient } from "@/lib/supabase/server";
import ExportCsvButton from "@/components/ExportCsvButton";
import SubjectPaymentsAccordion, { type SubjectGroup } from "./SubjectPaymentsAccordion";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Row = {
  class_group_id: string;
  subject_id: string;
  subject_name: string;
  level: string | null;
  teacher_id: string;
  teacher_name: string;
  student_id: string;
  student_name: string;
  reg_no: string;
  monthly_rate: number;
  billed: number;
  paid: number;
  balance: number;
  invoice_count: number;
};

/**
 * Per-subject, per-student billing and payments — the "who's paid what" view for a
 * teacher's own O/A Level classes (or, for admin, every teacher's). Expanding a subject
 * lists its currently-enrolled students with what they've been billed and paid.
 *
 * A payment settles a whole invoice, not one line on it, so when an invoice covers more
 * than one subject (or the admission fee), a subject's "Paid" here is that subject's
 * proportional share of the invoice's total paid — an estimate, not a per-subject ledger.
 * `fn_report_teacher_student_payments` does the scoping itself (admin sees everyone,
 * a teacher only their own class groups), matching every other report in this section.
 */
export default async function TeacherStudentPaymentsReport({
  supabase,
  monthDate,
  showTeacherColumn = false,
  linkStudents = false,
  title = "Student payments by subject",
  subtitle = "Expand a subject to see each enrolled student's billing and payments",
}: {
  supabase: Supabase;
  monthDate: string | null;
  showTeacherColumn?: boolean;
  linkStudents?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const { data } = await supabase.rpc("fn_report_teacher_student_payments", { p_month: monthDate });
  const rows = (data ?? []) as Row[];

  const groups = new Map<string, SubjectGroup>();
  for (const r of rows) {
    let g = groups.get(r.class_group_id);
    if (!g) {
      g = {
        class_group_id: r.class_group_id,
        subject_name: r.subject_name,
        level: r.level,
        teacher_name: r.teacher_name,
        students: [],
        totalBilled: 0,
        totalPaid: 0,
        totalBalance: 0,
      };
      groups.set(r.class_group_id, g);
    }
    g.students.push({
      student_id: r.student_id,
      student_name: r.student_name,
      reg_no: r.reg_no,
      monthly_rate: Number(r.monthly_rate),
      billed: Number(r.billed),
      paid: Number(r.paid),
      balance: Number(r.balance),
      invoice_count: r.invoice_count,
    });
    g.totalBilled += Number(r.billed);
    g.totalPaid += Number(r.paid);
    g.totalBalance += Number(r.balance);
  }

  const subjectGroups = Array.from(groups.values()).sort((a, b) =>
    showTeacherColumn
      ? a.teacher_name.localeCompare(b.teacher_name) || a.subject_name.localeCompare(b.subject_name)
      : a.subject_name.localeCompare(b.subject_name)
  );

  return (
    <details className="panel collapsible" open>
      <summary className="phead">
        <div className="ptitle">{title}</div>
        <div className="sub">{subtitle}</div>
        <div className="spacer" />
        <ExportCsvButton
          filename="student-payments-by-subject"
          headers={["Subject", "Teacher", "Student", "Reg. no.", "Monthly rate", "Billed", "Paid", "Balance"]}
          rows={rows.map((r) => [
            r.subject_name + (r.level ? ` (${r.level.toUpperCase()})` : ""),
            r.teacher_name,
            r.student_name,
            r.reg_no,
            Number(r.monthly_rate),
            Number(r.billed),
            Number(r.paid),
            Number(r.balance),
          ])}
        />
      </summary>
      <SubjectPaymentsAccordion groups={subjectGroups} showTeacherColumn={showTeacherColumn} linkStudents={linkStudents} />
      <div className="sub" style={{ padding: "0 16px 14px" }}>
        &ldquo;Billed&rdquo; is the subject&apos;s tuition minus its own subject discounts; admission fees
        and admission discounts are never included. On a fully paid or unpaid invoice the figures are
        exact. On a partly paid one, the payment is split across the invoice&apos;s fees in proportion
        to each fee&apos;s amount after its own discount.
      </div>
    </details>
  );
}
