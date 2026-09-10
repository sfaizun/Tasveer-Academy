"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean; studentId?: string } | null;

const VALID_STATUSES = ["submitted", "under_review", "changes_requested", "approved", "rejected"];

export async function setApplicationStatus(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id) return { error: "Missing application." };
  if (!VALID_STATUSES.includes(status)) return { error: "Choose a valid status." };

  const supabase = await createClient();

  // Approving is a bigger step than the other statuses: it also has to create the
  // student, guardian, sibling and enrolment records plus the first invoice (the
  // admission-to-enrolment hand-off), so it goes through its own database function
  // rather than a plain column update. That function is idempotent — re-approving
  // an already-approved application just restamps the note, it never duplicates
  // the student.
  if (status === "approved") {
    const { data, error } = await supabase.rpc("fn_approve_application", {
      p_application_id: id,
      p_review_note: note || null,
    });
    if (error) return { error: "Could not approve the application — " + error.message };
    revalidatePath("/applications");
    revalidatePath("/students");
    return { ok: true, studentId: data as string };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reviewerId: string | null = null;
  if (user) {
    const { data: me } = await supabase.from("app_user").select("id").eq("auth_id", user.id).maybeSingle();
    reviewerId = me?.id ?? null;
  }

  const { error } = await supabase
    .from("application")
    .update({
      status,
      review_note: note || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "Could not update the application — " + error.message };

  revalidatePath("/applications");
  return { ok: true };
}
