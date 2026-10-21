"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

export async function addFeeRate(_prev: State, formData: FormData): Promise<State> {
  const target = String(formData.get("target") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const effective_from = String(formData.get("effective_from") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const [kind, programme_id, level, class_level_id, subject_id] = target.split("|");
  // programme_id can be blank: the mock exam fee is global (same rate for O and A Level).
  if (!kind) return { error: "Choose which rate this is for." };

  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount < 0) return { error: "Enter a valid amount." };
  if (!effective_from) return { error: "Choose an effective-from date." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("fee_rate").insert({
    kind,
    programme_id: programme_id || null,
    level: level || null,
    class_level_id: class_level_id || null,
    subject_id: subject_id || null,
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

/** Links printed as QR codes on the back of student ID cards. */
export async function saveIdCardLinks(_prev: { ok?: boolean; error?: string } | null, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_id_card_links", { p_portal: get("portal_url"), p_facebook: get("facebook_url"), p_instagram: get("instagram_url") });
  if (error) return { error: error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
  revalidatePath("/settings");
  return { ok: true };
}
