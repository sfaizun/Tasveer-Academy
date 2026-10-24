"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const tidy = (msg: string) => {
  const m = msg.trim().replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1) + ".";
};
const refresh = () => { revalidatePath("/holidays"); revalidatePath("/attendance"); revalidatePath("/dashboard"); revalidatePath("/roster"); };

/** Add a holiday, or change one (id given). One day: leave "Last day" empty. */
export async function saveHoliday(_prev: State, f: FormData): Promise<State> {
  const id = String(f.get("id") ?? "");
  const name = String(f.get("name") ?? "").trim();
  const kind = String(f.get("kind") ?? "");
  const start = String(f.get("start_date") ?? "");
  const end = String(f.get("end_date") ?? "") || start;
  const note = String(f.get("note") ?? "").trim();
  if (!name) return { error: "Enter the holiday name." };
  if (!kind) return { error: "Choose the type of holiday." };
  if (!isDate(start)) return { error: "Choose the first day." };
  if (!isDate(end)) return { error: "Choose the last day." };
  if (end < start) return { error: "The last day can't be before the first day." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_save_holiday", {
    p_id: /^[0-9a-f-]{36}$/.test(id) ? id : null, p_name: name, p_kind: kind, p_start: start, p_end: end, p_note: note || null,
  });
  if (error) return { error: tidy(error.message) };
  refresh();
  return { ok: true };
}

export async function removeHoliday(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_remove_holiday", { p_id: id });
  if (error) throw new Error(error.message);
  refresh();
}
