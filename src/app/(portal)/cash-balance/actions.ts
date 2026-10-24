"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const tidy = (msg: string) => {
  const m = msg.trim().replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1) + ".";
};
const money = (raw: FormDataEntryValue | null) => {
  const t = String(raw ?? "").replace(/[,\s৳]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

/** The day the cash book starts and the cash in hand that morning. */
export async function setCashStart(_prev: State, f: FormData): Promise<State> {
  const date = String(f.get("start_date") ?? "");
  const amount = money(f.get("opening_balance"));
  if (!isDate(date)) return { error: "Choose the start date." };
  if (amount === null || Number.isNaN(amount) || amount < 0) return { error: "Enter the cash in hand on that morning (0 or more)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_cash_start", { p_date: date, p_amount: amount });
  if (error) return { error: tidy(error.message) };
  revalidatePath("/cash-balance");
  return { ok: true };
}

/** The cash actually counted at the end of a day (empty clears it). */
export async function saveCashCount(_prev: State, f: FormData): Promise<State> {
  const date = String(f.get("date") ?? "");
  const amount = money(f.get("counted"));
  if (!isDate(date)) return { error: "Missing day." };
  if (amount !== null && (Number.isNaN(amount) || amount < 0)) return { error: "Enter the counted cash (0 or more)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_save_cash_count", { p_date: date, p_counted: amount, p_note: String(f.get("note") ?? "").trim() || null });
  if (error) return { error: tidy(error.message) };
  revalidatePath("/cash-balance");
  return { ok: true };
}
