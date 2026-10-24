import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import OfficeTabs from "@/components/OfficeTabs";
import PrintButton from "@/components/PrintButton";
import ExportCsvButton from "@/components/ExportCsvButton";
import { dhakaTodayISO, fmtDate, monthName } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import { viewReadOnly } from "@/lib/access";
import { CountCell, StartForm } from "./Forms";

export const dynamic = "force-dynamic";

type Day = {
  day: string; opening: number; collection: number; income: number; office_expense: number; teacher_expense: number;
  closing: number; counted: number | null; difference: number | null; count_note: string | null;
};

const n = (v: unknown) => Number(v ?? 0);
const tk = (v: number) => (v < 0 ? "−৳" : "৳") + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const lastDay = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};

function Diff({ v }: { v: number | null }) {
  if (v == null) return <span className="sub">-</span>;
  if (Math.abs(v) < 0.005) return <span className="st paid"><span className="dot" />Matches</span>;
  return <span className="st over">{v < 0 ? `Short ${tk(-v)}` : `Over ${tk(v)}`}</span>;
}

/** Office Accounts > Cash balance. Each day's closing = opening + fee collection (all payment
 * methods) + office income - office expenses - teachers' expenses; the closing is the next day's
 * opening. The office enters the cash actually counted to see any difference. Monthly totals below. */
