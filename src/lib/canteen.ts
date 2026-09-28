import { SUPABASE_URL } from "@/lib/supabase/config";

export const CANTEEN_BUCKET = "canteen-item-images";

// 0 = Sunday, matching canteen_hours.weekday and class_slot.weekday.
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// The academy's week starts on Saturday, so hours are listed Saturday first.
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export type CanteenHoursRow = { weekday: number; is_open: boolean; opens_at: string | null; closes_at: string | null };
export type CanteenClosureRow = { id: string; date_from: string; date_to: string; reason: string };

export type CanteenItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  photo_path: string | null;
  tags: string[];
  is_packaged: boolean;
  batch_size: number;
  out_of_stock: boolean;
  archived: boolean;
  sell_price: number | null;
  cost_price: number | null;
  price_since: string | null;
};

export type CanteenCategory = { id: string; name: string; sort: number; active: boolean };

/** Public address of an item photo (the bucket is public-read; only canteen staff can write). */
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${CANTEEN_BUCKET}/${path}`;
}

/** "11:00:00" -> "11:00" */
export function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

/** Today's date, weekday and time in Dhaka, whatever timezone the server runs in. */
export function dhakaNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday, time: `${hour}:${get("minute")}` };
}

export type CanteenStatus =
  | { state: "closure"; reason: string }
  | { state: "closed_day" }
  | { state: "before"; opens: string; closes: string }
  | { state: "open"; opens: string; closes: string }
  | { state: "after"; opens: string; closes: string };

/** Is the canteen open right now, going by the weekly hours and any one-off closure? */
export function canteenStatus(hours: CanteenHoursRow[], closures: CanteenClosureRow[]): CanteenStatus {
  const now = dhakaNow();
  const closure = closures.find((c) => c.date_from <= now.date && c.date_to >= now.date);
  if (closure) return { state: "closure", reason: closure.reason };
  const day = hours.find((h) => h.weekday === now.weekday);
  if (!day || !day.is_open || !day.opens_at || !day.closes_at) return { state: "closed_day" };
  const opens = hhmm(day.opens_at);
  const closes = hhmm(day.closes_at);
  if (now.time < opens) return { state: "before", opens, closes };
  if (now.time >= closes) return { state: "after", opens, closes };
  return { state: "open", opens, closes };
}

export function statusLabel(s: CanteenStatus): { text: string; cls: string } {
  switch (s.state) {
    case "closure": return { text: `Closed today: ${s.reason}`, cls: "past" };
    case "closed_day": return { text: "Closed today", cls: "due" };
    case "before": return { text: `Opens at ${s.opens}`, cls: "due" };
    case "open": return { text: `Open until ${s.closes}`, cls: "paid" };
    case "after": return { text: `Closed at ${s.closes}`, cls: "due" };
  }
}
