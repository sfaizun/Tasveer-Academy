import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { taka, fmtDate } from "@/lib/format";
import ReportBars, { type ReportBarRow } from "@/components/ReportBars";

export const dynamic = "force-dynamic";

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

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("app_user")
    .select("id, full_name, role")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle();

  const isAdmin = me?.role === "admin";
  const isTeacher = me?.role === "teacher";

  if (isAdmin) {
    const [byStudent, bySubject, byTeacher, summary] = await Promise.all([
      supabase.rpc("fn_report_by_student"),
      supabase.rpc("fn_report_by_subject"),
      supabase.rpc("fn_report_by_teacher"),
      supabase.rpc("fn_report_academy_summary"),
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
          <div className="sub">Revenue and outstanding dues across the academy</div>
          <div className="spacer" />
          <ThemeToggle />
        </header>

        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <Tile label="Total received" value={taka(s?.total_received ?? 0)} tone="var(--ok)" />
            <Tile label="Total due" value={taka(s?.total_due ?? 0)} tone={(s?.total_due ?? 0) > 0 ? "var(--crit)" : undefined} sub="including arrears" />
            <Tile label="Gross billed" value={taka(s?.total_gross ?? 0)} sub="before discounts" />
            <Tile label="Discounts given" value={taka(s?.total_discount ?? 0)} />
            <Tile label="Active students" value={String(s?.active_students ?? 0)} />
          </div>

          <div className="panel">
            <div className="phead">
              <div className="ptitle">By student</div>
              <div className="sub">Top {Math.min(12, students.length)} by outstanding balance</div>
            </div>
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
          </div>

          <div className="panel">
            <div className="phead">
              <div className="ptitle">By subject</div>
              <div className="sub">O Level / A Level subjects only — Junior bills flat per class, not per subject</div>
            </div>
            <div style={{ padding: 18 }}>
              <ReportBars rows={subjectBars} emptyLabel="No O/A Level subject billing yet." />
            </div>
          </div>

          <div className="panel">
            <div className="phead">
              <div className="ptitle">By teacher</div>
              <div className="sub">Revenue attributed to each teacher's own enrolments</div>
            </div>
            <div style={{ padding: 18 }}>
              <ReportBars rows={teacherBars} emptyLabel="No O/A Level enrolments billed to a teacher yet." />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isTeacher) {
    const [byTeacher, bySubject] = await Promise.all([
      supabase.rpc("fn_report_by_teacher"),
      supabase.rpc("fn_report_by_subject"),
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
          <div className="sub">Your own revenue and outstanding dues</div>
          <div className="spacer" />
          <ThemeToggle />
        </header>

        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <Tile label="Received (your subjects)" value={taka(own?.total_received ?? 0)} tone="var(--ok)" />
            <Tile label="Outstanding (your subjects)" value={taka(own?.total_due ?? 0)} tone={(own?.total_due ?? 0) > 0 ? "var(--crit)" : undefined} />
          </div>

          <div className="panel">
            <div className="phead">
              <div className="ptitle">By subject</div>
              <div className="sub">Only your own subjects — other teachers' figures aren&apos;t shown here</div>
            </div>
            <div style={{ padding: 18 }}>
              <ReportBars rows={subjectBars} emptyLabel="No billing on your subjects yet." />
            </div>
          </div>
        </div>
      </>
    );
  }

  // Student / guardian: their own payment history only. RLS already scopes invoice/payment
  // reads to the signed-in student's own records (or a guardian's linked student), so no
  // separate RPC is needed here.
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase.from("invoice").select("id, billing_month, net, paid, balance, status").order("billing_month", { ascending: false }),
    supabase.from("payment").select("id, receipt_no, amount, method, received_on, status").eq("status", "confirmed").order("received_on", { ascending: false }),
  ]);

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
        <div className="sub">Your own payment history</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          <Tile label="Total paid" value={taka(totalPaid)} tone="var(--ok)" />
          <Tile label="Outstanding" value={taka(totalDue)} tone={totalDue > 0 ? "var(--crit)" : undefined} />
        </div>

        <div className="panel">
          <div className="phead"><div className="ptitle">Payments by month</div></div>
          <div style={{ padding: 18 }}>
            <ReportBars rows={monthBars} emptyLabel="No payments recorded yet." />
          </div>
        </div>

        <div className="panel">
          <div className="phead"><div className="ptitle">Payment history</div></div>
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
