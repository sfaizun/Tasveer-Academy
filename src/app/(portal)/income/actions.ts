"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
type Supabase = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "income-attachments";

function readIncome(formData: FormData) {
  const income_date = String(formData.get("income_date") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Math.round(Number(amountRaw) * 100) / 100;
  const details = String(formData.get("details") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  if (category !== "registration" && category !== "other") return { error: "Choose the heading: Registration fees or Other income." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(income_date)) return { error: "Choose the date." };
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount above zero." };
  if (!details) return { error: "Enter the details of the income." };
  return { values: { income_date, amount, details, category } };
}

/** The file is uploaded straight from the browser; the form sends its storage path here. */
type Attachment = { attachment_path: string; attachment_name: string; attachment_type: string | null; attachment_size: number | null };

function readAttachment(formData: FormData): null | { error: string; values?: undefined } | { values: Attachment; error?: undefined } {
  const path = String(formData.get("attachment_path") ?? "").trim();
  if (!path) return null;
  if (!/^office\/\d{4}-\d{2}\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/.test(path)) return { error: "The attachment upload was not valid. Attach the file again." };
  const name = String(formData.get("attachment_name") ?? "").trim().slice(0, 200) || "attachment";
  const type = String(formData.get("attachment_type") ?? "").trim() || null;
  const size = Number(formData.get("attachment_size") ?? 0) || null;
  return { values: { attachment_path: path, attachment_name: name, attachment_type: type, attachment_size: size } };
}

async function removeFile(supabase: Supabase, path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error("income attachment remove failed:", error.message);
}

function refresh() {
  revalidatePath("/income");
}

export async function addIncome(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const a = readAttachment(formData);
  const r = readIncome(formData);
  if ("error" in r) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: r.error };
  }
  if (!a) return { error: "Attach the receipt or supporting file." };
  if (!a.values) return { error: a.error };
  const { data: me } = await supabase.rpc("my_app_user_id");
  const { error } = await supabase
    .from("office_income")
    .insert({ ...r.values, ...a.values, created_by: (me as string | null) ?? null });
  if (error) {
    await removeFile(supabase, a.values.attachment_path);
    return { error: "Could not save the income: " + error.message };
  }
  refresh();
  return { ok: true };
}

export async function updateIncome(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const a = readAttachment(formData);
  const r = readIncome(formData);
  if ("error" in r || a?.error) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: "error" in r ? r.error : a?.error };
  }
  // "Delete file" in the form only takes effect together with a new file.
  if (formData.get("attachment_removed") === "1" && !a) {
    return { error: "Choose the new file before saving. The old file stays until then." };
  }
  const { data: old } = await supabase.from("office_income").select("attachment_path").eq("id", id).maybeSingle();
  const { data, error } = await supabase
    .from("office_income")
    .update({ ...r.values, ...(a?.values ?? {}), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: error ? "Could not save the income: " + error.message : "Only admin can change income." };
  }
  if (a?.values && old?.attachment_path && old.attachment_path !== a.values.attachment_path) {
    await removeFile(supabase, old.attachment_path);
  }
  refresh();
  return { ok: true };
}

export async function removeIncome(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data, error } = await supabase.from("office_income").delete().eq("id", id).select("attachment_path");
  if (error) throw new Error(error.message);
  if (data && data.length > 0) await removeFile(supabase, data[0].attachment_path);
  refresh();
}
