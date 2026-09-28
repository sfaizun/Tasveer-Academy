import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import ExportCsvButton from "@/components/ExportCsvButton";
import { fmtDate, fmtDateTime, taka } from "@/lib/format";
import { dayLabel, dhakaNow, dhakaTime, hhmm, niceError, WEEKDAYS, type CanteenHoursRow } from "@/lib/canteen";
import { requireCanteenAccess } from "../guard";
import { classifyMenu, Columns, DailyColumns, diffText, HBars, Heatmap, pct, Section, Tile } from "./parts";

export const dynamic = "force-dynamic";

type Report = {
  from: string; to: string; is_admin: boolean;
  summary: {
    sales_total: number; sale_count: number; cash_total: number; cash_count: number; bkash_total: number; bkash_count: number;
    void_count: number; void_total: number; days_open: number; days_closed: number; items_sold: number;
    cost_total: number | null; waste_cost: number | null;
  };
  daily: { date: string; status: string; sales: number; count: number; cash: number; bkash: number; voids: number; cost: number | null }[];
  items: { item_id: string; name: string; category: string | null; archived: boolean; track_stock: boolean; units: number; revenue: number; cost: number | null; cost_known: boolean | null }[];
  categories: { name: string; units: number; revenue: number; cost: number | null }[];
  heat: { wd: number; hr: number; count: number; revenue: number }[];
  weekday_days: Record<string, number>;
  stock: {
    item_id: string; name: string; is_packaged: boolean; carried_in: number; made: number; sold: number; leftover: number;
    wasted: number; carried_over: number; sold_out_days: number; stocked_days: number; earliest_sold_out: string | null; waste_cost: number | null;
  }[];
  cash: {
    date: string; status: string; opening_float: number; cash_expected: number | null; cash_counted: number | null;
    bkash_expected: number | null; bkash_reported: number | null; note: string | null; reopen_reason: string | null; closed_by: string | null; closed_at: string | null;
  }[] | null;
  voids: { receipt_no: string; date: string; sold_at: string; total: number; method: string; reason: string; voided_at: string; voided_by: string | null; items: string | null }[] | null;
  sellouts: { date: string; name: string; time: string; stocked: number }[];
  requests: { name: string; status: string; asks: number; students: number; teachers: number; item: string | null }[];
  soldout_asks: { name: string; asks: number }[];
  prices: { name: string; at: string; by: string | null; sell: number; cost: number | null; prev_sell: number | null; prev_cost: number | null }[] | null;
};

type TrendRow = { month: string; sales: number; sale_count: number; cost: number; waste_cost: number; days_open: number };

