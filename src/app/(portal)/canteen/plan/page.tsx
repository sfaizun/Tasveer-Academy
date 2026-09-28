import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { dayLabel, dhakaNow, dhakaTime, hhmm, WEEKDAYS, type CanteenClosureRow, type CanteenHoursRow } from "@/lib/canteen";
import { buildPlan, type PlanHistoryDay, type PlanItem } from "@/lib/canteen-plan";
import { requireCanteenAccess } from "../guard";
import PlanEditor from "./PlanEditor";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekdayOf = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();
const dhakaDateOf = (ts: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireCanteenAccess();
  const sp = await searchParams;
  const now = dhakaNow();
  const today = now.date;
  const supabase = await createClient();

  const [{ data: hoursData }, { data: closuresData }] = await Promise.all([
    supabase.from("canteen_hours").select("weekday, is_open, opens_at, closes_at"),
    supabase.from("canteen_closure").select("id, date_from, date_to, reason").gte("date_to", today),
  ]);
  const hours = (hoursData ?? []) as CanteenHoursRow[];
  const closures = (closuresData ?? []) as CanteenClosureRow[];
  const hoursFor = (wd: number) => hours.find((h) => h.weekday === wd);
  const closureOn = (d: string) => closures.find((c) => c.date_from <= d && c.date_to >= d);
  const isOpenOn = (d: string) => !!hoursFor(weekdayOf(d))?.is_open && !closureOn(d);

  // The next open days to plan for: today (before closing time) and the following two weeks.
  const choices: string[] = [];
  for (let i = 0; i <= 14 && choices.length < 7; i++) {
    const d = addDays(today, i);
    if (!isOpenOn(d)) continue;
    if (i === 0 && now.time >= hhmm(hoursFor(weekdayOf(d))?.closes_at)) continue;
    choices.push(d);
  }
  const defaultDate = choices.find((d) => d > today) ?? choices[0] ?? addDays(today, 1);
  const target = sp.date && ISO.test(sp.date) && sp.date >= today && sp.date <= addDays(today, 14) ? sp.date : defaultDate;
  const wd = weekdayOf(target);
  const targetClosed = !isOpenOn(target);

  // History: the last 4 closed days on the same weekday (looking back 10 weeks).
  const since = addDays(target, -70);
  const [{ data: pastDays }, { data: items }, { data: recentLines }, { data: requests }, { data: asks }, { data: savedPlan }, { data: prevDay }] =
    await Promise.all([
      supabase.from("canteen_day").select("id, business_date").eq("status", "closed").gte("business_date", since).lt("business_date", target)
        .order("business_date", { ascending: false }),
      supabase.from("canteen_item_current").select("id, name, batch_size, is_packaged, sell_price, cost_price, created_at, track_stock, archived")
        .eq("archived", false).eq("track_stock", true).order("name"),
      supabase.from("canteen_sale_line").select("item_id, qty, canteen_sale!inner(status, sold_at)")
        .eq("canteen_sale.status", "confirmed").gte("canteen_sale.sold_at", new Date(Date.now() - 14 * DAY_MS).toISOString()),
      supabase.from("canteen_request").select("id, name, status").in("status", ["new", "considering"]),
      supabase.from("canteen_request_ask").select("kind, request_id, item_id, asked_at").gte("asked_at", new Date(Date.now() - 75 * DAY_MS).toISOString()),
      supabase.from("canteen_plan").select("item_id, accepted_qty, suggested_qty, saved_at").eq("plan_date", target),
      supabase.from("canteen_day").select("id, business_date, status").lt("business_date", target).order("business_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const sameWeekday = (pastDays ?? []).filter((d: any) => weekdayOf(d.business_date) === wd).slice(0, 4);
  const stockDayIds = [...sameWeekday.map((d: any) => d.id), ...(prevDay ? [prevDay.id] : [])];
  const [{ data: stockRows }, { data: counts }] = await Promise.all([
    stockDayIds.length
      ? supabase.from("canteen_stock_view")
          .select("day_id, item_id, carried_in, prepared_qty, restock_qty, sold_qty, leftover_qty, carry_over_qty, available, sold_out_at")
          .in("day_id", stockDayIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.rpc("fn_canteen_class_counts", { p_dates: [target, ...sameWeekday.map((d: any) => d.business_date)] }),
  ]);

  const classesOn = new Map(((counts ?? []) as { d: string; classes: number }[]).map((c) => [c.d, c.classes]));
  const h = hoursFor(wd);
  const history: PlanHistoryDay[] = sameWeekday.map((d: any) => {
    const rows = (stockRows ?? []).filter((s: any) => s.day_id === d.id);
    const stock: PlanHistoryDay["stock"] = {};
    for (const s of rows as any[]) {
      stock[s.item_id] = {
        stocked: s.carried_in + s.prepared_qty + s.restock_qty,
        sold: s.sold_qty,
        leftover: s.leftover_qty ?? 0,
        soldOutAt: s.sold_out_at ? dhakaTime(s.sold_out_at) : null,
      };
    }
    const asked: Record<string, number> = {};
    for (const a of (asks ?? []) as any[]) {
      if (a.kind === "sold_out" && a.item_id && dhakaDateOf(a.asked_at) === d.business_date) asked[a.item_id] = (asked[a.item_id] ?? 0) + 1;
    }
    return { date: d.business_date, opens: hhmm(h?.opens_at) || null, closes: hhmm(h?.closes_at) || null, classes: classesOn.get(d.business_date) ?? 0, stock, askedWhileSoldOut: asked };
  });

  // Packaged items: what the day before will hand over (its carry-over once closed, or what's left now).
  const carryIn: Record<string, number> = {};
  if (prevDay) {
    for (const s of (stockRows ?? []).filter((x: any) => x.day_id === prevDay.id) as any[]) {
      carryIn[s.item_id] = prevDay.status === "closed" ? s.carry_over_qty ?? 0 : s.available;
    }
  }

  const sold14 = new Map<string, number>();
  for (const l of (recentLines ?? []) as any[]) sold14.set(l.item_id, (sold14.get(l.item_id) ?? 0) + l.qty);
  const planItems: PlanItem[] = ((items ?? []) as any[]).map((i) => ({
    id: i.id,
    name: i.name,
    batchSize: i.batch_size ?? 1,
    isPackaged: i.is_packaged,
    price: i.sell_price == null ? null : Number(i.sell_price),
    cost: i.cost_price == null ? null : Number(i.cost_price),
    soldLast14: sold14.get(i.id) ?? 0,
    onMenuDays: Math.floor((Date.now() - new Date(i.created_at).getTime()) / DAY_MS),
  }));

  const asks30 = new Map<string, number>();
  for (const a of (asks ?? []) as any[]) {
    if (a.kind === "request" && a.request_id && Date.now() - new Date(a.asked_at).getTime() <= 30 * DAY_MS) {
      asks30.set(a.request_id, (asks30.get(a.request_id) ?? 0) + 1);
    }
  }

  const plan = buildPlan({
    targetClasses: classesOn.get(target) ?? 0,
    history,
    items: planItems,
    carryIn,
    requests: ((requests ?? []) as any[]).map((r) => ({ id: r.id, name: r.name, asks30: asks30.get(r.id) ?? 0 })),
    weekdayName: WEEKDAYS[wd],
  });

  const saved = new Map(((savedPlan ?? []) as any[]).map((p) => [p.item_id, p]));
  const savedAt = (savedPlan ?? []).length ? (savedPlan as any[]).map((p) => p.saved_at).sort().pop() : null;

  // How good were recent plans? Planned vs made vs sold for the last 14 days that had a plan.
  const { data: pastPlans } = await supabase
    .from("canteen_plan").select("plan_date, item_id, accepted_qty").gte("plan_date", addDays(today, -14)).lt("plan_date", today);
  const planDates = [...new Set(((pastPlans ?? []) as any[]).map((p) => p.plan_date))].sort().reverse();
  let review: { date: string; planned: number; made: number; sold: number; soldOut: number; wasted: number; items: number }[] = [];
  if (planDates.length) {
    const { data: pd } = await supabase.from("canteen_day").select("id, business_date, status").in("business_date", planDates);
    const dayIds = ((pd ?? []) as any[]).map((d) => d.id);
    const { data: ps } = dayIds.length
      ? await supabase.from("canteen_stock").select("day_id, item_id, prepared_qty, restock_qty, carried_in, sold_qty, wasted_qty, sold_out_at").in("day_id", dayIds)
      : { data: [] as any[] };
    review = planDates.map((date) => {
      const day = ((pd ?? []) as any[]).find((d) => d.business_date === date);
      const planned = ((pastPlans ?? []) as any[]).filter((p) => p.plan_date === date);
      const rows = ((ps ?? []) as any[]).filter((s) => day && s.day_id === day.id && planned.some((p) => p.item_id === s.item_id));
      return {
        date,
        items: planned.length,
        planned: planned.reduce((a, p) => a + p.accepted_qty, 0),
        made: rows.reduce((a, s) => a + s.prepared_qty + s.restock_qty, 0),
        sold: rows.reduce((a, s) => a + s.sold_qty, 0),
        soldOut: rows.filter((s) => s.sold_out_at).length,
        wasted: rows.reduce((a, s) => a + (s.wasted_qty ?? 0), 0),
      };
    });
  }

  return (
    <>
      <header className="top">
        <h1>Prep plan</h1>
        <span className="sub">What to make or buy, worked out from past sales</span>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="panel" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="lbl" style={{ margin: 0 }}>Plan for</span>
          <div className="fchips">
            {choices.map((d) => (
              <Link key={d} href={`/canteen/plan?date=${d}`} className={d === target ? "fchip on" : "fchip"}>
                {d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : dayLabel(d)}
              </Link>
            ))}
          </div>
        </div>

        {targetClosed ? (
          <div className="panel sub" style={{ padding: 16 }}>
            The canteen is closed on {dayLabel(target)}{closureOn(target) ? ` (${closureOn(target)!.reason})` : ""}. Pick another day.
          </div>
        ) : (
          <PlanEditor
            key={target}
            planDate={target}
            dayName={`${WEEKDAYS[wd]} ${dayLabel(target).slice(4)}`}
            weekdayName={WEEKDAYS[wd]}
            plan={plan}
            items={planItems.map((i) => ({ id: i.id, price: i.price, cost: i.cost }))}
            saved={Object.fromEntries([...saved.entries()].map(([k, v]) => [k, v.accepted_qty as number]))}
            savedAt={savedAt}
            historyLabels={sameWeekday.map((d: any) => dayLabel(d.business_date).slice(4))}
          />
        )}

        {review.length > 0 && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">How recent plans went</div>
              <div className="sub">planned items only · made includes restocks</div>
            </div>
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>Day</th><th className="n">Items</th><th className="n">Planned</th><th className="n">Made</th><th className="n">Sold</th><th className="n">Sold out</th><th className="n">Wasted</th></tr>
                </thead>
                <tbody>
                  {review.map((r) => (
                    <tr key={r.date}>
                      <td>{dayLabel(r.date)}</td>
                      <td className="n mono">{r.items}</td>
                      <td className="n mono">{r.planned}</td>
                      <td className="n mono">{r.made || "—"}</td>
                      <td className="n mono">{r.sold}</td>
                      <td className="n mono" style={{ color: r.soldOut ? "var(--warn)" : undefined }}>{r.soldOut || "—"}</td>
                      <td className="n mono" style={{ color: r.wasted ? "var(--warn)" : undefined }}>{r.wasted || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <details className="panel collapsible">
          <summary className="phead"><div className="ptitle">How the plan is worked out</div></summary>
          <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 6 }} className="sub">
            <div><b>Same weekday only.</b> The last 4 closed days on the same weekday, because a busy Sunday and a quiet Monday are different days for the canteen.</div>
            <div><b>Missed sales count.</b> If an item sold out, what would have sold in the hours still open is added back (capped at half of what did sell), plus every &ldquo;Someone asked for it&rdquo; click that day.</div>
            <div><b>Recent weeks count more.</b> 40%, 30%, 20% and 10% for the last four.</div>
            <div><b>Class schedule.</b> If that day has more or fewer classes than usual, the numbers are scaled to match.</div>
            <div><b>Rounded up</b> to the item&apos;s batch size. Packaged items subtract what will carry over.</div>
            <div><b>Flags.</b> Make more if it sold out on 2 or more days; Make less if a quarter or more was left over; Consider dropping if nothing sold in 14 days or the margin is under 10%; Try adding for any request asked 10+ times in 30 days.</div>
            <div>With fewer than 3 weeks of history, an item shows &ldquo;Not enough history&rdquo; and you enter your own number. Suggestions are advice only; change anything before saving.</div>
          </div>
        </details>
        <div className="sub">Saving a plan fills in &ldquo;Made / bought&rdquo; on <Link href="/canteen/stock">Today&apos;s stock</Link> that morning, ready to check and save.</div>
      </div>
    </>
  );
}
