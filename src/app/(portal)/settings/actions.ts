"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

export async function addFeeRate(_prev: State, formData: FormData): Promise<State> {
  const target = String(formData.get("target") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const effective_from = String(formData.get("effective_from") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const [kind, programme_id, level, class_level_id] = target.split("|");
  if (!kind || !programme_id) return { error: "Choose which rate this is for." };

  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount < 0) return { error: "Enter a valid amount." };
  if (!effective_from) return { error: "Choose an effective-from date." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("fee_rate").insert({
    kind,
    programme_id,
    level: level || null,
    class_level_id: class_level_id || null,
    amount,
    effective_from,
    note: note || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "Could not save the rate — " + error.message };

  revalidatePath("/settings");
  revalidatePath("/apply");
  return { ok: true };
}
