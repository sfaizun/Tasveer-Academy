"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean; created?: number; skipped?: number } | null;

export async function runBilling(_prev: State, formData: FormData): Promise<State> {
  const month = String(formData.get("month") ?? "").trim();
  if (!month) return { error: "Choose a billing month." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_run_billing", { p_month: `${month}-01` });

  if (error) return { error: "Could not run billing — " + error.message };

  const row = Array.isArray(data) ? data[0] : data;

  revalidatePath("/billing");
  revalidatePath("/students");
  return { ok: true, created: row?.created_count ?? 0, skipped: row?.skipped_count ?? 0 };
}
