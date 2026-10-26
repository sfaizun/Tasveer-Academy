import type { createClient } from "@/lib/supabase/server";
import ExportCsvButton from "@/components/ExportCsvButton";
import PrintSectionButton from "@/components/PrintSectionButton";
import { fmtDate, monthName, taka } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** A teacher's own expenses (recorded by admin), filterable by date. Read only; the database
 * only ever returns this teacher's own rows. */
export default async function TeacherExpensesReport({
  supabase, teacherId, from, to, month,
}: {
  supabase: Supabase;
  teacherId: string;
  from: string;
  to: string;
  month: string | null;
}) {
  const { data } = await supabase
    .from("expense")
    .select("id, expense_date, amount, details, attachment_name")
    .eq("teacher_id", teacherId)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  // Service charges are taken from the teacher's account too: one line per charged month.
  const [{ data: scData }, { data: stData }] = await Promise.all([
    supabase.from("service_charge").select("id, month, kind, rate, base_collection, amount")
      .eq("teacher_id", teacherId).eq("status", "charged").gte("month", `${from.slice(0, 7)}-01`).lte("month", to),
    supabase.rpc("fn_teacher_statement", { p_teacher_id: teacherId, p_year: Number(to.slice(0, 4)) }),
  ]);
  const charges = ((scData ?? []) as any[]).map((c) => ({
    id: `sc-${c.id}`, expense_date: c.month as string, amount: Number(c.amount), attachment_name: null, service: true,
    details: `Service charge, ${monthName(c.month)}${c.kind === "percent" ? ` (${Number(c.rate)}% of ৳${Number(c.base_collection ?? 0).toLocaleString("en-IN")} fee collection)` : ""}`,
  }));
  const rows = [...((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount), service: false })), ...charges]
    .sort((a, b) => String(b.expense_date).localeCompare(String(a.expense_date)));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const statement = ((stData ?? []) as any[]).map((r) => ({
    month: r.month as string, collection: Number(r.collection), expenses: Number(r.expenses), service: Number(r.service_charge), balance: Number(r.balance), running: Number(r.running),
  }));
  const tk = (v: number) => (v < 0 ? "−৳" : "৳") + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <>
    <details className="panel collapsible" open id="my-balance">
      <summary className="phead">
        <div className="ptitle">My balance</div>
        <div className="sub">Fee collection (your share of fees received, admission fees excluded) − expenses − service charge, {to.slice(0, 4)}</div>
        <div className="spacer" />
        <PrintSectionButton target="my-balance" />
      </summary>
      <div className="tblwrap">
        <table>
          <thead><tr><th>Month</th><th className="n">Fee collection</th><th className="n">Expenses</th><th className="n">Service charge</th><th className="n">Balance</th><th className="n">Running total</th></tr></thead>
          <tbody>
            {statement.map((r) => (
              <tr key={r.month}>
                <td>{monthName(r.month)}</td>
                <td className="n mono">{tk(r.collection)}</td>
                <td className="n mono">{r.expenses ? tk(-r.expenses) : "-"}</td>
                <td className="n mono">{r.service ? tk(-r.service) : "-"}</td>
                <td className="n mono"><b style={{ color: r.balance < 0 ? "var(--crit)" : undefined }}>{tk(r.balance)}</b></td>
                <td className="n mono">{tk(r.running)}</td>
              </tr>
            ))}
            {statement.length === 0 && <tr><td colSpan={6} className="sub">Nothing yet this year.</td></tr>}
          </tbody>
        </table>
      </div>
    </details>
    <details className="panel collapsible" open id="my-expenses">
      <summary className="phead">
        <div className="ptitle">My expenses</div>
        <div className="sub">Expenses recorded for you by the academy and service charges, {fmtDate(from)} to {fmtDate(to)}</div>
        <div className="spacer" />
        <ExportCsvButton
          filename={`my-expenses-${from}-to-${to}`}
          headers={["Date", "Details", "Attachment", "Amount"]}
          rows={rows.map((r) => [r.expense_date, r.details, r.attachment_name ?? "", r.amount])}
        />
        <PrintSectionButton target="my-expenses" />
      </summary>
      <form method="GET" action="/reports#my-expenses" className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", padding: "14px 18px 4px" }}>
        {month && <input type="hidden" name="month" value={month} />}
        <div className="field"><label className="lbl" htmlFor="xe-from">From</label><input id="xe-from" style={inputStyle} type="date" name="exp_from" defaultValue={from} /></div>
        <div className="field"><label className="lbl" htmlFor="xe-to">To</label><input id="xe-to" style={inputStyle} type="date" name="exp_to" defaultValue={to} /></div>
        <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Filter</button>
      </form>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", padding: "14px 18px" }}>
        <div><div className="lbl">Total in this period</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{taka(total)}</b></div>
        <div><div className="lbl">Entries</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{rows.length}</b></div>
      </div>
      <div className="tblwrap">
        <table>
          <thead><tr><th>Date</th><th>Details</th><th>Attachment</th><th className="n">Amount</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{r.service ? monthName(r.expense_date) : fmtDate(r.expense_date)}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{r.service && <span className="st part" style={{ marginRight: 6 }}>Service charge</span>}{r.details}</td>
                <td>
                  {r.service ? <span className="sub">-</span> : r.attachment_name ? (
                    <a href={`/expenses/file/${r.id}`} target="_blank" rel="noopener" title={r.attachment_name} style={{ fontSize: 12.5 }}>View file</a>
                  ) : <span className="sub">-</span>}
                </td>
                <td className="n mono">{taka(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="sub">No expenses recorded for you in this period.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr><td colSpan={3}><b style={{ color: "var(--ink)" }}>Total</b></td><td className="n mono"><b style={{ color: "var(--ink)" }}>{taka(total)}</b></td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </details>
    </>
  );
}
