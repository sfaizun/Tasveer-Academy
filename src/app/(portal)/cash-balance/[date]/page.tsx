import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import { dhakaTodayISO, fmtDate, fmtDateTime } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import { loadAcademy } from "../../report-cards/load";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", card: "Card" };
const n = (v: unknown) => Number(v ?? 0);
const tk = (v: number) => (v < 0 ? "−৳" : "৳") + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const nextDay = (iso: string, d: number) => {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};

function Section({ title, total, empty, children }: { title: string; total: number; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="rc-subject">
      <div className="rc-shead">
        <div className="rc-sname">{title}</div>
        <div style={{ flex: 1 }} />
        <b className="mono">{tk(total)}</b>
      </div>
      {empty ? <div className="sub" style={{ padding: "4px 0" }}>None on this day.</div> : children}
    </section>
  );
}

/** One day of the cash book in detail: every fee payment, office income, office expense and teacher
 * expense behind the day's figures, with opening and closing. Prints on A4 (?print=1 opens print). */
export default async function CashDayPage({ params, searchParams }: {
  params: Promise<{ date: string }>; searchParams: Promise<{ print?: string }>;
}) {
  await requirePage("cash_balance");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const { date } = await params;
  const { print } = await searchParams;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const today = dhakaTodayISO();
  const supabase = await createClient();

  const [{ data: bookRows }, { data: pays }, { data: incs }, { data: exps }, academy] = await Promise.all([
    supabase.rpc("fn_cash_book", { p_from: date, p_to: date }),
    supabase.from("payment").select("id, receipt_no, amount, method, note, received_at, student(full_name, reg_no), received_by_user:received_by(full_name)")
      .eq("status", "confirmed").eq("received_on", date).order("received_at"),
    supabase.from("office_income").select("id, amount, details, attachment_name, created_at").eq("income_date", date).order("created_at"),
    supabase.from("expense").select("id, expense_for, amount, details, attachment_name, created_at, teacher(full_name)").eq("expense_date", date).order("created_at"),
    loadAcademy(supabase),
  ]);
  const book = ((bookRows ?? []) as any[])[0] ?? null;
  const payments = (pays ?? []) as any[];
  const income = (incs ?? []) as any[];
  const office = ((exps ?? []) as any[]).filter((e) => e.expense_for === "office");
  const teacher = ((exps ?? []) as any[]).filter((e) => e.expense_for === "teacher");
  const sum = (l: any[]) => l.reduce((s, x) => s + n(x.amount), 0);
  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + n(p.amount));

  return (
    <>
      {print === "1" && <AutoPrint />}
      <header className="top no-print">
        <h1>Cash book</h1>
        <div className="sub">{fmtDate(date)}</div>
        <div className="spacer" />
        <a className="btn ghost" href={`/cash-balance?month=${date.slice(0, 7)}`} style={{ fontSize: 12, padding: "6px 10px" }}>Back</a>
        <a className="btn ghost" href={`/cash-balance/${nextDay(date, -1)}`} style={{ fontSize: 12, padding: "6px 10px" }}>← Previous day</a>
        {date < today && <a className="btn ghost" href={`/cash-balance/${nextDay(date, 1)}`} style={{ fontSize: 12, padding: "6px 10px" }}>Next day →</a>}
        <PrintButton label="Print / Save as PDF" />
        <ThemeToggle />
      </header>
      <div className="content">
        <div className="rc">
          <div className="rc-head">
            <img src="/logo.png" alt="" width={52} height={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rc-academy">{academy.name}</div>
              <div className="rc-addr">{academy.address}{academy.phone ? ` · ${academy.phone}` : ""}</div>
            </div>
            <div className="rc-title">
              <div>DAILY CASH BOOK</div>
              <b>{fmtDate(date)}</b>
            </div>
          </div>

          {book ? (
            <div className="rc-student">
              <div><span className="lbl">Opening balance</span><b className="mono">{tk(n(book.opening))}</b></div>
              <div><span className="lbl">+ Fee collection</span><b className="mono">{tk(n(book.collection))}</b></div>
              <div><span className="lbl">+ Office income</span><b className="mono">{tk(n(book.income))}</b></div>
              <div><span className="lbl">− Office expenses</span><b className="mono">{tk(n(book.office_expense))}</b></div>
              <div><span className="lbl">− Teacher expenses</span><b className="mono">{tk(n(book.teacher_expense))}</b></div>
              <div><span className="lbl">Closing balance</span><b className="mono" style={{ color: "#2e7355" }}>{tk(n(book.closing))}</b></div>
              {book.counted != null && (
                <>
                  <div><span className="lbl">Counted cash</span><b className="mono">{tk(n(book.counted))}</b></div>
                  <div><span className="lbl">Difference</span><b className="mono" style={{ color: Math.abs(n(book.difference)) < 0.005 ? "#2e7355" : "#9e2a20" }}>
                    {Math.abs(n(book.difference)) < 0.005 ? "Matches" : n(book.difference) < 0 ? `Short ${tk(-n(book.difference))}` : `Over ${tk(n(book.difference))}`}
                  </b></div>
                </>
              )}
              {book.count_note && <div style={{ gridColumn: "1 / -1" }}><span className="lbl">Count note</span><b>{book.count_note}</b></div>}
            </div>
          ) : (
            <div className="rc-student"><div style={{ gridColumn: "1 / -1" }}><span className="lbl">Balance</span><b>This day is outside the cash book (before its start date or in the future), so no balance is shown. The entries below are still listed.</b></div></div>
          )}

          <Section title="Fee collection" total={sum(payments)} empty={!payments.length}>
            <table className="rc-marks keep-table">
              <thead><tr><th>Receipt</th><th>Student</th><th>Method</th><th>Received by</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{p.receipt_no}</td>
                    <td>{p.student?.full_name ?? "-"}{p.student?.reg_no ? <span className="sub mono"> {p.student.reg_no}</span> : null}{p.note ? <div className="sub">{p.note}</div> : null}</td>
                    <td>{METHOD[p.method] ?? p.method}</td>
                    <td className="sub">{p.received_by_user?.full_name ?? "-"}{p.received_at ? <div className="sub">{fmtDateTime(p.received_at).split(", ")[1]}</div> : null}</td>
                    <td className="n mono">{tk(n(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {byMethod.size > 1 && (
              <div className="sub">By method: {[...byMethod].map(([m, v]) => `${METHOD[m] ?? m} ${tk(v)}`).join(" · ")}</div>
            )}
          </Section>

          <Section title="Office income" total={sum(income)} empty={!income.length}>
            <table className="rc-marks keep-table">
              <thead><tr><th>Details</th><th className="no-print">Attachment</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {income.map((x) => (
                  <tr key={x.id}>
                    <td>{x.details}</td>
                    <td className="no-print">{x.attachment_name ? <a href={`/income/file/${x.id}`} target="_blank" rel="noopener">View file</a> : "-"}</td>
                    <td className="n mono">{tk(n(x.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Office expenses" total={sum(office)} empty={!office.length}>
            <table className="rc-marks keep-table">
              <thead><tr><th>Details</th><th className="no-print">Attachment</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {office.map((x) => (
                  <tr key={x.id}>
                    <td>{x.details}</td>
                    <td className="no-print">{x.attachment_name ? <a href={`/expenses/file/${x.id}`} target="_blank" rel="noopener">View file</a> : "-"}</td>
                    <td className="n mono">{tk(n(x.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Teacher expenses" total={sum(teacher)} empty={!teacher.length}>
            <table className="rc-marks keep-table">
              <thead><tr><th>Teacher</th><th>Details</th><th className="no-print">Attachment</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {teacher.map((x) => (
                  <tr key={x.id}>
                    <td>{x.teacher?.full_name ?? "-"}</td>
                    <td>{x.details}</td>
                    <td className="no-print">{x.attachment_name ? <a href={`/expenses/file/${x.id}`} target="_blank" rel="noopener">View file</a> : "-"}</td>
                    <td className="n mono">{tk(n(x.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <div className="rc-foot" style={{ marginTop: 36 }}>
            <span>Printed {fmtDate(today)} by {me.full_name}</span>
            <span>Checked by: ____________________</span>
          </div>
        </div>
      </div>
    </>
  );
}
