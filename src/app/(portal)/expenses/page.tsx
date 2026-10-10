import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import ExportCsvButton from "@/components/ExportCsvButton";
import { dhakaTodayISO, fmtDate, taka } from "@/lib/format";
import ExpenseForm, { type TeacherOpt } from "./ExpenseForm";
import ExpenseTable from "./ExpenseTable";

export const dynamic = "force-dynamic";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", minWidth: 160,
};
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Admin: record expenses for a teacher or the office, and a filterable, printable report. */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; for?: string; teacher?: string }>;
}) {
  const { me } = await getViewer();
  if (me?.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const today = dhakaTodayISO();
  const from = isDate(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = isDate(sp.to) ? sp.to : today;
  const forWhat = sp.for === "office" || sp.for === "teacher" ? sp.for : "all";
  const teacherId = forWhat !== "office" && typeof sp.teacher === "string" && sp.teacher ? sp.teacher : "";

  const supabase = await createClient();
  let q = supabase
    .from("expense")
    .select("id, expense_for, teacher_id, expense_date, amount, details, teacher(full_name)")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (forWhat !== "all") q = q.eq("expense_for", forWhat);
  if (teacherId) q = q.eq("teacher_id", teacherId);

  const [{ data: expenses }, { data: teachers }] = await Promise.all([
    q,
    supabase.from("teacher").select("id, full_name, active").order("full_name"),
  ]);

  const rows = ((expenses ?? []) as any[]).map((e) => ({
    id: e.id, expense_for: e.expense_for, teacher_id: e.teacher_id, expense_date: e.expense_date,
    amount: Number(e.amount), details: e.details, teacher_name: e.teacher?.full_name ?? null,
  }));
  const allTeachers = (teachers ?? []) as (TeacherOpt & { active: boolean })[];
  const activeTeachers = allTeachers.filter((t) => t.active);
  const office = rows.filter((r) => r.expense_for === "office").reduce((s, r) => s + r.amount, 0);
  const teacherTotal = rows.filter((r) => r.expense_for === "teacher").reduce((s, r) => s + r.amount, 0);
  const teacherName = allTeachers.find((t) => t.id === teacherId)?.full_name;
  const filterText = `${fmtDate(from)} to ${fmtDate(to)} · ${forWhat === "all" ? "Office and teachers" : forWhat === "office" ? "Office" : "Teachers"}${teacherName ? ` · ${teacherName}` : ""}`;

  return (
    <>
      <header className="top no-print">
        <h1>Expenses</h1>
        <div className="sub">Money paid out for teachers or the office</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <details className="panel collapsible no-print" open>
          <summary className="phead">
            <div className="ptitle">Add an expense</div>
            <div className="sub">Teacher expenses show on that teacher&apos;s own Reports page</div>
          </summary>
          <div style={{ padding: 18 }}>
            <ExpenseForm teachers={activeTeachers} today={today} />
          </div>
        </details>

        <div className="panel print-flow">
          <div className="print-only" style={{ padding: "4px 0 12px", borderBottom: "2px solid #000", marginBottom: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Tasveer Academy</div>
            <div className="sub">105/A (2nd &amp; 3rd Floor), Kakrail, Dhaka 1000</div>
            <div style={{ marginTop: 6, fontWeight: 600 }}>Expenses report: {filterText}</div>
          </div>
          <div className="phead no-print">
            <div className="ptitle">Expenses report</div>
            <div className="sub">{filterText}</div>
            <div className="spacer" />
            <ExportCsvButton
              filename={`expenses-${from}-to-${to}`}
              headers={["Date", "For", "Teacher", "Details", "Amount"]}
              rows={rows.map((r) => [r.expense_date, r.expense_for === "office" ? "Office" : "Teacher", r.teacher_name ?? "", r.details, r.amount])}
            />
            <PrintButton />
          </div>

          <form method="GET" className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", padding: "14px 18px 4px" }}>
            <div className="field"><label className="lbl" htmlFor="f-from">From</label><input id="f-from" style={inputStyle} type="date" name="from" defaultValue={from} /></div>
            <div className="field"><label className="lbl" htmlFor="f-to">To</label><input id="f-to" style={inputStyle} type="date" name="to" defaultValue={to} /></div>
            <div className="field">
              <label className="lbl" htmlFor="f-for">Expense for</label>
              <select id="f-for" style={inputStyle} name="for" defaultValue={forWhat}>
                <option value="all">All</option>
                <option value="office">Office</option>
                <option value="teacher">Teachers</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="f-teacher">Teacher</label>
              <select id="f-teacher" style={inputStyle} name="teacher" defaultValue={teacherId}>
                <option value="">All teachers</option>
                {allTeachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Filter</button>
            <a className="btn ghost" href="/expenses" style={{ fontSize: 12, padding: "8px 12px" }}>This month</a>
          </form>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", padding: "14px 18px" }}>
            <div><div className="lbl">Total</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{taka(office + teacherTotal)}</b></div>
            <div><div className="lbl">Office</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{taka(office)}</b></div>
            <div><div className="lbl">Teachers</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{taka(teacherTotal)}</b></div>
            <div><div className="lbl">Entries</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{rows.length}</b></div>
          </div>

          <ExpenseTable rows={rows} teachers={activeTeachers} today={today} />

          <div className="print-only" style={{ marginTop: 28 }}>
            <span className="sub">Printed {fmtDate(today)} by {me?.full_name ?? "admin"}</span>
            <span className="sub" style={{ float: "right" }}>Signature: ____________________</span>
          </div>
        </div>
      </div>
    </>
  );
}
