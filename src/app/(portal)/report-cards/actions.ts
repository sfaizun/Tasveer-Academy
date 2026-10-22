"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string; message?: string } | null;
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const isMonth = (s: string) => /^\d{4}-\d{2}$/.test(s);
const tidy = (msg: string) => {
  const m = msg.trim().replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1) + ".";
};
const done = () => revalidatePath("/report-cards");

/** Generate (or top up) a month's report cards, for everyone or one batch. */
export async function generateReportCards(_prev: State, f: FormData): Promise<State> {
  const month = String(f.get("month") ?? "");
  const batch = String(f.get("batch") ?? "");
  if (!isMonth(month)) return { error: "Choose the month." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_generate_report_cards", { p_month: `${month}-01`, p_class_group_id: isId(batch) ? batch : null });
  if (error) return { error: tidy(error.message) };
  const r = (data ?? {}) as { students?: number; new_cards?: number };
  done();
  return {
    ok: true,
    message: r.new_cards
      ? `${r.new_cards} new report card${r.new_cards === 1 ? "" : "s"} made (${r.students} student${r.students === 1 ? "" : "s"}).`
      : `Report cards are up to date (${r.students} student${r.students === 1 ? "" : "s"}).`,
  };
}

/** A teacher's comments (up to 2 from the list, plus an optional note) for one subject on one card. */
export async function saveRcComments(_prev: State, f: FormData): Promise<State> {
  const id = String(f.get("id") ?? "");
  if (!isId(id)) return { error: "Missing report card." };
  const ids = [String(f.get("c1") ?? ""), String(f.get("c2") ?? "")].filter(isId);
  if (new Set(ids).size !== ids.length) return { error: "Choose two different comments." };
  const text = String(f.get("text") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_save_report_comments", { p_id: id, p_comment_ids: ids, p_text: text || null });
  if (error) return { error: tidy(error.message) };
  done();
  return { ok: true };
}

/** How many homework/assignments the batch was set in the month. */
export async function setHomeworkCount(_prev: State, f: FormData): Promise<State> {
  const batch = String(f.get("batch") ?? "");
  const month = String(f.get("month") ?? "");
  const n = Number(f.get("count"));
  if (!isId(batch)) return { error: "Missing batch." };
  if (!isMonth(month)) return { error: "Missing month." };
  if (!Number.isInteger(n) || n < 0 || n > 100) return { error: "Enter a whole number from 0 to 100." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_homework_set", { p_class_group_id: batch, p_month: `${month}-01`, p_count: n });
  if (error) return { error: tidy(error.message) };
  done();
  return { ok: true };
}

/** Office: add a comment to the list, or edit / retire one. */
export async function saveCommentOption(_prev: State, f: FormData): Promise<State> {
  const id = String(f.get("id") ?? "");
  const text = String(f.get("text") ?? "").trim();
  const category = String(f.get("category") ?? "");
  const active = String(f.get("active") ?? "1") === "1";
  if (!text) return { error: "Enter the comment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_save_report_comment_option", {
    p_id: isId(id) ? id : null, p_text: text, p_category: category, p_active: active,
  });
  if (error) return { error: tidy(error.message) };
  done();
  return { ok: true };
}