const STATUS_TEXT: Record<string, string> = { new: "New", considering: "Considering", added: "Added to menu", declined: "Declined" };
const Q_HELP: Record<string, string> = {
  Star: "popular and above-average margin: keep and feature",
  Workhorse: "popular, lower margin: consider a small price rise or cheaper recipe",
  Puzzle: "good margin but rarely bought: promote it or reposition it",
  Weak: "rarely bought and lower margin: candidate to drop",
};

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "30d", label: "Last 30 days" },
] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function resolveRange(sp: { range?: string; from?: string; to?: string }, today: string) {
  if (sp.from && sp.to && ISO.test(sp.from) && ISO.test(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return { key: "custom", from, to: to > today ? today : to };
  }
  const monthStart = today.slice(0, 8) + "01";
  switch (sp.range) {
    case "yesterday": return { key: "yesterday", from: addDays(today, -1), to: addDays(today, -1) };
    case "7d": return { key: "7d", from: addDays(today, -6), to: today };
    case "30d": return { key: "30d", from: addDays(today, -29), to: today };
    case "month": return { key: "month", from: monthStart, to: today };
    case "lastmonth": {
      const lastEnd = addDays(monthStart, -1);
      return { key: "lastmonth", from: lastEnd.slice(0, 8) + "01", to: lastEnd };
    }
    default: return { key: "today", from: today, to: today };
  }
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "6px 9px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

export default async function CanteenReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { isAdmin } = await requireCanteenAccess();
  const sp = await searchParams;
  const today = dhakaNow().date;
  const range = resolveRange(sp, today);
  const supabase = await createClient();

  const [{ data, error }, { data: changeovers }, { data: hours }, { data: trendData }] = await Promise.all([
    supabase.rpc("fn_canteen_report", { p_from: range.from, p_to: range.to }),
    supabase.rpc("fn_canteen_class_changeovers"),
    supabase.from("canteen_hours").select("weekday, is_open, opens_at, closes_at"),
    isAdmin ? supabase.rpc("fn_canteen_monthly_trend", { p_months: 12 }) : Promise.resolve({ data: [] }),
  ]);
  const trend = ((trendData ?? []) as TrendRow[]).map((t) => ({ ...t, sales: Number(t.sales), cost: Number(t.cost), waste_cost: Number(t.waste_cost) }));
  const firstTrend = trend.findIndex((t) => t.days_open > 0);
  const trendShown = firstTrend >= 0 ? trend.slice(firstTrend) : [];
  const r = data as Report | null;
  const tag = `canteen-${range.from}${range.from === range.to ? "" : "-to-" + range.to}`;
  const rangeText = range.from === range.to ? dayLabel(range.from) : `${fmtDate(range.from)} to ${fmtDate(range.to)}`;

  const header = (
    <header className="top">
      <h1>{isAdmin ? "Canteen sales reports" : "Canteen reports"}</h1>
      <span className="sub">{rangeText}</span>
      <div className="spacer" />
      <ThemeToggle />
    </header>
  );

  const filters = (
    <div className="panel" style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <div className="fchips">
        {RANGES.map((x) => (
          <Link key={x.key} href={`/canteen/reports?range=${x.key}`} className={range.key === x.key ? "fchip on" : "fchip"}>
            {x.label}
          </Link>
        ))}
      </div>
      <div className="spacer" style={{ flex: 1 }} />
      <form method="GET" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" name="from" defaultValue={range.from} max={today} style={inputStyle} aria-label="From" />
        <span className="sub">to</span>
        <input type="date" name="to" defaultValue={range.to} max={today} style={inputStyle} aria-label="To" />
        <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>Show</button>
      </form>
    </div>
  );

  if (error || !r) {
    return (
      <>
        {header}
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filters}
          <div className="panel sub" style={{ padding: 16, color: "var(--crit)" }}>{niceError(error?.message)}</div>
        </div>
      </>
    );
  }

  const s = r.summary;
  const avgSale = s.sale_count ? s.sales_total / s.sale_count : 0;
  const profit = s.cost_total != null ? s.sales_total - s.cost_total : null;
  const sold = r.items.filter((i) => i.units > 0);
  const best = [...sold].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 8);
  const slow = r.items
    .filter((i) => !i.archived)
    .sort((a, b) => a.units - b.units || a.revenue - b.revenue)
    .slice(0, 8);

  // Heat map hours: the opening hours, stretched to cover any sale made outside them.
  const h = (hours ?? []) as CanteenHoursRow[];
  const open = h.filter((x) => x.is_open && x.opens_at && x.closes_at);
  let hourFrom = open.length ? Math.min(...open.map((x) => Number(hhmm(x.opens_at).slice(0, 2)))) : 9;
  let hourTo = open.length ? Math.max(...open.map((x) => Number(hhmm(x.closes_at).slice(0, 2)))) : 19;
  for (const c of r.heat) { hourFrom = Math.min(hourFrom, c.hr); hourTo = Math.max(hourTo, c.hr); }
  const busiest = [...r.heat].sort((a, b) => b.count / (r.weekday_days[String(b.wd)] || 1) - a.count / (r.weekday_days[String(a.wd)] || 1))[0];

  const stockTotals = r.stock.reduce(
    (a, x) => ({ made: a.made + x.made + x.carried_in, sold: a.sold + x.sold, wasted: a.wasted + x.wasted, cost: a.cost + (x.waste_cost ?? 0) }),
    { made: 0, sold: 0, wasted: 0, cost: 0 },
  );
  const cashRows = (r.cash ?? []).filter((c) => c.status === "closed");
  const menu = classifyMenu(
    sold.filter((i) => i.cost_known !== false).map((i) => ({ id: i.item_id, name: i.name, units: i.units, revenue: Number(i.revenue), cost: Number(i.cost ?? 0) })),
  );
  const monthName = (m: string) => new Date(m + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  const cashDiffTotal = cashRows.reduce((a, c) => a + (Number(c.cash_counted) - Number(c.cash_expected)), 0);
  const bkashDiffTotal = cashRows.reduce((a, c) => a + (Number(c.bkash_reported) - Number(c.bkash_expected)), 0);

  return (
    <>
      {header}
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filters}

        {/* R1 Daily sales summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          <Tile label="Sales" value={taka(s.sales_total)} sub={`${s.sale_count} sale${s.sale_count === 1 ? "" : "s"} · ${s.days_open} day${s.days_open === 1 ? "" : "s"} open`} />
          <Tile label="Average sale" value={taka(avgSale)} sub={`${s.items_sold} items sold`} />
          <Tile
            label="Cash · bKash"
            value={`${pct(s.cash_total, s.sales_total)} · ${pct(s.bkash_total, s.sales_total)}`}
            sub={`${taka(s.cash_total)} cash (${s.cash_count}) · ${taka(s.bkash_total)} bKash (${s.bkash_count})`}
          />
          <Tile
            label="Voids"
            value={String(s.void_count)}
            tone={s.void_count ? "var(--warn)" : undefined}
            sub={s.void_count ? `${taka(s.void_total)} cancelled` : "none"}
          />
          {isAdmin && profit != null && (
            <Tile label="Gross profit" value={taka(profit)} sub={`${pct(profit, s.sales_total)} margin on cost of ${taka(s.cost_total)}`} />
          )}
          {isAdmin && s.waste_cost != null && (
            <Tile label="Wastage at cost" value={taka(s.waste_cost)} tone={s.waste_cost ? "var(--warn)" : undefined} sub={`${stockTotals.wasted} items thrown away`} />
          )}
        </div>

        <Section
          title="Sales by day"
          sub={`${r.daily.length} canteen day${r.daily.length === 1 ? "" : "s"}`}
          actions={
            <ExportCsvButton
              filename={`${tag}-daily`}
              headers={["Date", "Status", "Sales", "Number of sales", "Cash", "bKash", "Voids", ...(isAdmin ? ["Cost", "Gross profit"] : [])]}
              rows={r.daily.map((d) => [d.date, d.status, d.sales, d.count, d.cash, d.bkash, d.voids, ...(isAdmin ? [d.cost, Number(d.sales) - Number(d.cost ?? 0)] : [])])}
            />
          }
        >
          <div style={{ padding: "14px 16px 4px" }}>
            <DailyColumns days={r.daily.map((d) => ({ date: d.date, sales: Number(d.sales), count: d.count }))} />
          </div>
          {r.daily.length > 0 && (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>Day</th><th className="n">Sales</th><th className="n">Number</th><th className="n">Cash</th><th className="n">bKash</th><th className="n">Voids</th>
                    {isAdmin && <th className="n">Gross profit</th>}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...r.daily].reverse().map((d) => (
                    <tr key={d.date}>
                      <td>{dayLabel(d.date)}</td>
                      <td className="n mono">{taka(d.sales)}</td>
                      <td className="n mono">{d.count}</td>
                      <td className="n mono">{taka(d.cash)}</td>
                      <td className="n mono">{taka(d.bkash)}</td>
                      <td className="n mono">{d.voids || "—"}</td>
                      {isAdmin && <td className="n mono">{taka(Number(d.sales) - Number(d.cost ?? 0))}</td>}
                      <td><span className={`st ${d.status === "closed" ? "past" : "paid"}`}><span className="dot" />{d.status === "closed" ? "Closed" : "Open"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* R3 Best sellers and slow movers */}
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", alignItems: "start" }}>
          <Section title="Best sellers" sub="by units sold">
            <div style={{ padding: 16 }}>
              <HBars
                rows={best.map((i) => ({ key: i.item_id, label: i.name, value: i.units, note: taka(i.revenue) }))}
                fmt={(n) => String(n)}
                empty="Nothing sold in this range."
              />
            </div>
          </Section>
          <Section title="Slow movers" sub="fewest sold, still on the menu">
            <div style={{ padding: 16 }}>
              {slow.length === 0 ? (
                <div className="sub">No items on the menu.</div>
              ) : (
                slow.map((i) => (
                  <div key={i.item_id} className="sumrow">
                    <span>{i.name}{i.category && <span className="sub"> · {i.category}</span>}</span>
                    <b className="mono" style={{ color: i.units === 0 ? "var(--crit)" : undefined }}>
                      {i.units === 0 ? "None sold" : `${i.units} sold`}
                    </b>
                  </div>
                ))
              )}
            </div>
          </Section>
        </div>

        {/* R2 Item-wise sales */}
        <Section
          title="Item-wise sales"
          sub={isAdmin ? "units, revenue, cost and profit at the price and cost on the day of each sale" : "units and revenue for each item"}
          actions={
            <ExportCsvButton
              filename={`${tag}-items`}
              headers={["Item", "Category", "Units", "Revenue", "Share of sales", ...(isAdmin ? ["Cost", "Gross profit", "Margin"] : [])]}
              rows={sold.map((i) => [
                i.name, i.category, i.units, i.revenue, pct(Number(i.revenue), s.sales_total),
                ...(isAdmin ? [i.cost, Number(i.revenue) - Number(i.cost ?? 0), pct(Number(i.revenue) - Number(i.cost ?? 0), Number(i.revenue))] : []),
              ])}
            />
          }
        >
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th><th>Category</th><th className="n">Units</th><th className="n">Revenue</th><th className="n">Share</th>
                  {isAdmin && <><th className="n">Cost</th><th className="n">Gross profit</th><th className="n">Margin</th></>}
                </tr>
              </thead>
              <tbody>
                {sold.map((i) => {
                  const p = Number(i.revenue) - Number(i.cost ?? 0);
                  return (
                    <tr key={i.item_id}>
                      <td><b style={{ color: "var(--ink)" }}>{i.name}</b>{i.archived && <span className="sub"> · archived</span>}</td>
                      <td className="sub">{i.category ?? "—"}</td>
                      <td className="n mono">{i.units}</td>
                      <td className="n mono">{taka(i.revenue)}</td>
                      <td className="n mono">{pct(Number(i.revenue), s.sales_total)}</td>
                      {isAdmin && (
                        <>
                          <td className="n mono">{taka(i.cost)}{i.cost_known === false && <span className="sub" title="Some sales had no cost price"> *</span>}</td>
                          <td className="n mono" style={{ color: p < 0 ? "var(--crit)" : undefined }}>{taka(p)}</td>
                          <td className="n mono">{pct(p, Number(i.revenue))}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {sold.length === 0 && <tr><td colSpan={isAdmin ? 8 : 5} className="sub">Nothing sold in this range.</td></tr>}
              </tbody>
            </table>
          </div>
          {isAdmin && sold.some((i) => i.cost_known === false) && (
            <div className="sub" style={{ padding: "8px 16px 14px" }}>* Some sales of this item had no cost price, so its profit is overstated. Add cost prices on Menu &amp; prices.</div>
          )}
        </Section>

        {/* R4 Category sales */}
        <Section
          title="Sales by category"
          actions={
            <ExportCsvButton
              filename={`${tag}-categories`}
              headers={["Category", "Units", "Revenue", "Share of sales", ...(isAdmin ? ["Cost", "Gross profit"] : [])]}
              rows={r.categories.map((c) => [c.name, c.units, c.revenue, pct(Number(c.revenue), s.sales_total), ...(isAdmin ? [c.cost, Number(c.revenue) - Number(c.cost ?? 0)] : [])])}
            />
          }
        >
          <div style={{ padding: 16 }}>
            <HBars
              rows={r.categories.map((c) => ({
                key: c.name, label: c.name, value: Number(c.revenue),
                note: `${c.units} items · ${pct(Number(c.revenue), s.sales_total)}${isAdmin ? ` · ${taka(Number(c.revenue) - Number(c.cost ?? 0))} profit` : ""}`,
              }))}
              fmt={(n) => taka(n)}
              empty="Nothing sold in this range."
            />
          </div>
        </Section>

        {/* R5 Sales by hour and weekday */}
        <Section
          title="When it sells"
          sub={busiest ? `busiest: ${WEEKDAYS[busiest.wd]} ${String(busiest.hr).padStart(2, "0")}:00` : "average sales per hour, by weekday"}
          actions={
            <ExportCsvButton
              filename={`${tag}-by-hour`}
              headers={["Weekday", "Hour", "Sales", "Revenue", "Days in range", "Average sales per day"]}
              rows={[...r.heat]
                .sort((a, b) => a.wd - b.wd || a.hr - b.hr)
                .map((c) => [WEEKDAYS[c.wd], `${String(c.hr).padStart(2, "0")}:00`, c.count, c.revenue, r.weekday_days[String(c.wd)] ?? 0, (c.count / (r.weekday_days[String(c.wd)] || 1)).toFixed(1)])}
            />
          }
        >
          <div style={{ padding: 16 }}>
            <Heatmap
              heat={r.heat}
              weekdayDays={r.weekday_days}
              changeovers={(changeovers ?? []) as { wd: number; hr: number; classes: number }[]}
              hourFrom={hourFrom}
              hourTo={hourTo}
            />
          </div>
        </Section>

        {/* R6 Stock and wastage */}
        <Section
          title="Stock and wastage"
          sub={`${stockTotals.sold} of ${stockTotals.made} sold (${pct(stockTotals.sold, stockTotals.made)}), ${stockTotals.wasted} wasted${isAdmin ? ` · ${taka(stockTotals.cost)} at cost` : ""}`}
          actions={
            <ExportCsvButton
              filename={`${tag}-stock`}
              headers={["Item", "Packaged", "Days stocked", "Carried in", "Made or bought", "Sold", "Sell-through", "Left", "Wasted", "Carried over", "Days sold out", "Earliest sell-out", ...(isAdmin ? ["Wastage at cost"] : [])]}
              rows={r.stock.map((x) => [
                x.name, x.is_packaged ? "Yes" : "No", x.stocked_days, x.carried_in, x.made, x.sold, pct(x.sold, x.made + x.carried_in),
                x.leftover, x.wasted, x.carried_over, x.sold_out_days, x.earliest_sold_out ?? "", ...(isAdmin ? [x.waste_cost] : []),
              ])}
            />
          }
        >
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th><th className="n">Carried in</th><th className="n">Made / bought</th><th className="n">Sold</th><th className="n">Sell-through</th>
                  <th className="n">Wasted</th><th className="n">Carried over</th><th>Sold out</th>
                  {isAdmin && <th className="n">Wastage cost</th>}
                </tr>
              </thead>
              <tbody>
                {r.stock.map((x) => (
                  <tr key={x.item_id}>
                    <td><b style={{ color: "var(--ink)" }}>{x.name}</b>{x.is_packaged && <span className="sub"> · Packaged</span>}</td>
                    <td className="n mono">{x.carried_in || "—"}</td>
                    <td className="n mono">{x.made}</td>
                    <td className="n mono">{x.sold}</td>
                    <td className="n mono">{pct(x.sold, x.made + x.carried_in)}</td>
                    <td className="n mono" style={{ color: x.wasted ? "var(--warn)" : undefined }}>{x.wasted || "—"}</td>
                    <td className="n mono">{x.carried_over || "—"}</td>
                    <td className="sub">
                      {x.sold_out_days ? `${x.sold_out_days} of ${x.stocked_days} day${x.stocked_days === 1 ? "" : "s"}${x.earliest_sold_out ? `, earliest ${x.earliest_sold_out}` : ""}` : "Never"}
                    </td>
                    {isAdmin && <td className="n mono">{x.waste_cost ? taka(x.waste_cost) : "—"}</td>}
                  </tr>
                ))}
                {r.stock.length === 0 && <tr><td colSpan={isAdmin ? 9 : 8} className="sub">No stock entered in this range.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ padding: "8px 16px 14px" }}>
            Leftovers and waste are counted when a day is closed{s.days_open > s.days_closed ? `; ${s.days_open - s.days_closed} day(s) in this range are still open` : ""}.
          </div>
        </Section>

        {/* R9 Sell-out times */}
        <Section
          title="Sell-outs"
          sub={r.sellouts.length ? `${r.sellouts.length} time${r.sellouts.length === 1 ? "" : "s"} an item ran out` : "nothing ran out"}
          actions={
            <ExportCsvButton
              filename={`${tag}-sellouts`}
              headers={["Date", "Item", "Sold out at", "Stock that day"]}
              rows={r.sellouts.map((x) => [x.date, x.name, x.time, x.stocked])}
            />
          }
        >
          <div className="tblwrap">
            <table>
              <thead><tr><th>Day</th><th>Item</th><th>Sold out at</th><th className="n">Stock that day</th></tr></thead>
              <tbody>
                {r.sellouts.map((x, i) => (
                  <tr key={i}>
                    <td>{dayLabel(x.date)}</td>
                    <td><b style={{ color: "var(--ink)" }}>{x.name}</b></td>
                    <td className="mono">{x.time}</td>
                    <td className="n mono">{x.stocked}</td>
                  </tr>
                ))}
                {r.sellouts.length === 0 && <tr><td colSpan={4} className="sub">Nothing sold out in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>

        {/* R12 Requests and missed demand */}
        <Section
          title="Requests and missed demand"
          sub="asks logged in this range"
          actions={
            <ExportCsvButton
              filename={`${tag}-requests`}
              headers={["Type", "Name", "Asks", "Students", "Teachers", "Status", "Linked menu item"]}
              rows={[
                ...r.requests.map((q) => ["Request", q.name, q.asks, q.students, q.teachers, STATUS_TEXT[q.status] ?? q.status, q.item ?? ""]),
                ...r.soldout_asks.map((q) => ["Asked while sold out", q.name, q.asks, "", "", "", ""]),
              ]}
            />
          }
        >
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", padding: 16 }}>
            <div>
              <div className="lbl" style={{ marginBottom: 8 }}>Asked for, not on the menu</div>
              {r.requests.length === 0 ? (
                <div className="sub">No requests logged.</div>
              ) : (
                r.requests.map((q) => (
                  <div key={q.name} className="sumrow">
                    <span>
                      {q.name}
                      <span className="sub"> · {STATUS_TEXT[q.status] ?? q.status}{q.item ? ` as ${q.item}` : ""}</span>
                    </span>
                    <b className="mono">{q.asks}</b>
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="lbl" style={{ marginBottom: 8 }}>Asked for while sold out (missed sales)</div>
              {r.soldout_asks.length === 0 ? (
                <div className="sub">None logged.</div>
              ) : (
                r.soldout_asks.map((q) => (
                  <div key={q.name} className="sumrow"><span>{q.name}</span><b className="mono">{q.asks}</b></div>
                ))
              )}
            </div>
          </div>
        </Section>

        {/* R7 Cash reconciliation (admin) */}
        {isAdmin && (
          <Section
            title="Cash reconciliation"
            adminOnly
            sub={cashRows.length ? `cash ${diffText(cashDiffTotal).toLowerCase()} · bKash ${diffText(bkashDiffTotal).toLowerCase()} over ${cashRows.length} closed day${cashRows.length === 1 ? "" : "s"}` : undefined}
            actions={
              <ExportCsvButton
                filename={`${tag}-cash`}
                headers={["Date", "Status", "Opening cash", "Cash expected", "Cash counted", "Cash difference", "bKash sales", "bKash in app", "bKash difference", "Note", "Closed by", "Closed at", "Reopened because"]}
                rows={(r.cash ?? []).map((c) => [
                  c.date, c.status, c.opening_float, c.cash_expected, c.cash_counted,
                  c.status === "closed" ? Number(c.cash_counted) - Number(c.cash_expected) : "",
                  c.bkash_expected, c.bkash_reported,
                  c.status === "closed" ? Number(c.bkash_reported) - Number(c.bkash_expected) : "",
                  c.note, c.closed_by, c.closed_at ? fmtDateTime(c.closed_at) : "", c.reopen_reason,
                ])}
              />
            }
          >
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>Day</th><th className="n">Opening</th><th className="n">Expected</th><th className="n">Counted</th><th>Cash</th>
                    <th className="n">bKash sales</th><th className="n">In app</th><th>bKash</th><th>Note</th><th>Closed by</th>
                  </tr>
                </thead>
                <tbody>
                  {(r.cash ?? []).map((c) => {
                    const closed = c.status === "closed";
                    const cd = closed ? Number(c.cash_counted) - Number(c.cash_expected) : null;
                    const bd = closed ? Number(c.bkash_reported) - Number(c.bkash_expected) : null;
                    return (
                      <tr key={c.date}>
                        <td><Link href={`/canteen/close`}>{dayLabel(c.date)}</Link></td>
                        <td className="n mono">{taka(c.opening_float)}</td>
                        <td className="n mono">{closed ? taka(c.cash_expected) : "—"}</td>
                        <td className="n mono">{closed ? taka(c.cash_counted) : "—"}</td>
                        <td style={{ color: cd ? "var(--crit)" : undefined, whiteSpace: "nowrap" }}>{closed ? diffText(cd) : "Day open"}</td>
                        <td className="n mono">{closed ? taka(c.bkash_expected) : "—"}</td>
                        <td className="n mono">{closed ? taka(c.bkash_reported) : "—"}</td>
                        <td style={{ color: bd ? "var(--crit)" : undefined, whiteSpace: "nowrap" }}>{closed ? diffText(bd) : "—"}</td>
                        <td className="sub" style={{ maxWidth: 240 }}>
                          {c.note ?? ""}{c.reopen_reason && <div>Reopened: {c.reopen_reason}</div>}
                        </td>
                        <td className="sub">{c.closed_by ?? ""}</td>
                      </tr>
                    );
                  })}
                  {(r.cash ?? []).length === 0 && <tr><td colSpan={10} className="sub">No canteen days in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* R8 Voids log (admin) */}
        {isAdmin && (
          <Section
            title="Voided sales"
            adminOnly
            sub={`${(r.voids ?? []).length} in this range`}
            actions={
              <ExportCsvButton
                filename={`${tag}-voids`}
                headers={["Receipt", "Date", "Sold at", "Items", "Paid by", "Total", "Reason", "Voided by", "Voided at"]}
                rows={(r.voids ?? []).map((v) => [v.receipt_no, v.date, dhakaTime(v.sold_at), v.items, v.method, v.total, v.reason, v.voided_by, fmtDateTime(v.voided_at)])}
              />
            }
          >
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>Receipt</th><th>Sold</th><th>Items</th><th className="n">Total</th><th>Reason</th><th>Voided by</th></tr>
                </thead>
                <tbody>
                  {(r.voids ?? []).map((v) => (
                    <tr key={v.receipt_no}>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{v.receipt_no}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{dayLabel(v.date)} {dhakaTime(v.sold_at)}</td>
                      <td>{v.items}</td>
                      <td className="n mono">{taka(v.total)}</td>
                      <td>{v.reason}</td>
                      <td className="sub" style={{ whiteSpace: "nowrap" }}>{v.voided_by ?? ""}<div>{fmtDateTime(v.voided_at)}</div></td>
                    </tr>
                  ))}
                  {(r.voids ?? []).length === 0 && <tr><td colSpan={6} className="sub">No voided sales in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* R11 Menu performance (admin) */}
        {isAdmin && (
          <Section
            title="Menu performance"
            adminOnly
            sub={menu.rows.length ? `popular = ${Math.ceil(menu.popLine)}+ sold · good margin = ${taka(menu.avgMargin)}+ profit each` : undefined}
            actions={
              <ExportCsvButton
                filename={`${tag}-menu-performance`}
                headers={["Item", "Group", "Units", "Profit each", "Gross profit"]}
                rows={menu.rows.map((m) => [m.name, m.quadrant, m.units, Math.round(m.margin * 100) / 100, m.revenue - m.cost])}
              />
            }
          >
            {menu.rows.length === 0 ? (
              <div className="sub" style={{ padding: 16 }}>Nothing sold with a known cost in this range.</div>
            ) : (
              <div className="quad">
                {(["Star", "Puzzle", "Workhorse", "Weak"] as const).map((q) => {
                  const list = menu.rows.filter((m) => m.quadrant === q).sort((a, b) => b.units - a.units);
                  return (
                    <div key={q} className="quad-cell">
                      <div className="quad-head"><b>{q === "Star" ? "Stars" : q === "Puzzle" ? "Puzzles" : q === "Workhorse" ? "Workhorses" : "Weak"}</b> <span className="sub">{Q_HELP[q]}</span></div>
                      {list.length === 0 ? (
                        <div className="sub">None</div>
                      ) : (
                        list.map((m) => (
                          <div key={m.id} className="sumrow">
                            <span>{m.name}</span>
                            <span className="mono sub">{m.units} sold · {taka(m.margin)} each</span>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* R13 Month-on-month trend (admin) */}
        {isAdmin && (
          <Section
            title="Month by month"
            adminOnly
            sub="last 12 months, not affected by the range above"
            actions={
              <ExportCsvButton
                filename="canteen-monthly-trend"
                headers={["Month", "Sales", "Number of sales", "Average sale", "Cost", "Gross profit", "Margin", "Wastage at cost", "Days open"]}
                rows={trendShown.map((t) => [
                  t.month.slice(0, 7), t.sales, t.sale_count, t.sale_count ? Math.round(t.sales / t.sale_count) : 0, t.cost,
                  t.sales - t.cost, pct(t.sales - t.cost, t.sales), t.waste_cost, t.days_open,
                ])}
              />
            }
          >
            <div style={{ padding: "14px 16px 4px" }}>
              <Columns rows={trendShown.map((t) => ({ key: t.month, label: monthName(t.month), value: t.sales, tip: `${monthName(t.month)}: ${taka(t.sales)} sales` }))} />
            </div>
            {trendShown.length > 0 && (
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr><th>Month</th><th className="n">Sales</th><th className="n">Average sale</th><th className="n">Gross profit</th><th className="n">Margin</th><th className="n">Wastage</th><th className="n">Days open</th></tr>
                  </thead>
                  <tbody>
                    {[...trendShown].reverse().map((t) => (
                      <tr key={t.month}>
                        <td>{monthName(t.month)}</td>
                        <td className="n mono">{taka(t.sales)}</td>
                        <td className="n mono">{t.sale_count ? taka(t.sales / t.sale_count) : "—"}</td>
                        <td className="n mono">{taka(t.sales - t.cost)}</td>
                        <td className="n mono">{pct(t.sales - t.cost, t.sales)}</td>
                        <td className="n mono">{taka(t.waste_cost)}</td>
                        <td className="n mono">{t.days_open}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* R14 Price change history (admin) */}
        {isAdmin && (
          <Section
            title="Price changes"
            adminOnly
            sub={`${(r.prices ?? []).length} in this range`}
            actions={
              <ExportCsvButton
                filename={`${tag}-price-changes`}
                headers={["Item", "Changed at", "Changed by", "Old price", "New price", "Old cost", "New cost"]}
                rows={(r.prices ?? []).map((x) => [x.name, fmtDateTime(x.at), x.by, x.prev_sell, x.sell, x.prev_cost, x.cost])}
              />
            }
          >
            <div className="tblwrap">
              <table>
                <thead><tr><th>Item</th><th>When</th><th>By</th><th>Price</th><th>Cost</th></tr></thead>
                <tbody>
                  {(r.prices ?? []).map((x, i) => (
                    <tr key={i}>
                      <td><b style={{ color: "var(--ink)" }}>{x.name}</b></td>
                      <td className="sub" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(x.at)}</td>
                      <td className="sub">{x.by ?? ""}</td>
                      <td className="mono">{x.prev_sell == null ? `${taka(x.sell)} (first price)` : x.prev_sell === x.sell ? taka(x.sell) : `${taka(x.prev_sell)} → ${taka(x.sell)}`}</td>
                      <td className="mono">
                        {x.prev_sell == null ? (x.cost == null ? "—" : taka(x.cost)) : x.prev_cost === x.cost ? (x.cost == null ? "—" : taka(x.cost)) : `${x.prev_cost == null ? "—" : taka(x.prev_cost)} → ${x.cost == null ? "—" : taka(x.cost)}`}
                      </td>
                    </tr>
                  ))}
                  {(r.prices ?? []).length === 0 && <tr><td colSpan={5} className="sub">No price changes in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <div className="sub">
          {isAdmin
            ? "Canteen figures stay in this section; they are not part of the academy Reports or Dashboard."
            : "Figures include only confirmed sales; voided sales are left out."}
        </div>
      </div>
    </>
  );
}