export default async function CashBalancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePage("cash_balance");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const readOnly = viewReadOnly(me);
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const thisMonth = today.slice(0, 7);
  const sp = await searchParams;
  let month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? (sp.month as string) : thisMonth;
  if (month > thisMonth) month = thisMonth;
  const year = month.slice(0, 4);

  const [{ data: startRow }, { data: yearRows }] = await Promise.all([
    supabase.from("cash_book_start").select("start_date, opening_balance").maybeSingle(),
    supabase.rpc("fn_cash_book", { p_from: `${year}-01-01`, p_to: `${year}-12-31` }),
  ]);
  const start = startRow as { start_date: string; opening_balance: number } | null;
  const all = ((yearRows ?? []) as Day[]).map((d) => ({
    ...d, opening: n(d.opening), collection: n(d.collection), income: n(d.income), office_expense: n(d.office_expense),
    teacher_expense: n(d.teacher_expense), closing: n(d.closing), counted: d.counted == null ? null : n(d.counted), difference: d.difference == null ? null : n(d.difference),
  }));
  const days = all.filter((d) => d.day.slice(0, 7) === month);
  const sum = (list: Day[], k: keyof Day) => list.reduce((s, d) => s + n(d[k]), 0);

  // Monthly summary for the year: opening of the first day, totals, closing of the last day.
  const months = [...new Set(all.map((d) => d.day.slice(0, 7)))].map((m) => {
    const list = all.filter((d) => d.day.slice(0, 7) === m);
    return {
      m, opening: list[0].opening, collection: sum(list, "collection"), income: sum(list, "income"),
      office: sum(list, "office_expense"), teacher: sum(list, "teacher_expense"), closing: list[list.length - 1].closing,
    };
  });
  const cur = months.find((x) => x.m === month);
  const shown = [...days].reverse();

  return (
    <>
      <header className="top no-print">
        <h1>Cash balance</h1>
        <div className="sub">{monthName(`${month}-01`)}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <OfficeTabs active="cash" />

        {!start ? (
          <div className="panel" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <b>Start the cash book</b>
            <div className="sub">Choose the first day to track and the cash in hand that morning. Every day after it is worked out from there.</div>
            {readOnly ? <div className="sub">View only.</div> : <StartForm today={today} />}
          </div>
        ) : (
          <>
            <form method="GET" className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="month" name="month" defaultValue={month} max={thisMonth} aria-label="Month"
                style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px", fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit" }} />
              <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Show</button>
              {month !== thisMonth && <a className="btn ghost" href="/cash-balance" style={{ fontSize: 12, padding: "8px 12px" }}>This month</a>}
              <div style={{ flex: 1 }} />
              <ExportCsvButton
                filename={`cash-balance-${month}`}
                headers={["Date", "Opening", "Fee collection", "Office income", "Office expenses", "Teacher expenses", "Closing", "Counted", "Difference", "Note"]}
                rows={days.map((d) => [d.day, d.opening, d.collection, d.income, d.office_expense, d.teacher_expense, d.closing, d.counted ?? "", d.difference ?? "", d.count_note ?? ""])}
              />
              <PrintButton />
            </form>

            {cur ? (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
                {[
                  ["Opening", cur.opening], ["Fee collection", cur.collection], ["Office income", cur.income],
                  ["Office expenses", -cur.office], ["Teacher expenses", -cur.teacher], [month === thisMonth ? "Closing (today)" : "Closing", cur.closing],
                ].map(([l, v]) => (
                  <div key={l as string} className="panel" style={{ padding: "12px 14px" }}>
                    <div className="lbl">{l}</div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 600, color: (l as string).startsWith("Closing") ? "var(--ok)" : "var(--ink)" }}>{tk(v as number)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel" style={{ padding: 18 }}><div className="sub">The cash book starts on {fmtDate(start.start_date)}; nothing to show for this month.</div></div>
            )}

            {days.length > 0 && (
              <div className="panel">
                <div className="phead">
                  <div className="ptitle">Daily cash book</div>
                  <div className="sub">Closing = opening + fee collection + office income − office expenses − teacher expenses. Newest first.</div>
                </div>
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th><th className="n">Opening</th><th className="n">Fee collection</th><th className="n">Office income</th>
                        <th className="n">Office expenses</th><th className="n">Teacher expenses</th><th className="n">Closing</th>
                        <th className="n">Counted cash</th><th className="n">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((d) => (
                        <tr key={d.day}>
                          <td className="mono" style={{ whiteSpace: "nowrap" }}>
                            <a href={`/reports?cash_date=${d.day}`} title="See the day's payments">{fmtDate(d.day)}</a>
                          </td>
                          <td className="n mono">{tk(d.opening)}</td>
                          <td className="n mono">{d.collection ? tk(d.collection) : "-"}</td>
                          <td className="n mono">{d.income ? tk(d.income) : "-"}</td>
                          <td className="n mono">{d.office_expense ? tk(-d.office_expense) : "-"}</td>
                          <td className="n mono">{d.teacher_expense ? tk(-d.teacher_expense) : "-"}</td>
                          <td className="n mono"><b>{tk(d.closing)}</b></td>
                          <td className="n"><CountCell date={d.day} counted={d.counted} note={d.count_note} readOnly={readOnly} /></td>
                          <td className="n"><Diff v={d.difference} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {months.length > 0 && (
              <div className="panel">
                <div className="phead"><div className="ptitle">Monthly cash balance, {year}</div></div>
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr><th>Month</th><th className="n">Opening</th><th className="n">Fee collection</th><th className="n">Office income</th><th className="n">Office expenses</th><th className="n">Teacher expenses</th><th className="n">Closing</th></tr>
                    </thead>
                    <tbody>
                      {months.map((x) => (
                        <tr key={x.m}>
                          <td><a href={`/cash-balance?month=${x.m}`}>{monthName(`${x.m}-01`)}</a></td>
                          <td className="n mono">{tk(x.opening)}</td>
                          <td className="n mono">{tk(x.collection)}</td>
                          <td className="n mono">{tk(x.income)}</td>
                          <td className="n mono">{tk(-x.office)}</td>
                          <td className="n mono">{tk(-x.teacher)}</td>
                          <td className="n mono"><b>{tk(x.closing)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!readOnly && (
              <details className="panel no-print">
                <summary className="phead" style={{ cursor: "pointer" }}>
                  <div className="ptitle">Starting balance</div>
                  <div className="sub">{fmtDate(start.start_date)}: {tk(n(start.opening_balance))} in hand that morning</div>
                </summary>
                <div style={{ padding: "14px 18px" }}><StartForm startDate={start.start_date} opening={n(start.opening_balance)} today={today} /></div>
              </details>
            )}
          </>
        )}
      </div>
    </>
  );
}
