import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { fmtDateTime, taka } from "@/lib/format";
import { requireCanteenAccess } from "../guard";
import { loadDays, loadSales } from "../data";
import { SalesList, StaleDaysBanner } from "../DayBits";
import CloseDayForm, { type LeftLine } from "./CloseDayForm";
import { ReopenForm } from "./ReopenForm";
import OfflineWarning from "./OfflineWarning";
import { DAY_COLS, STOCK_COLS, dayLabel, type CanteenDay, type StockRow } from "@/lib/canteen";

export const dynamic = "force-dynamic";

function diffText(n: number) {
  if (n === 0) return "Matches";
  return n < 0 ? `${taka(-n)} short` : `${taka(n)} over`;
}

export default async function CloseDayPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { isAdmin } = await requireCanteenAccess();
  const supabase = await createClient();
  const { day: wanted } = await searchParams;
  const { today, day: todayDay, staleOpen } = await loadDays(supabase);

  // Which day is this page about? An explicit ?day=, else the oldest day left open, else today.
  let target: CanteenDay | null = null;
  if (wanted) {
    const { data } = await supabase.from("canteen_day").select(DAY_COLS).eq("id", wanted).maybeSingle();
    target = (data ?? null) as CanteenDay | null;
    // The manager can close any day left open, but past cash figures are for admin.
    if (target && !isAdmin && target.status === "closed" && target.business_date !== today) target = null;
  }
  target ??= staleOpen[0] ?? todayDay;

  const recentQ = isAdmin
    ? supabase.from("canteen_day").select(DAY_COLS).order("business_date", { ascending: false }).limit(14)
    : Promise.resolve({ data: [] as CanteenDay[] });

  const [{ data: stock }, { data: items }, { data: recent }] = await Promise.all([
    target ? supabase.from("canteen_stock_view").select(STOCK_COLS).eq("day_id", target.id) : Promise.resolve({ data: [] }),
    supabase.from("canteen_item").select("id, name, is_packaged"),
    recentQ,
  ]);
  const sales = target ? await loadSales(supabase, target.id) : [];
  const live = sales.filter((s) => s.status === "confirmed");
  const cash = live.filter((s) => s.payment_method === "cash");
  const bkash = live.filter((s) => s.payment_method === "bkash");
  const sum = (rows: { total: number }[]) => rows.reduce((a, s) => a + s.total, 0);

  const itemBy = new Map((items ?? []).map((i: any) => [i.id, i]));
  const left: LeftLine[] = ((stock ?? []) as StockRow[])
    .filter((s) => s.carried_in + s.prepared_qty + s.restock_qty > 0)
    .map((s) => ({
      stock_id: s.id,
      name: itemBy.get(s.item_id)?.name ?? "Item",
      is_packaged: !!itemBy.get(s.item_id)?.is_packaged,
      left: s.available,
      unit_cost: s.unit_cost != null ? Number(s.unit_cost) : null,
      wasted: s.wasted_qty,
      carry: s.carry_over_qty,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Sales per day for admin's recent-days table.
  const recentDays = (recent ?? []) as CanteenDay[];
  const salesByDay = new Map<string, number>();
  if (recentDays.length) {
    const { data: rs } = await supabase
      .from("canteen_sale").select("day_id, total").eq("status", "confirmed").in("day_id", recentDays.map((d) => d.id));
    for (const r of (rs ?? []) as any[]) salesByDay.set(r.day_id, (salesByDay.get(r.day_id) ?? 0) + Number(r.total));
  }

  const isToday = target?.business_date === today;

  return (
    <>
      <header className="top">
        <h1>{isAdmin ? "Cash & day close" : "Close day"}</h1>
        {target && (
          <span className={`st ${target.status === "open" ? "paid" : "past"}`}>
            <span className="dot" />{dayLabel(target.business_date)} · {target.status === "open" ? "Open" : "Closed"}
          </span>
        )}
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {target && target.id !== staleOpen[0]?.id && <StaleDaysBanner days={staleOpen} />}
        {target?.status === "open" && <OfflineWarning />}

        {!target ? (
          <div className="panel sub" style={{ padding: 16 }}>
            Today hasn&apos;t been opened yet, so there&apos;s nothing to close. <Link href="/canteen/sell">Open today</Link> on the sell screen.
          </div>
        ) : target.status === "open" ? (
          <>
            {!isToday && (
              <div className="panel" style={{ padding: "10px 16px", borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
                <b style={{ color: "var(--ink)" }}>You are closing {dayLabel(target.business_date)}, not today.</b>{" "}
                <span className="sub">Count what was left and the cash as they were at the end of that day.</span>
              </div>
            )}
            <CloseDayForm
              dayId={target.id}
              dayName={dayLabel(target.business_date)}
              lines={left}
              openingFloat={Number(target.opening_float)}
              cashSales={{ count: cash.length, total: sum(cash) }}
              bkashSales={{ count: bkash.length, total: sum(bkash) }}
              showCost={isAdmin}
            />
          </>
        ) : (
          <div className="close-grid">
            <div className="panel">
              <div className="phead">
                <div className="ptitle">{dayLabel(target.business_date)} is closed</div>
                <div className="sub">Closed {fmtDateTime(target.closed_at)}</div>
              </div>
              <div style={{ padding: "8px 16px 16px" }}>
                <div className="sumrow"><span>Cash expected (float + cash sales)</span><b className="mono">{taka(target.cash_expected)}</b></div>
                <div className="sumrow"><span>Cash counted</span><b className="mono">{taka(target.cash_counted)}</b></div>
                <div className="sumrow">
                  <span>Difference</span>
                  <b className="mono">{diffText(Number(target.cash_counted) - Number(target.cash_expected))}</b>
                </div>
                <div className="sumrow"><span>bKash sales</span><b className="mono">{taka(target.bkash_expected)}</b></div>
                <div className="sumrow"><span>bKash in the app</span><b className="mono">{taka(target.bkash_reported)}</b></div>
                <div className="sumrow">
                  <span>Difference</span>
                  <b className="mono">{diffText(Number(target.bkash_reported) - Number(target.bkash_expected))}</b>
                </div>
                {target.close_note && <div className="sub" style={{ marginTop: 10 }}>Note: {target.close_note}</div>}
                {target.reopen_reason && <div className="sub" style={{ marginTop: 6 }}>Reopened earlier: {target.reopen_reason}</div>}
                {!isAdmin && (
                  <div className="sub" style={{ marginTop: 12 }}>A closed day is locked. If something needs fixing, ask admin to reopen it.</div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="phead"><div className="ptitle">Leftovers</div></div>
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Item</th><th className="n">Left</th><th className="n">Wasted</th><th className="n">Carried over</th></tr></thead>
                  <tbody>
                    {left.map((l) => (
                      <tr key={l.stock_id}>
                        <td>{l.name}</td>
                        <td className="n mono">{l.left}</td>
                        <td className="n mono">{l.wasted ?? "—"}</td>
                        <td className="n mono">{l.carry ?? "—"}</td>
                      </tr>
                    ))}
                    {left.length === 0 && <tr><td colSpan={4} className="sub">No counted stock that day.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {target && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Sales on {dayLabel(target.business_date)}</div>
              <div className="sub">{live.length} sales · {taka(sum(live))}</div>
            </div>
            <SalesList sales={sales} canVoid={target.status === "open" && (isToday || isAdmin)} />
          </div>
        )}

        {isAdmin && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Recent days</div>
              <div className="sub">Only admin can reopen a closed day</div>
            </div>
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>Day</th><th className="n">Sales</th><th>Cash</th><th>bKash</th><th>Note</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {recentDays.map((d) => {
                    const closed = d.status === "closed";
                    const cd = closed ? Number(d.cash_counted) - Number(d.cash_expected) : null;
                    const bd = closed ? Number(d.bkash_reported) - Number(d.bkash_expected) : null;
                    return (
                      <tr key={d.id} className={d.id === target?.id ? "crow-on" : undefined}>
                        <td><Link href={`/canteen/close?day=${d.id}`}>{dayLabel(d.business_date)}</Link></td>
                        <td className="n mono">{taka(salesByDay.get(d.id) ?? 0)}</td>
                        <td style={{ color: cd ? "var(--crit)" : undefined }}>{cd == null ? "Not counted" : diffText(cd)}</td>
                        <td style={{ color: bd ? "var(--crit)" : undefined }}>{bd == null ? "—" : diffText(bd)}</td>
                        <td className="sub" style={{ maxWidth: 240 }}>{d.close_note ?? ""}</td>
                        <td><span className={`st ${closed ? "past" : "paid"}`}><span className="dot" />{closed ? "Closed" : "Open"}</span></td>
                        <td className="n">{closed && <ReopenForm dayId={d.id} />}</td>
                      </tr>
                    );
                  })}
                  {recentDays.length === 0 && <tr><td colSpan={7} className="sub">No canteen days yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
