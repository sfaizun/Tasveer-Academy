import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { taka, fmtDate, monthName, dhakaTodayISO } from "@/lib/format";
import ReportBars, { type ReportBarRow } from "@/components/ReportBars";
import ExportCsvButton from "@/components/ExportCsvButton";
import CashFinanceReports from "./CashFinanceReports";
import TeacherWorkloadReport from "./TeacherWorkloadReport";
import TeacherStudentPaymentsReport from "./TeacherStudentPaymentsReport";
import AnnouncementReachReport from "./AnnouncementReachReport";
import UserAccessReport from "./UserAccessReport";

export const dynamic = "force-dynamic";

const monthInputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** GET-submitted month filter — no client JS needed, just a plain form against this same page.
 * Carries the daily-cash panel's date along as a hidden field so changing the month doesn't
 * reset it. */
function MonthFilter({ month, cashDate }: { month: string | null; cashDate?: string }) {
  return (
    <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {cashDate && <input type="hidden" name="cash_date" value={cashDate} />}
      <label className="lbl" style={{ margin: 0 }}>Month</label>
      <input type="month" name="month" defaultValue={month ?? ""} style={monthInputStyle} />
      <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>
        Filter
      </button>
      {month && (
        <a className="btn ghost" href="/reports" style={{ fontSize: 12, padding: "8px 12px" }}>
          All time
        </a>
      )}
    </form>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="panel" style={{ padding: "16px 18px" }}>
      <div className="lbl">{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: tone ?? "var(--ink)", marginTop: 4 }}>
        {value}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

type StudentRow = { student_id: string; full_name: string; reg_no: string; status: string; total_received: number; total_due: number };
type SubjectRow = { subject_id: string; subject_name: string; level: string | null; programme_name: string; total_received: number; total_due: number };
type TeacherRow = { teacher_id: string; full_name: string; total_received: number; total_due: number };
type AcademySummary = { total_received: number; total_due: number; total_gross: number; total_discount: number; active_students: number };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; cash_date?: string; ann_id?: string }>;
}) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
  const monthDate = month ? `${month}-01` : null;
  const fileTag = month ?? "all-time";
  const today = dhakaTodayISO();
  const cashDate = typeof sp.cash_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.cash_date) ? sp.cash_date : today;
  const annId = typeof sp.ann_id === "string" && sp.ann_id ? sp.ann_id : undefined;

  const supabase = await createClient();
  const { me } = await getViewer();

  const isAdmin = me?.role === "admin";
  const isTeacher = me?.role === "teacher";

  if (isAdmin) {
    const [byStudent, bySubject, byTeacher, summary] = await Promise.all([
      supabase.rpc("fn_report_by_student", { p_month: monthDate }),
      supabase.rpc("fn_report_by_subject", { p_month: monthDate }),
      supabase.rpc("fn_report_by_teacher", { p_month: monthDate }),
      supabase.rpc("fn_report_academy_summary", { p_month: monthDate }),
    ]);

    const students = (byStudent.data ?? []) as StudentRow[];
    const subjects = (bySubject.data ?? []) as SubjectRow[];
    const teachers = (byTeacher.data ?? []) as TeacherRow[];
    const s: AcademySummary | undefined = (summary.data ?? [])[0];

    const studentBars: ReportBarRow[] = students.slice(0, 12).map((r) => ({
      key: r.student_id, label: r.full_name, sublabel: r.reg_no, received: Number(r.total_received), due: Number(r.total_due),
    }));
    const subjectBars: ReportBarRow[] = subjects.map((r) => ({
      key: r.subject_id, label: r.subject_name, sublabel: r.level ? `${r.programme_name} — ${r.level.toUpperCase()}` : r.programme_name,
      received: Number(r.total_received), due: Number(r.total_due),
    }));
    const teacherBars: ReportBarRow[] = teachers.map((r) => ({
      key: r.teacher_id, label: r.full_name, received: Number(r.total_received), due: Number(r.total_due),
    }));

    return (
      <>
        <header className="top">
          <h1>Reports</h1>
          <div className="sub">
            {month ? `Revenue and outstanding dues for ${monthName(monthDate!)}` : "Revenue and outstanding dues across the academy"}
          </div>
          <div className="spacer" />
          <ThemeToggle />
        </header>

        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel" style={{ padding: 16 }}>
            <MonthFilter month={month} cashDate={cashDate} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <Tile label="Total received" value={taka(s?.total_received ?? 0)} tone="var(--ok)" />
            <Tile label="Total due" value={taka(s?.total_due ?? 0)} tone={(s?.total_due ?? 0) > 0 ? "var(--crit)" : undefined} sub="including arrears" />
            <Tile label="Gross billed" value={taka(s?.total_gross ?? 0)} sub="before discounts" />
            <Tile label="Discounts given" value={taka(s?.total_discount ?? 0)} />
            <Tile label="Active students" value={String(s?.active_students ?? 0)} />
          </div>

          <CashFinanceReports supabase={supabase} month={month} monthDate={monthDate} fileTag={fileTag} cashDate={cashDate} today={today} />

          <div className="navlbl" style={{ margin: "4px 0 -6px" }}>By student / subject / teacher</div>

          <details className="panel collapsible" open>
            <summary className="phead">
              <div className="ptitle">By student</div>
              <div className="sub">
                {month ? `${students.length} with billing this month` : `Top ${Math.min(12, students.length)} by outstanding balance`}
              </div>
              <div className="spacer" />
              <ExportCsvButton
                filename={`by-student-${fileTag}`}
                headers={["Student", "Reg. no.", "Status", "Received", "Due"]}
                rows={students.map((r) => [r.full_name, r.reg_no, r.status, Number(r.total_received), Number(r.total_due)])}
              />
            </summary>
            <div style={{ padding: 18 }}>
              <ReportBars rows={studentBars} emptyLabel="No students with an invoice yet." />
            </div>
            {students.length > 0 && (
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Student</th><th>Reg. no.</th><th>Status</th><th className="n">Received</th><th className="n">Due</th></tr></thead>
                  <tbody>
                    {students.map((r) => (
                      <tr key={r.student_id}>
                        <td><a href={`/students/${r.student_id}`}>{r.full_name}</a></td>
                        <td className="mono sub">{r.reg_no}</td>
                        <td className="sub">{r.status}</td>
                        <td className="n mono">{taka(r.total_received)}</td>
                        <td className="n mono" style={{ color: Number(r.total_due) > 0 ? "var(--crit)" : undefined }}>{taka(r.total_due)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>

          <details className="panel collapsible" open>
            <summary className="phead">
              <div className="ptitle">By subject</div>
              <div className="sub">O Level / A Level subjects only — Junior bills flat per class, not per subject</div>
              <div className="spacer" />
              <ExportCsvButton
                filename={`by-subject-${fileTag}`}
                headers={["Subject", "Level", "Programme", "Received", "Due"]}
                rows={subjects.map((r) => [r.subject_name, r.level ? r.level.toUpperCase() : "", r.programme_name, Number(r.total_received), Number(r.total_due)])}
              />
            </summary>
            <div style={{ padding: 18 }}>
              <ReportBars rows={subjectBars} emptyLabel="No O/A Level subject billing yet." />
            </div>
          </details>

          <div className="navlbl" style={{ margin: "4px 0 -6px" }}>Teachers</div>

          <details className="panel collapsible" open>
            <summary className="phead">
              <div className="ptitle">By teacher</div>
              <div className="sub">Revenue attributed to each teacher&apos;s own enrolments</div>
              <div className="spacer" />
              <ExportCsvButton
                filename={`by-teacher-${fileTag}`}
                headers={["Teacher", "Received", "Due"]}
                rows={teachers.map((r) => [r.full_name, Number(r.total_received), Number(r.total_due)])}
              />
            </summary>
            <div style={{ padding: 18 }}>
              <ReportBars rows={teacherBars} emptyLabel="No O/A Level enrolments billed to a teacher yet." />
            </div>
          </details>

          <TeacherWorkloadReport supabase={supabase} />

          <TeacherStudentPaymentsReport
            supabase={supabase}
            monthDate={monthDate}
            showTeacherColumn
            linkStudents
            title="Student payments by subject"
            subtitle="Every O/A Level class, expandable to each enrolled student's billing and payments"
          />

          <div className="navlbl" style={{ margin: "4px 0 -6px" }}>Communications</div>

          <AnnouncementReachReport supabase={supabase} selectedId={annId} month={month} cashDate={cashDate} />

          <div className="navlbl" style={{ margin: "4px 0 -6px" }}>Operational / admin</div>

          <UserAccessReport supabase={supabase} />

          <div className="sub">
            Looking for the activity / audit log? It now has its own page in the sidebar —{" "}
            <a href="/audit-log">open Audit log</a>.
          </div>
        </div>
      </>
    );
  }

  if (isTeacher) {
    const [byTeacher, bySubject, { data: myTeacherRow }] = await Promise.all([
      supabase.rpc("fn_report_by_teacher", { p_month: monthDate }),
      supabase.rpc("fn_report_by_subject", { p_month: monthDate }),
      supabase.from("teacher").select("id").eq("app_user_id", me!.id).maybeSingle(),
    ]);

    const own: TeacherRow | undefined = (byTeacher.data ?? [])[0];
    const subjects = (bySubject.data ?? []) as SubjectRow[];
    const subjectBars: ReportBarRow[] = subjects.map((r) => ({
      key: r.subject_id, label: r.subject_name, sublabel: r.level ? `${r.programme_name} — ${r.level.toUpperCase()}` : r.programme_name,
      received: Number(r.total_received), due: Number(r.total_due),
    }));

    return (
      <>
        <header className="top">
          <h1>Reports</h1>
          <div className="sub">
            {month ? `Your own revenue and outstanding dues for ${monthName(monthDate!)}` : "Your own revenue and outstanding dues"}
          </div>
          <div className="spacer" />
          <ThemeToggle />
        </header>

        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel" style={{ padding: 16 }}>
            <MonthFilter month={month} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <Tile label="Received (your subjects)" value={taka(own?.total_received ?? 0)} tone="var(--ok)" />
            <Tile label="Outstanding (your subjects)" value={taka(own?.total_due ?? 0)} tone={(own?.total_due ?? 0) > 0 ? "var(--crit)" : undefined} />
          </div>

          <div className="panel">
            <div className="phead">
              <div className="ptitle">By subject</div>
              <div className="sub">Only your own subjects — other teachers' figures aren&apos;t shown here</div>
              <div className="spacer" />
              <ExportCsvButton
                filename={`my-subjects-${fileTag}`}
                headers={["Subject", "Level", "Programme", "Received", "Due"]}
                rows={subjects.map((r) => [r.subject_name, r.level ? r.level.toUpperCase() : "", r.programme_name, Number(r.total_received), Number(r.total_due)])}
              />
            </div>
            <div style={{ padding: 18 }}>
              <ReportBars rows={subjectBars} emptyLabel="No billing on your subjects yet." />
            </div>
          </div>

          {myTeacherRow?.id && (
            <TeacherWorkloadReport
              supabase={supabase}
              onlyTeacherId={myTeacherRow.id}
              title="Your workload"
              subtitle="Your active classes, enrolled students, and scheduled weekly hours"
            />
          )}

          {myTeacherRow?.id && (
            <TeacherStudentPaymentsReport
              supabase={supabase}
              monthDate={monthDate}
              title="Your students' payments"
              subtitle="Expand a subject you teach to see each enrolled student's billing and payments"
            />
          )}
        </div>
      </>
    );
  }

  // Student / guardian: their own payment history only. RLS already scopes invoice/payment
  // reads to the signed-in student's own records (or a guardian's linked student), so no
  // separate RPC is needed here.
  let invoiceQuery = supabase
    .from("invoice")
    .select("id, billing_month, net, paid, balance, status")
    .order("billing_month", { ascending: false });
  let paymentQuery = supabase
    .from("payment")
    .select("id, receipt_no, amount, method, received_on, status")
    .eq("status", "confirmed")
    .order("received_on", { ascending: false });

  if (monthDate) {
    invoiceQuery = invoiceQuery.eq("billing_month", monthDate);
    const [y, mo] = month!.split("-").map(Number);
    const nextMonth = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
    paymentQuery = paymentQuery.gte("received_on", monthDate).lt("received_on", nextMonth);
  }

  const [{ data: invoices }, { data: payments }] = await Promise.all([invoiceQuery, paymentQuery]);

  const inv = (invoices ?? []) as any[];
  const pay = (payments ?? []) as any[];
  const totalPaid = inv.reduce((sum, i) => sum + Number(i.paid || 0), 0);
  const totalDue = inv.filter((i) => i.status !== "void" && i.status !== "waived").reduce((sum, i) => sum + Number(i.balance || 0), 0);

  // Group confirmed payments by month for a simple bar chart.
  const byMonth = new Map<string, number>();
  for (const p of pay) {
    const key = String(p.received_on).slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(p.amount));
  }
  const monthBars: ReportBarRow[] = Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([month, amount]) => ({ key: month, label: fmtDate(`${month}-01`), received: amount, due: 0 }));

  return (
    <>
      <header className="top">
        <h1>Reports</h1>
        <div className="sub">{month ? `Your own payment history for ${monthName(monthDate!)}` : "Your own payment history"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel" style={{ padding: 16 }}>
          <MonthFilter month={month} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          <Tile label={month ? "Paid this month" : "Total paid"} value={taka(totalPaid)} tone="var(--ok)" />
          <Tile label={month ? "Due this month" : "Outstanding"} value={taka(totalDue)} tone={totalDue > 0 ? "var(--crit)" : undefined} />
        </div>

        {!month && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Payments by month</div></div>
            <div style={{ padding: 18 }}>
              <ReportBars rows={monthBars} emptyLabel="No payments recorded yet." />
            </div>
          </div>
        )}

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Payment history</div>
            <div className="spacer" />
            <ExportCsvButton
              filename={`my-payments-${fileTag}`}
              headers={["Receipt", "Date", "Method", "Amount"]}
              rows={pay.map((p) => [p.receipt_no, p.received_on, p.method, Number(p.amount)])}
            />
          </div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {pay.map((p) => (
                  <tr key={p.id}>
                    <td className="mono"><b>{p.receipt_no}</b></td>
                    <td className="mono sub">{fmtDate(p.received_on)}</td>
                    <td className="sub">{p.method}</td>
                    <td className="n mono">{taka(p.amount)}</td>
                  </tr>
                ))}
                {pay.length === 0 && (
                  <tr><td colSpan={4} className="sub">No payments recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
