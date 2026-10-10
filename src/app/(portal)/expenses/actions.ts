"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;

function readExpense(formData: FormData) {
  const expense_for = String(formData.get("expense_for") ?? "");
  const teacher_id = String(formData.get("teacher_id") ?? "").trim() || null;
  const expense_date = String(formData.get("expense_date") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Math.round(Number(amountRaw) * 100) / 100;
  const details = String(formData.get("details") ?? "").trim();

  if (expense_for !== "teacher" && expense_for !== "office") return { error: "Choose Teacher or Office." };
  if (expense_for === "teacher" && !teacher_id) return { error: "Choose the teacher." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) return { error: "Choose the date." };
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount above zero." };
  if (!details) return { error: "Enter the details of the expense." };
  return {
    values: { expense_for, teacher_id: expense_for === "teacher" ? teacher_id : null, expense_date, amount, details },
  };
}

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

export async function addExpense(_prev: State, formData: FormData): Promise<State> {
  const r = readExpense(formData);
  if ("error" in r) return { error: r.error };
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_app_user_id");
  const { error } = await supabase.from("expense").insert({ ...r.values, created_by: (me as string | null) ?? null });
  if (error) return { error: "Could not save the expense: " + error.message };
  refresh();
  return { ok: true };
}

export async function updateExpense(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const r = readExpense(formData);
  if ("error" in r) return { error: r.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense")
    .update({ ...r.values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Could not save the expense: " + error.message };
  if (!data || data.length === 0) return { error: "Only admin can change expenses." };
  refresh();
  return { ok: true };
}

export async function removeExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("expense").delete().eq("id", id);
  refresh();
}
