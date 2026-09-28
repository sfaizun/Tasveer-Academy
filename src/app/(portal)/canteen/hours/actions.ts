"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function revalidate() {
  revalidatePath("/canteen");
  revalidatePath("/canteen/hours");
}

/** Saves all seven days at once. A day that's open needs an opening time before its closing time. */
export async function saveHours(_prev: State, formData: FormData): Promise<State> {
  const rows: { weekday: number; is_open: boolean; opens_at: string | null; closes_at: string | null }[] = [];
  for (let d = 0; d < 7; d++) {
    const is_open = formData.get(`open_${d}`) === "on";
    const opens = String(formData.get(`opens_${d}`) ?? "").trim();
    const closes = String(formData.get(`closes_${d}`) ?? "").trim();
    if (is_open) {
      if (!TIME_RE.test(opens) || !TIME_RE.test(closes)) return { error: `Enter opening and closing times for ${DAY_NAMES[d]}.` };
      if (opens >= closes) return { error: `${DAY_NAMES[d]}: the closing time must be after the opening time.` };
    }
    rows.push({ weekday: d, is_open, opens_at: is_open ? opens : null, closes_at: is_open ? closes : null });
  }
  if (!rows.some((r) => r.is_open)) return { error: "Keep at least one day open." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("canteen_hours").select("weekday, is_open, opens_at, closes_at");
  const now = new Date().toISOString();
  for (const r of rows) {
    const c = (current ?? []).find((x) => x.weekday === r.weekday);
    const same =
      c &&
      c.is_open === r.is_open &&
      (c.opens_at ?? "").slice(0, 5) === (r.opens_at ?? "") &&
      (c.closes_at ?? "").slice(0, 5) === (r.closes_at ?? "");
    if (same) continue; // only changed days, so the audit log shows real changes
    const { error } = await supabase
      .from("canteen_hours")
      .update({ is_open: r.is_open, opens_at: r.opens_at, closes_at: r.closes_at, updated_at: now })
      .eq("weekday", r.weekday);
    if (error) return { error: `Could not save ${DAY_NAMES[r.weekday]}: ${error.message}` };
  }
  revalidate();
  return { ok: true };
}

export async function addClosure(_prev: State, formData: FormData): Promise<State> {
  const date_from = String(formData.get("date_from") ?? "").trim();
  const date_to = String(formData.get("date_to") ?? "").trim() || date_from;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!date_from) return { error: "Choose the first closed day." };
  if (date_to < date_from) return { error: "The last day can't be before the first day." };
  if (!reason) return { error: "Add a short reason, e.g. Holiday." };

  const supabase = await createClient();
  const { error } = await supabase.from("canteen_closure").insert({ date_from, date_to, reason });
  if (error) return { error: "Could not add the closure: " + error.message };
  revalidate();
  return { ok: true };
}

export async function removeClosure(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("canteen_closure").delete().eq("id", id);
  revalidate();
}
