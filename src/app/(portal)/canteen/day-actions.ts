"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { niceError } from "@/lib/canteen";

// Every write in the daily cycle goes through a database function, which checks the
// caller is the canteen manager or admin, locks what it needs and writes the audit log.
// These actions just pass the figures through and turn errors into readable sentences.

export type ActionResult = { ok?: boolean; error?: string };
type State = ActionResult | null;

function refresh() {
  for (const p of ["/canteen", "/canteen/sell", "/canteen/stock", "/canteen/close", "/canteen/requests"]) revalidatePath(p);
}

function num(raw: FormDataEntryValue | null): number | null | "bad" {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "bad";
  return n;
}

/* ---------------- Opening the day ---------------- */

export async function openDay(_prev: State, formData: FormData): Promise<State> {
  const float = num(formData.get("opening_float"));
  if (float === "bad") return { error: "Enter the opening cash as a number, or 0." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_open_day", { p_opening_float: float ?? 0 });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

/* ---------------- Selling ---------------- */

export type SaleInput = {
  lines: { item_id: string; qty: number }[];
  method: "cash" | "bkash";
  cashReceived: number | null;
  bkashRef: string | null;
};
export type SaleResult = { ok: true; receipt: string; total: number; change: number } | { ok: false; error: string };

export async function recordSale(input: SaleInput): Promise<SaleResult> {
  const lines = (input.lines ?? []).filter((l) => l.item_id && Number.isInteger(l.qty) && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Add at least one item to the sale." };
  if (input.method !== "cash" && input.method !== "bkash") return { ok: false, error: "Choose Cash or bKash." };
  if (input.cashReceived != null && (!Number.isFinite(input.cashReceived) || input.cashReceived < 0)) {
    return { ok: false, error: "Enter the cash received as a number." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_canteen_record_sale", {
    p_lines: lines,
    p_method: input.method,
    p_cash_received: input.method === "cash" ? input.cashReceived : null,
    p_bkash_ref: input.method === "bkash" ? input.bkashRef?.trim() || null : null,
  });
  if (error) return { ok: false, error: niceError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  refresh();
  return { ok: true, receipt: row.receipt_no, total: Number(row.total), change: Number(row.change_due ?? 0) };
}

export async function voidSale(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("sale_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return { error: "Sale not found." };
  if (!reason) return { error: "Give a reason for voiding this sale." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_void_sale", { p_sale_id: id, p_reason: reason });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

/* ---------------- Stock ---------------- */

export async function saveStock(_prev: State, formData: FormData): Promise<State> {
  const ids = formData.getAll("item_id").map(String);
  const lines: { item_id: string; prepared_qty: number; unit_cost: number | null }[] = [];
  for (const id of ids) {
    const qty = num(formData.get(`qty_${id}`));
    const cost = num(formData.get(`cost_${id}`));
    if (qty === "bad" || (qty != null && !Number.isInteger(qty))) return { error: "Quantities must be whole numbers, 0 or more." };
    if (cost === "bad") return { error: "Costs must be numbers, 0 or more." };
    lines.push({ item_id: id, prepared_qty: qty ?? 0, unit_cost: cost });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_save_stock", { p_lines: lines });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

export async function restock(_prev: State, formData: FormData): Promise<State> {
  const itemId = String(formData.get("item_id") ?? "");
  const qty = num(formData.get("qty"));
  const cost = num(formData.get("unit_cost"));
  if (!itemId) return { error: "Choose the item you're adding more of." };
  if (qty === null || qty === "bad" || !Number.isInteger(qty) || qty < 1) return { error: "Enter how many were added (1 or more)." };
  if (cost === "bad") return { error: "Enter a valid cost each, or leave it blank." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_restock", { p_item_id: itemId, p_qty: qty, p_unit_cost: cost });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

/* ---------------- Closing ---------------- */

export async function closeDay(_prev: State, formData: FormData): Promise<State> {
  const dayId = String(formData.get("day_id") ?? "");
  const cash = num(formData.get("cash_counted"));
  const bkash = num(formData.get("bkash_reported"));
  const note = String(formData.get("note") ?? "").trim();
  if (!dayId) return { error: "Day not found." };
  if (cash === null || cash === "bad") return { error: "Enter the cash counted in the drawer." };
  if (bkash === null || bkash === "bad") return { error: "Enter the bKash total from the bKash app (0 if none)." };

  const wasted: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("waste_")) continue;
    const n = num(v);
    if (n === "bad" || (n != null && !Number.isInteger(n))) return { error: "Wasted quantities must be whole numbers." };
    wasted[k.slice(6)] = n ?? 0;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_close_day", {
    p_day_id: dayId, p_wasted: wasted, p_cash_counted: cash, p_bkash_reported: bkash, p_note: note || null,
  });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

export async function reopenDay(_prev: State, formData: FormData): Promise<State> {
  const dayId = String(formData.get("day_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for reopening this day." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_reopen_day", { p_day_id: dayId, p_reason: reason });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

/* ---------------- Requests ---------------- */

export async function logRequest(_prev: State, formData: FormData): Promise<State> {
  const requestId = String(formData.get("request_id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;
  const whoRaw = String(formData.get("who") ?? "").trim();
  const who = ["student", "teacher", "other"].includes(whoRaw) ? whoRaw : null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!requestId && !name) return { error: "Type what was asked for." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_log_request", {
    p_request_id: requestId, p_name: name, p_who: who, p_note: note,
  });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

/** One-click +1 on an existing request (form action, no state). */
export async function plusOneRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return;
  const supabase = await createClient();
  await supabase.rpc("fn_canteen_log_request", { p_request_id: requestId, p_name: null, p_who: null, p_note: null });
  refresh();
}

export async function logSoldOutAsk(itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_canteen_log_soldout_ask", { p_item_id: itemId });
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}

export async function setRequestStatus(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const itemId = String(formData.get("item_id") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!["new", "considering", "added", "declined"].includes(status)) return { error: "Choose a status." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("canteen_request")
    .update({ status, item_id: status === "added" ? itemId : null, note, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: niceError(error.message) };
  refresh();
  return { ok: true };
}
