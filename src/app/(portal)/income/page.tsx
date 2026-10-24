import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import ExportCsvButton from "@/components/ExportCsvButton";
import OfficeTabs from "@/components/OfficeTabs";
import { dhakaTodayISO, fmtDate, taka } from "@/lib/format";
import IncomeForm from "./IncomeForm";
import IncomeTable from "./IncomeTable";
import OfficeIncomeMonth from "./OfficeIncomeMonth";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin, viewReadOnly } from "@/lib/access";

export const dynamic = "force-dynamic";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", minWidth: 160,
};
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

function PL({ value, big = false }: { value: number; big?: boolean }) {
  const color = value > 0 ? "var(--ok)" : value < 0 ? "var(--crit)" : "var(--ink)";
  return (
    <b className="mono" style={{ fontSize: big ? 18 : undefined, color }}>
      {value < 0 ? `(${taka(-value)})` : taka(value)}
    </b>
  );
}

/** Admin: Office Accounts > Income. Money the office receives other than student fees, with a
 * filterable, printable income report and the office profit or loss for the same dates
 * (office income minus office expenses; teacher expenses and student fees are not counted). */
export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; month?: string }>;
}) {
  await requirePage("income");
  const { me } = await getViewer();
  if (!actsAsAdmin(me, "income")) redirect("/dashboard");
  const readOnly = viewReadOnly(me);

  const sp = await searchParams;
  const today = dhakaTodayISO();
  const from = isDate(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = isDate(sp.to) ? sp.to : today;
  const thisMonth = today.slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") && (sp.month as string) <= thisMonth ? (sp.month as string) : thisMonth;

  const supabase = await createClient();
  const [{ data: incomeData }, { data: expenseData }, { data: totalsData }] = await Promise.all([
    supabase
      .from("office_income")
      .select("id, income_date, amount, details, category, attachment_name")
      .gte("income_date", from)
      .lte("income_date", to)
      .order("income_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("expense")
      .select("expense_date, amount")
      .eq("expense_for", "office")
      .gte("expense_date", from)
      .lte("expense_date", to),
    supabase.rpc("fn_office_income_totals", { p_from: from, p_to: to }),
  ]);

  const rows = ((incomeData ?? []) as any[]).map((r) => ({
    id: r.id, income_date: r.income_date, amount: Number(r.amount), details: r.details, category: (r.category === "registration" ? "registration" : "other") as "registration" | "other", attachment_name: r.attachment_name ?? null,
  }));
  const expenses = ((expenseData ?? []) as any[]).map((e) => ({ date: e.expense_date as string, amount: Number(e.amount) }));

  const incomeTotal = rows.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  // Profit / loss uses all office income: service charge, admission fees, registration fees,
  // canteen profit/loss and other income.
  const totals = ((totalsData ?? []) as any[]).map((t) => ({
    m: String(t.month).slice(0, 7), service: Number(t.service_charge), admission: Number(t.admission), registration: Number(t.registration),
    canteen: Number(t.canteen), other: Number(t.other), total: Number(t.total),
  }));
  const officeIncome = totals.reduce((s, t) => s + t.total, 0);
  const sumOf = (k: "service" | "admission" | "registration" | "canteen" | "other") => totals.reduce((s, t) => s + t[k], 0);
  const profit = officeIncome - expenseTotal;

  // Month by month, when the dates cover more than one month.
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (let m = from.slice(0, 7); m <= to.slice(0, 7) && byMonth.size < 120; ) {
    byMonth.set(m, { income: 0, expense: 0 });
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  for (const t of totals) { const b = byMonth.get(t.m); if (b) b.income += t.total; }
  for (const e of expenses) byMonth.get(e.date.slice(0, 7))!.expense += e.amount;
  const months = [...byMonth.entries()];

  const filterText = `${fmtDate(from)} to ${fmtDate(to)}`;

  return (
    <>
      <header className="top no-print">
        <h1>Office income</h1>
        <div className="sub">Service charge, admission fees, registration fees, canteen and other income</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <OfficeTabs active="income" />

        <OfficeIncomeMonth month={month} thisMonth={thisMonth} readOnly={readOnly} />

        {!readOnly && <details className="panel collapsible no-print" open>
          <summary className="phead">
            <div className="ptitle">Add registration fees or other income</div>
            <div className="sub">An attachment is required. Student fees are recorded as payments on the student&apos;s page.</div>
          </summary>
          <div style={{ padding: 18 }}>
            <IncomeForm today={today} />
          </div>
        </details>}

        <div className="panel print-flow">
          <div className="print-only" style={{ padding: "4px 0 12px", borderBottom: "2px solid #000", marginBottom: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Tasveer Academy</div>
            <div className="sub">105/A (2nd &amp; 3rd Floor), Kakrail, Dhaka 1000</div>
            <div style={{ marginTop: 6, fontWeight: 600 }}>Office income report: {filterText}</div>
          </div>
          <div className="phead no-print">
            <div className="ptitle">Office Income</div>
            <div className="sub">{filterText}</div>
            <div className="spacer" />
            <ExportCsvButton
              filename={`office-income-${from}-to-${to}`}
              headers={["Date", "Heading", "Details", "Attachment", "Amount"]}
              rows={rows.map((r) => [r.income_date, r.category === "registration" ? "Registration fees" : "Other income", r.details, r.attachment_name ?? "", r.amount])}
            />
            <PrintButton />
          </div>

          <form method="GET" className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", padding: "14px 18px 4px" }}>
            <div className="field"><label className="lbl" htmlFor="f-from">From</label><input id="f-from" style={inputStyle} type="date" name="from" defaultValue={from} /></div>
            <div className="field"><label className="lbl" htmlFor="f-to">To</label><input id="f-to" style={inputStyle} type="date" name="to" defaultValue={to} /></div>
            <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Filter</button>
            <a className="btn ghost" href="/income" style={{ fontSize: 12, padding: "8px 12px" }}>This month</a>
            <a className="btn ghost" href={`/income?from=${today.slice(0, 4)}-01-01&to=${today}`} style={{ fontSize: 12, padding: "8px 12px" }}>This year</a>
          </form>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", padding: "14px 18px" }}>
            <div><div className="lbl">Total income</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{taka(incomeTotal)}</b></div>
            <div><div className="lbl">Entries</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{rows.length}</b></div>
          </div>

          <IncomeTable rows={rows} today={today} readOnly={readOnly} />

          {/* Office profit or loss for the same dates */}
          <div style={{ padding: "18px 18px 6px", borderTop: "1px solid var(--line)", marginTop: 8 }}>
            <div className="ptitle" style={{ marginBottom: 4 }}>Profit / loss</div>
            <div className="sub" style={{ marginBottom: 12 }}>
              Office income (service charge, admission fees, registration fees, canteen profit/loss and other income) minus office expenses, {filterText}. Service charge counts in the month it is charged for. Teacher expenses are not included.
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 14 }}>
              <div>
                <div className="lbl">Office income</div>
                <b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{taka(officeIncome)}</b>
                <div className="sub" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                  Service charge {taka(sumOf("service"))} · Admission {taka(sumOf("admission"))} · Registration {taka(sumOf("registration"))} · Canteen {sumOf("canteen") < 0 ? `(${taka(-sumOf("canteen"))})` : taka(sumOf("canteen"))} · Other {taka(sumOf("other"))}
                </div>
              </div>
              <div>
                <div className="lbl">Office expenses</div>
                <b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{taka(expenseTotal)}</b>
                <div className="no-print"><a href={`/expenses?from=${from}&to=${to}&for=office`} style={{ fontSize: 12 }}>See expenses</a></div>
              </div>
              <div><div className="lbl">{profit < 0 ? "Loss" : "Profit"}</div><PL value={profit} big /></div>
            </div>
            {months.length > 1 && (
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Month</th><th className="n">Office income</th><th className="n">Office expenses</th><th className="n">Profit / loss</th></tr></thead>
                  <tbody>
                    {months.map(([m, v]) => (
                      <tr key={m}>
                        <td>{monthLabel(m)}</td>
                        <td className="n mono">{taka(v.income)}</td>
                        <td className="n mono">{taka(v.expense)}</td>
                        <td className="n"><PL value={v.income - v.expense} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><b style={{ color: "var(--ink)" }}>Total</b></td>
                      <td className="n mono"><b style={{ color: "var(--ink)" }}>{taka(officeIncome)}</b></td>
                      <td className="n mono"><b style={{ color: "var(--ink)" }}>{taka(expenseTotal)}</b></td>
                      <td className="n"><PL value={profit} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="sub" style={{ marginTop: 8 }}>A loss is shown in brackets.</div>
          </div>

          <div className="print-only" style={{ marginTop: 28 }}>
            <span className="sub">Printed {fmtDate(today)} by {me?.full_name ?? "admin"}</span>
            <span className="sub" style={{ float: "right" }}>Signature: ____________________</span>
          </div>
        </div>
      </div>
    </>
  );
}
