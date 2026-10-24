"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string; message?: string } | null;
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const tidy = (msg: string) => {
  const m = msg.trim().replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1) + ".";
};
const refresh = () => { revalidatePath("/income"); revalidatePath("/reports"); };

/** A teacher's service charge setting: none, a fixed monthly amount, or a % of their fee collection. */
export async function setServiceRule(_prev: State, f: FormData): Promise<State> {
  const teacher = String(f.get("teacher_id") ?? "");
  const kind = String(f.get("kind") ?? "none");
  const value = Number(String(f.get("value") ?? "").replace(/[,\s৳%]/g, ""));
  if (!isId(teacher)) return { error: "Missing teacher." };
  if (kind !== "none" && (!Number.isFinite(value) || value < 0)) return { error: "Enter the amount or percentage." };
  if (kind === "percent" && value > 100) return { error: "A percentage can't be more than 100." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_service_charge_rule", { p_teacher_id: teacher, p_kind: kind, p_value: kind === "none" ? null : value });
  if (error) return { error: tidy(error.message) };
  refresh();
  return { ok: true };
}

/** Charge (or charge again) the month's service charges from the current settings. */
export async function chargeServiceCharges(_prev: State, f: FormData): Promise<State> {
  const month = String(f.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose the month." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_charge_service_charges", { p_month: `${month}-01` });
  if (error) return { error: tidy(error.message) };
  refresh();
  return { ok: true, message: `${data ?? 0} teacher${data === 1 ? "" : "s"} charged.` };
}

export async function removeServiceCharge(_prev: State, f: FormData): Promise<State> {
  const id = String(f.get("id") ?? "");
  const reason = String(f.get("reason") ?? "").trim();
  if (!isId(id)) return { error: "Missing charge." };
  if (!reason) return { error: "Give a reason." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_remove_service_charge", { p_id: id, p_reason: reason });
  if (error) return { error: tidy(error.message) };
  refresh();
  return { ok: true };
}
