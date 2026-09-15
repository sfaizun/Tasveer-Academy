import { createClient } from "@/lib/supabase/server";
import { taka, fmtDate, monthName, currentBillingMonth } from "@/lib/format";
import ReportBars, { type ReportBarRow } from "@/components/ReportBars";
import ExportCsvButton from "@/components/ExportCsvButton";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", card: "Card",
};

function daysBetween(from: string, to: string) {
  const d1 = new Date(from + "T00:00:00Z").getTime();
  const d2 = new Date(to + "T00:00:00Z").getTime();
  return Math.round((d2 - d1) / 86400000);
}

/** GET-submitted date filter for the daily cash panel — carries the page's month filter
 * along as a hidden field so picking a different day doesn't reset it, and vice versa. */
function CashDateFilter({ cashDate, month }: { cashDate: string; month: string | null }) {
  return (
    <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {month && <input type="hidden" name="month" value={month} />}
      <label className="lbl" style={{ margin: 0 }}>Date</label>
      <input type="date" name="cash_date" defaultValue={cashDate} style={inputStyle} />
      <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>
        Show
      </button>
    </form>
  );
}

export default async function CashFinanceReports({
  supabase,
  month,
  monthDate,
  fileTag,
  cashDate,
  today,
}: {
  supabase: Supabase;
  month: string | null;
  monthDate: string | null;
  fileTag: string;
  cashDate: string;
  today: string;
}) {
  const forecastMonth = monthDate ?? currentBillingMonth();

  const [
    { data: progRows },
    { data: discRows },
    { data: cashRows },
    { data: agingRows },
    { data: activeStudents },
    { data: activeEnrolments },
    { data: feeRates },
    { data: monthInvoices },
  ] = await Promise.all([
    (() => {
      let q = supabase
        .from("invoice")
        .select("gross, paid, balance, student(programme(name))")
        .neq("status", "void");
      if (monthDate) q = q.eq("billing_month", monthDate);
      return q;
    })(),
    (() => {
      let q = supabase
        .from("invoice_line")
        .select("id, description, amount, created_at, invoice!inner(invoice_no, billing_month, student(id, full_name, reg_no))")
        .eq("type", "discount")
        .order("created_at", { ascending: false });
      if (monthDate) q = q.eq("invoice.billing_month", monthDate);
      return q;
    })(),
    supabase
      .from("payment")
      .select("id, receipt_no, amount, method, note, student(full_name, reg_no)")
      .eq("status", "confirmed")
      .eq("received_on", cashDate)
      .order("received_at", { ascending: true }),
    supabase
      .from("invoice")
      .select("id, invoice_no, billing_month, due_on, balance, student(id, full_name, reg_no)")
      .in("status", ["unpaid", "partly_paid"])
      .gt("balance", 0)
      .order("due_on", { ascending: true }),
    supabase
      .from("student")
      .select("id, full_name, reg_no, admitted_on, class_level_id, programme(code, name)")
      .eq("status", "active"),
    supabase.from("enrolment").select("student_id, rate_applied, from_month, to_month").eq("status", "active"),
    supabase.from("fee_rate").select("class_level_id, amount, effective_from").eq("kind", "tuition").not("class_level_id", "is", null),
    supabase.from("invoice").select("student_id, paid").eq("billing_month", forecastMonth),
  ]);

  // --- Revenue by programme ---
  const progMap = new Map<string, { received: number; due: number }>();
  for (const r of (progRows ?? []) as any[]) {
    const name = r.student?.programme?.name ?? "Unknown";
    const cur = progMap.get(name) ?? { received: 0, due: 0 };
    cur.received += Number(r.paid || 0);
    cur.due += Number(r.balance || 0);
    progMap.set(name, cur);
  }
  const programmeRows = Array.from(progMap.entries()).map(([name, v]) => ({ name, ...v }));
  const programmeBars: ReportBarRow[] = programmeRows.map((r) => ({ key: r.name, label: r.name, received: r.received, due: r.due }));

  // --- Discounts & waivers ---
  const discounts = (discRows ?? []) as any[];
  const totalDiscount = discounts.reduce((s, d) => s + Math.abs(Number(d.amount)), 0);

  // --- Daily cash collection ---
  const cash = (cashRows ?? []) as any[];
  const cashByMethod = new Map<string, number>();
  for (const p of cash) cashByMethod.set(p.method, (cashByMethod.get(p.method) ?? 0) + Number(p.amount));
  const totalCash = cash.reduce((s, p) => s + Number(p.amount), 0);

  // --- Aging / overdue dues ---
  const openInvoices = ((agingRows ?? []) as any[]).map((inv) => ({ ...inv, daysLate: daysBetween(inv.due_on, today) }));
  const bucketOf = (d: number) => (d < 0 ? "notDue" : d <= 30 ? "d0_30" : d <= 60 ? "d31_60" : d <= 90 ? "d61_90" : "d90plus");
  const buckets: Record<string, any[]> = { notDue: [], d0_30: [], d31_60: [], d61_90: [], d90plus: [] };
  for (const inv of openInvoices) buckets[bucketOf(inv.daysLate)].push(inv);
  const bucketSum = (arr: any[]) => arr.reduce((s, r) => s + Number(r.balance), 0);
  const sortedAging = [...openInvoices].sort((a, b) => b.daysLate - a.daysLate);
  const bucketLabel = (d: number) => (d < 0 ? "Not yet due" : `${d} day${d === 1 ? "" : "s"} overdue`);

  // --- Revenue forecast (expected vs collected) ---
  const juniorRate = new Map<string, { amount: number; effective_from: string }>();
  for (const fr of (feeRates ?? []) as any[]) {
    if (!fr.effective_from || fr.effective_from > today) continue;
    const existing = juniorRate.get(fr.class_level_id);
    if (!existing || fr.effective_from > existing.effective_from) {
      juniorRate.set(fr.class_level_id, { amount: Number(fr.amount), effective_from: fr.effective_from });
    }
  }
  const enrolExpected = new Map<string, number>();
  for (const e of (activeEnrolments ?? []) as any[]) {
    if (e.from_month <= forecastMonth && (!e.to_month || e.to_month >= forecastMonth)) {
      enrolExpected.set(e.student_id, (enrolExpected.get(e.student_id) ?? 0) + Number(e.rate_applied));
    }
  }
  const collectedMap = new Map<string, number>();
  for (const inv of (monthInvoices ?? []) as any[]) {
    collectedMap.set(inv.student_id, (collectedMap.get(inv.student_id) ?? 0) + Number(inv.paid));
  }
  const forecastRows: { id: string; full_name: string; reg_no: string; programme: string; expected: number; collected: number; gap: number }[] = [];
  for (const s of (activeStudents ?? []) as any[]) {
    let expected = 0;
    if (s.programme?.code === "junior") {
      if (s.admitted_on && s.admitted_on.slice(0, 7) <= forecastMonth.slice(0, 7)) {
        expected = juniorRate.get(s.class_level_id)?.amount ?? 0;
      }
    } else {
      expected = enrolExpected.get(s.id) ?? 0;
    }
    if (expected <= 0) continue;
    const collected = collectedMap.get(s.id) ?? 0;
    forecastRows.push({ id: s.id, full_name: s.full_name, reg_no: s.reg_no, programme: s.programme?.name ?? "", expected, collected, gap: expected - collected });
  }
  forecastRows.sort((a, b) => b.gap - a.gap);
  const totalExpected = forecastRows.reduce((s, r) => s + r.expected, 0);
  const totalCollected = forecastRows.reduce((s, r) => s + r.collected, 0);
  const fallingBehind = forecastRows.filter((r) => r.gap > 0);

  return (
    <>
      <div className="navlbl" style={{ margin: "4px 0 -6px" }}>Cash &amp; finance</div>

      <details className="panel collapsible" open>
        <summary className="phead">
          <div className="ptitle">Revenue by programme</div>
          <div className="sub">O Level / A Level / Junior split</div>
          <div className="spacer" />
          <ExportCsvButton
            filename={`revenue-by-programme-${fileTag}`}
            headers={["Programme", "Received", "Due"]}
            rows={programmeRows.map((r) => [r.name, r.received, r.due])}
          />
        </summary>
        <div style={{ padding: 18 }}>
          <ReportBars rows={programmeBars} emptyLabel="No billing yet." />
        </div>
      </details>

      <details className="panel collapsible" open>
        <summary className="phead">
          <div className="ptitle">Discounts &amp; waivers</div>
          <div className="sub">
            {discounts.length} given{month ? ` in ${monthName(monthDate!)}` : ""} · {taka(totalDiscount)} total
          </div>
          <div className="spacer" />
          <ExportCsvButton
            filename={`discounts-${fileTag}`}
            headers={["Student", "Reg. no.", "Invoice", "Month", "Reason", "Amount", "Given on"]}
            rows={discounts.map((d) => [
              d.invoice?.student?.full_name ?? "",
              d.invoice?.student?.reg_no ?? "",
              d.invoice?.invoice_no ?? "",
              d.invoice?.billing_month ?? "",
              (d.description ?? "").replace(/^Discount\s*—\s*/, ""),
              Math.abs(Number(d.amount)),
              String(d.created_at).slice(0, 10),
            ])}
          />
        </summary>
        {discounts.length > 0 ? (
          <div className="tblwrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Invoice</th><th>Month</th><th>Reason</th><th className="n">Amount</th><th>Given on</th></tr>
              </thead>
              <tbody>
                {discounts.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <a href={`/students/${d.invoice?.student?.id}`}>{d.invoice?.student?.full_name}</a>
                      <span className="sub"> ({d.invoice?.student?.reg_no})</span>
                    </td>
                    <td className="mono sub">{d.invoice?.invoice_no}</td>
                    <td className="mono sub">{fmtDate(d.invoice?.billing_month)}</td>
                    <td className="sub">{(d.description ?? "").replace(/^Discount\s*—\s*/, "")}</td>
                    <td className="n mono">{taka(Math.abs(Number(d.amount)))}</td>
                    <td className="mono sub">{fmtDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 18 }} className="sub">No discounts {month ? "in this month" : "given yet"}.</div>
        )}
      </details>

      <details className="panel collapsible" open>
        <summary className="phead" style={{ flexWrap: "wrap" }}>
          <div className="ptitle">Daily cash collection</div>
          <div className="sub">{fmtDate(cashDate)} — {taka(totalCash)} collected</div>
          <div className="spacer" />
          <ExportCsvButton
            filename={`cash-collection-${cashDate}`}
            headers={["Receipt", "Student", "Reg. no.", "Method", "Amount", "Note"]}
            rows={cash.map((p) => [p.receipt_no, p.student?.full_name ?? "", p.student?.reg_no ?? "", METHOD_LABEL[p.method] ?? p.method, Number(p.amount), p.note ?? ""])}
          />
        </summary>
        <div style={{ padding: "0 16px 16px" }}>
          <CashDateFilter cashDate={cashDate} month={month} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, padding: "0 16px 16px" }}>
          {Object.entries(METHOD_LABEL).map(([key, label]) => (
            <div key={key} className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
              <div className="lbl">{label}</div>
              <div className="mono" style={{ fontWeight: 600 }}>{taka(cashByMethod.get(key) ?? 0)}</div>
            </div>
          ))}
        </div>
        {cash.length > 0 ? (
          <div className="tblwrap">
            <table>
              <thead><tr><th>Receipt</th><th>Student</th><th>Method</th><th className="n">Amount</th><th>Note</th></tr></thead>
              <tbody>
                {cash.map((p) => (
                  <tr key={p.id}>
                    <td className="mono"><b>{p.receipt_no}</b></td>
                    <td>{p.student?.full_name} <span className="sub mono">({p.student?.reg_no})</span></td>
                    <td className="sub">{METHOD_LABEL[p.method] ?? p.method}</td>
                    <td className="n mono">{taka(p.amount)}</td>
                    <td className="sub">{p.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "0 16px 18px" }} className="sub">No payments received on this date.</div>
        )}
      </details>

      <details className="panel collapsible" open>
        <summary className="phead">
          <div className="ptitle">Aging / overdue dues</div>
          <div className="sub">As of {fmtDate(today)} — {openInvoices.length} open invoice{openInvoices.length === 1 ? "" : "s"}</div>
          <div className="spacer" />
          <ExportCsvButton
            filename={`aging-${today}`}
            headers={["Student", "Reg. no.", "Invoice", "Billing month", "Due date", "Days overdue", "Balance"]}
            rows={sortedAging.map((r) => [r.student?.full_name ?? "", r.student?.reg_no ?? "", r.invoice_no, r.billing_month, r.due_on, r.daysLate, Number(r.balance)])}
          />
        </summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, padding: "16px" }}>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">Not yet due</div>
            <div className="mono" style={{ fontWeight: 600 }}>{taka(bucketSum(buckets.notDue))}</div>
            <div className="sub">{buckets.notDue.length} invoice{buckets.notDue.length === 1 ? "" : "s"}</div>
          </div>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">1–30 days</div>
            <div className="mono" style={{ fontWeight: 600 }}>{taka(bucketSum(buckets.d0_30))}</div>
            <div className="sub">{buckets.d0_30.length} invoice{buckets.d0_30.length === 1 ? "" : "s"}</div>
          </div>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">31–60 days</div>
            <div className="mono" style={{ fontWeight: 600, color: "var(--crit)" }}>{taka(bucketSum(buckets.d31_60))}</div>
            <div className="sub">{buckets.d31_60.length} invoice{buckets.d31_60.length === 1 ? "" : "s"}</div>
          </div>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">61–90 days</div>
            <div className="mono" style={{ fontWeight: 600, color: "var(--crit)" }}>{taka(bucketSum(buckets.d61_90))}</div>
            <div className="sub">{buckets.d61_90.length} invoice{buckets.d61_90.length === 1 ? "" : "s"}</div>
          </div>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">90+ days</div>
            <div className="mono" style={{ fontWeight: 600, color: "var(--crit)" }}>{taka(bucketSum(buckets.d90plus))}</div>
            <div className="sub">{buckets.d90plus.length} invoice{buckets.d90plus.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        {sortedAging.length > 0 ? (
          <div className="tblwrap">
            <table>
              <thead><tr><th>Student</th><th>Invoice</th><th>Month</th><th>Due</th><th className="n">Days overdue</th><th className="n">Balance</th></tr></thead>
              <tbody>
                {sortedAging.map((r) => (
                  <tr key={r.id}>
                    <td><a href={`/students/${r.student?.id}`}>{r.student?.full_name}</a> <span className="sub mono">({r.student?.reg_no})</span></td>
                    <td className="mono sub">{r.invoice_no}</td>
                    <td className="mono sub">{fmtDate(r.billing_month)}</td>
                    <td className="mono sub">{fmtDate(r.due_on)}</td>
                    <td className="n sub">{bucketLabel(r.daysLate)}</td>
                    <td className="n mono" style={{ color: r.daysLate > 0 ? "var(--crit)" : undefined }}>{taka(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "0 16px 18px" }} className="sub">Nothing outstanding right now.</div>
        )}
      </details>

      <details className="panel collapsible" open>
        <summary className="phead">
          <div className="ptitle">Revenue forecast</div>
          <div className="sub">Expected vs collected for {monthName(forecastMonth)} — based on active enrolments and rates, not just issued invoices</div>
          <div className="spacer" />
          <ExportCsvButton
            filename={`forecast-${forecastMonth.slice(0, 7)}`}
            headers={["Student", "Reg. no.", "Programme", "Expected", "Collected", "Gap"]}
            rows={forecastRows.map((r) => [r.full_name, r.reg_no, r.programme, r.expected, r.collected, r.gap])}
          />
        </summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, padding: "0 16px 16px" }}>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">Expected</div>
            <div className="mono" style={{ fontWeight: 600 }}>{taka(totalExpected)}</div>
          </div>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">Collected so far</div>
            <div className="mono" style={{ fontWeight: 600, color: "var(--ok)" }}>{taka(totalCollected)}</div>
          </div>
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">Gap</div>
            <div className="mono" style={{ fontWeight: 600, color: totalExpected - totalCollected > 0 ? "var(--crit)" : "var(--ok)" }}>
              {taka(totalExpected - totalCollected)}
            </div>
          </div>
        </div>
        {fallingBehind.length > 0 ? (
          <div className="tblwrap">
            <table>
              <thead><tr><th>Student</th><th>Programme</th><th className="n">Expected</th><th className="n">Collected</th><th className="n">Gap</th></tr></thead>
              <tbody>
                {fallingBehind.map((r) => (
                  <tr key={r.id}>
                    <td><a href={`/students/${r.id}`}>{r.full_name}</a> <span className="sub mono">({r.reg_no})</span></td>
                    <td className="sub">{r.programme}</td>
                    <td className="n mono">{taka(r.expected)}</td>
                    <td className="n mono">{taka(r.collected)}</td>
                    <td className="n mono" style={{ color: "var(--crit)" }}>{taka(r.gap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "0 16px 18px" }} className="sub">Everyone billable this month is fully paid up so far.</div>
        )}
      </details>
    </>
  );
}
