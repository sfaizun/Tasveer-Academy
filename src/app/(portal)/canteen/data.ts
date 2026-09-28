import type { createClient } from "@/lib/supabase/server";
import { DAY_COLS, dhakaNow, type CanteenDay } from "@/lib/canteen";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Today's business day (if opened) and any earlier day that was opened but never closed. */
export async function loadDays(supabase: Supabase) {
  const today = dhakaNow().date;
  const [{ data: todayRow }, { data: stale }] = await Promise.all([
    supabase.from("canteen_day").select(DAY_COLS).eq("business_date", today).maybeSingle(),
    supabase.from("canteen_day").select(DAY_COLS).eq("status", "open").lt("business_date", today).order("business_date"),
  ]);
  return {
    today,
    day: (todayRow ?? null) as CanteenDay | null,
    staleOpen: (stale ?? []) as CanteenDay[],
  };
}

/** A day's sales, newest first, with a short list of what was in each. */
export async function loadSales(supabase: Supabase, dayId: string) {
  const { data } = await supabase
    .from("canteen_sale")
    .select("id, receipt_no, sold_at, payment_method, bkash_ref, total, status, void_reason, canteen_sale_line(qty, canteen_item(name))")
    .eq("day_id", dayId)
    .order("sold_at", { ascending: false });
  return (data ?? []).map((s: any) => ({
    id: s.id,
    receipt_no: s.receipt_no,
    sold_at: s.sold_at,
    payment_method: s.payment_method,
    bkash_ref: s.bkash_ref,
    total: Number(s.total),
    status: s.status,
    void_reason: s.void_reason,
    lines: (s.canteen_sale_line ?? []).map((l: any) => ({ qty: l.qty, name: l.canteen_item?.name ?? "Item" })),
  }));
}
