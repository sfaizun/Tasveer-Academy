import type { createClient } from "@/lib/supabase/server";
import ExportCsvButton from "@/components/ExportCsvButton";
import { fmtDate, taka } from "@/lib/format";

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
    .select("id, expense_date, amount, details")
    .eq("teacher_id", teacherId)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) }));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <details className="panel collapsible" open id="my-expenses">
      <summary className="phead">
        <div className="ptitle">My expenses</div>
        <div className="sub">Expenses recorded for you by the academy, {fmtDate(from)} to {fmtDate(to)}</div>
        <div className="spacer" />
        <ExportCsvButton
          filename={`my-expenses-${from}-to-${to}`}
          headers={["Date", "Details", "Amount"]}
          rows={rows.map((r) => [r.expense_date, r.details, r.amount])}
        />
      </summary>
      <form method="GET" action="/reports#my-expenses" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", padding: "14px 18px 4px" }}>
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
          <thead><tr><th>Date</th><th>Details</th><th className="n">Amount</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.expense_date)}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{r.details}</td>
                <td className="n mono">{taka(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="sub">No expenses recorded for you in this period.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr><td colSpan={2}><b style={{ color: "var(--ink)" }}>Total</b></td><td className="n mono"><b style={{ color: "var(--ink)" }}>{taka(total)}</b></td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </details>
  );
}
