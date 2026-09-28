import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { requireCanteenAccess } from "../guard";
import MenuManager, { type PriceRow } from "./MenuManager";
import type { CanteenCategory, CanteenItem } from "@/lib/canteen";

export const dynamic = "force-dynamic";

export default async function CanteenMenuPage() {
  const { isAdmin } = await requireCanteenAccess();
  const supabase = await createClient();

  const [{ data: categories }, { data: items }, { data: prices }] = await Promise.all([
    supabase.from("canteen_category").select("id, name, sort, active").order("sort").order("name"),
    supabase
      .from("canteen_item_current")
      .select("id, category_id, name, description, photo_path, tags, is_packaged, batch_size, out_of_stock, archived, sell_price, cost_price, price_since")
      .order("name"),
    supabase
      .from("canteen_item_price")
      .select("item_id, sell_price, cost_price, effective_from")
      .order("effective_from", { ascending: false }),
  ]);

  const list = (items ?? []) as CanteenItem[];
  const live = list.filter((i) => !i.archived);
  const outCount = live.filter((i) => i.out_of_stock).length;

  return (
    <>
      <header className="top">
        <h1>Menu &amp; prices</h1>
        <div className="sub">
          {live.length} item{live.length === 1 ? "" : "s"} on the menu
          {outCount > 0 ? ` · ${outCount} out of stock` : ""}
        </div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content">
        <MenuManager
          categories={(categories ?? []) as CanteenCategory[]}
          items={list}
          prices={(prices ?? []) as PriceRow[]}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
