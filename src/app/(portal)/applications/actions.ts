"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

const VALID_STATUSES = ["submitted", "under_review", "changes_requested", "approved", "rejected"];

export async function setApplicationStatus(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id) return { error: "Missing application." };
  if (!VALID_STATUSES.includes(status)) return { error: "Choose a valid status." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("application")
    .update({
      status,
      review_note: note || null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "Could not update the application — " + error.message };

  revalidatePath("/applications");
  return { ok: true };
}
