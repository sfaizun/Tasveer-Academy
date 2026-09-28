import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { taka } from "@/lib/format";
import { requireCanteenAccess } from "../guard";
import { loadDays, loadSales } from "../data";
import { OpenDayBox, SalesList, StaleDaysBanner } from "../DayBits";
import SellScreen, { type SellItem } from "./SellScreen";
import {
  STOCK_COLS, canteenStatus, dayLabel, statusLabel,
  type CanteenCategory, type CanteenClosureRow, type CanteenHoursRow, type StockRow,
} from "@/lib/canteen";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  await requireCanteenAccess();
  const supabase = await createClient();
  const { today, day, staleOpen } = await loadDays(supabase);

  const [{ data: categories }, { data: items }, { data: hours }, { data: closures }, { data: stock }, { data: requests }, { data: lastDay }] =
    await Promise.all([
      supabase.from("canteen_category").select("id, name, sort, active").eq("active", true).order("sort").order("name"),
      supabase
        .from("canteen_item_current")
        .select("id, category_id, name, photo_path, out_of_stock, sell_price, track_stock")
        .eq("archived", false)
        .order("name"),
      supabase.from("canteen_hours").select("weekday, is_open, opens_at, closes_at"),
      supabase.from("canteen_closure").select("id, date_from, date_to, reason").lte("date_from", today).gte("date_to", today),
      day ? supabase.from("canteen_stock_view").select(STOCK_COLS).eq("day_id", day.id) : Promise.resolve({ data: [] }),
      supabase.from("canteen_request").select("id, name").in("status", ["new", "considering"]).order("updated_at", { ascending: false }).limit(8),
      day ? Promise.resolve({ data: null }) : supabase.from("canteen_day").select("opening_float").order("business_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const status = canteenStatus((hours ?? []) as CanteenHoursRow[], (closures ?? []) as CanteenClosureRow[]);
  const label = statusLabel(status);
  const sales = day ? await loadSales(supabase, day.id) : [];
  const live = sales.filter((s) => s.status === "confirmed");

  const stockBy = new Map(((stock ?? []) as StockRow[]).map((s) => [s.item_id, s]));
  const sellItems: SellItem[] = (items ?? []).map((i: any) => {
    const s = stockBy.get(i.id);
    return {
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      photo_path: i.photo_path,
      price: i.sell_price == null ? null : Number(i.sell_price),
      out_of_stock: i.out_of_stock,
      track_stock: i.track_stock,
      available: s ? s.available : 0,
      stocked: s ? s.carried_in + s.prepared_qty + s.restock_qty > 0 : false,
      sold_out_at: s?.sold_out_at ?? null,
    };
  });

  return (
    <>
      <header className="top">
        <h1>Sell</h1>
        <span className={`st ${label.cls}`}><span className="dot" />{label.text}</span>
        {day && (
          <span className={`st ${day.status === "open" ? "paid" : "past"}`}>
            <span className="dot" />{dayLabel(day.business_date)} · {day.status === "open" ? "Day open" : "Day closed"}
          </span>
        )}
        <div className="spacer" />
        {day && (
          <span className="sub">
            Today {live.length} sale{live.length === 1 ? "" : "s"} · {taka(live.reduce((a, s) => a + s.total, 0))}
          </span>
        )}
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <StaleDaysBanner days={staleOpen} />

        {!day ? (
          <OpenDayBox today={today} lastFloat={lastDay?.opening_float != null ? Number(lastDay.opening_float) : null} />
        ) : day.status === "closed" ? (
          <div className="panel" style={{ padding: 16 }}>
            <b style={{ color: "var(--ink)" }}>Today has been closed.</b>{" "}
            <span className="sub">
              No more sales can be recorded for {dayLabel(day.business_date)}. If a sale was missed, admin can reopen the day
              from <Link href="/canteen/close">Close day</Link>.
            </span>
          </div>
        ) : (
          <>
            {status.state !== "open" && (
              <div className="panel" style={{ padding: "10px 16px", borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
                <b style={{ color: "var(--ink)" }}>Outside opening hours ({label.text.toLowerCase()}).</b>{" "}
                <span className="sub">You can still sell; this is just a reminder.</span>
              </div>
            )}
            <SellScreen
              items={sellItems}
              categories={(categories ?? []) as CanteenCategory[]}
              requests={(requests ?? []) as { id: string; name: string }[]}
            />
          </>
        )}

        {day && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Today&apos;s sales</div>
              <div className="sub">
                Cash {taka(live.filter((s) => s.payment_method === "cash").reduce((a, s) => a + s.total, 0))} · bKash{" "}
                {taka(live.filter((s) => s.payment_method === "bkash").reduce((a, s) => a + s.total, 0))}
              </div>
            </div>
            <SalesList sales={sales} canVoid={day.status === "open"} />
          </div>
        )}
      </div>
    </>
  );
}
