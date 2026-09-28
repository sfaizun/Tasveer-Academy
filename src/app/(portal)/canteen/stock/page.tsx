import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { requireCanteenAccess } from "../guard";
import { loadDays } from "../data";
import { OpenDayBox, StaleDaysBanner } from "../DayBits";
import StockEditor, { type StockLine } from "./StockEditor";
import { STOCK_COLS, dayLabel, type StockRow } from "@/lib/canteen";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireCanteenAccess();
  const supabase = await createClient();
  const { today, day, staleOpen } = await loadDays(supabase);

  const header = (
    <header className="top">
      <h1>Today&apos;s stock</h1>
      {day && (
        <span className={`st ${day.status === "open" ? "paid" : "past"}`}>
          <span className="dot" />{dayLabel(day.business_date)} · {day.status === "open" ? "Day open" : "Day closed"}
        </span>
      )}
      <div className="spacer" />
      {day?.status === "open" && <Link className="btn ghost" href="/canteen/close" style={{ fontSize: 12, padding: "6px 10px" }}>Close day</Link>}
      <ThemeToggle />
    </header>
  );

  if (!day) {
    const { data: last } = await supabase.from("canteen_day").select("opening_float").order("business_date", { ascending: false }).limit(1).maybeSingle();
    return (
      <>
        {header}
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StaleDaysBanner days={staleOpen} />
          <OpenDayBox today={today} lastFloat={last?.opening_float != null ? Number(last.opening_float) : null} />
        </div>
      </>
    );
  }

  const [{ data: items }, { data: stock }, { data: prevDay }, { data: madeToOrder }, { data: planRows }] = await Promise.all([
    supabase
      .from("canteen_item_current")
      .select("id, name, category_id, track_stock, is_packaged, cost_price, out_of_stock, archived")
      .order("name"),
    supabase.from("canteen_stock_view").select(STOCK_COLS).eq("day_id", day.id),
    supabase.from("canteen_day").select("id, business_date").eq("status", "closed").lt("business_date", day.business_date)
      .order("business_date", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("canteen_sale_line")
      .select("item_id, qty, canteen_sale!inner(day_id, status)")
      .eq("canteen_sale.day_id", day.id)
      .eq("canteen_sale.status", "confirmed"),
    supabase.from("canteen_plan").select("item_id, accepted_qty").eq("plan_date", day.business_date),
  ]);
  const planBy = new Map(((planRows ?? []) as any[]).map((p) => [p.item_id, p.accepted_qty as number]));

  const { data: prevStock } = prevDay
    ? await supabase.from("canteen_stock_view").select(STOCK_COLS).eq("day_id", prevDay.id)
    : { data: [] };

  const stockBy = new Map(((stock ?? []) as StockRow[]).map((s) => [s.item_id, s]));
  const prevBy = new Map(((prevStock ?? []) as StockRow[]).map((s) => [s.item_id, s]));
  const all = (items ?? []) as any[];

  // Tracked items still on the menu, plus any archived item that already has stock today.
  const lines: StockLine[] = all
    .filter((i) => i.track_stock && (!i.archived || stockBy.has(i.id)))
    .map((i) => {
      const s = stockBy.get(i.id);
      const p = prevBy.get(i.id);
      return {
        item_id: i.id,
        name: i.name,
        is_packaged: i.is_packaged,
        out_of_stock: i.out_of_stock,
        carried_in: s?.carried_in ?? 0,
        prepared_qty: s?.prepared_qty ?? 0,
        restock_qty: s?.restock_qty ?? 0,
        unit_cost: s?.unit_cost != null ? Number(s.unit_cost) : i.cost_price != null ? Number(i.cost_price) : null,
        sold_qty: s?.sold_qty ?? 0,
        sold_out_at: s?.sold_out_at ?? null,
        prev: p ? { made: p.prepared_qty + p.restock_qty, sold: p.sold_qty } : null,
        planQty: planBy.get(i.id) ?? null,
      };
    });

  const mtoSold = new Map<string, number>();
  for (const l of (madeToOrder ?? []) as any[]) mtoSold.set(l.item_id, (mtoSold.get(l.item_id) ?? 0) + l.qty);
  const mto = all
    .filter((i) => !i.track_stock && (!i.archived || mtoSold.has(i.id)))
    .map((i) => ({ name: i.name as string, sold: mtoSold.get(i.id) ?? 0 }));

  return (
    <>
      {header}
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <StaleDaysBanner days={staleOpen} />
        <StockEditor
          lines={lines}
          madeToOrder={mto}
          readOnly={day.status === "closed"}
          prevLabel={prevDay ? dayLabel(prevDay.business_date) : null}
        />
      </div>
    </>
  );
}
