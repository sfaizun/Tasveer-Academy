import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtDate } from "@/lib/format";

/** An academy holiday: no classes and no attendance on any day from start_date to end_date. */
export type Holiday = { id: string; name: string; kind: string; start_date: string; end_date: string; note: string | null };

export const HOLIDAY_KINDS: { value: string; label: string }[] = [
  { value: "government", label: "Government holiday" },
  { value: "eid", label: "Eid / festival" },
  { value: "summer", label: "Summer vacation" },
  { value: "winter", label: "Winter vacation" },
  { value: "other", label: "Other" },
];
export const kindLabel = (k: string) => HOLIDAY_KINDS.find((x) => x.value === k)?.label ?? "Holiday";

/** Holidays overlapping the dates from..to (ISO dates), earliest first. */
export async function loadHolidays(supabase: SupabaseClient, from: string, to: string) {
  const { data } = await supabase.from("holiday").select("id, name, kind, start_date, end_date, note")
    .lte("start_date", to).gte("end_date", from).order("start_date");
  return (data ?? []) as Holiday[];
}

export const holidayOn = (list: Holiday[], date: string) => list.find((h) => h.start_date <= date && date <= h.end_date) ?? null;

/** Number of days in a holiday, counting both ends. */
export function holidayDays(h: Pick<Holiday, "start_date" | "end_date">) {
  return Math.round((Date.parse(h.end_date + "T00:00:00Z") - Date.parse(h.start_date + "T00:00:00Z")) / 86400000) + 1;
}

/** "25-OCT-2026" or "25-OCT-2026 to 31-OCT-2026 (7 days)" */
export function holidayDates(h: Pick<Holiday, "start_date" | "end_date">) {
  if (h.start_date === h.end_date) return fmtDate(h.start_date);
  return `${fmtDate(h.start_date)} to ${fmtDate(h.end_date)} (${holidayDays(h)} days)`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
