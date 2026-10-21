"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { describeMatches, findDuplicates, toCandidates } from "@/lib/duplicates";

type State = { error?: string; ok?: boolean; studentId?: string; duplicate?: boolean } | null;

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
    // Same check as the warning on the page, repeated here so a duplicate can't slip
    // through: approving a possible duplicate needs the "different student" tick.
    if (formData.get("confirm_duplicate") !== "1") {
      const [{ data: app }, { data: students }, { data: openApps }] = await Promise.all([
        supabase.from("application").select("id, ref_no, status, payload").eq("id", id).maybeSingle(),
        supabase.from("student").select("id, reg_no, full_name, phone, email, status, application_id"),
        supabase.from("application").select("id, ref_no, status, payload").in("status", ["submitted", "under_review", "changes_requested"]),
      ]);
      if (app && app.status !== "approved") {
        const matches = findDuplicates(app, toCandidates((students ?? []) as any[], (openApps ?? []) as any[]));
        if (matches.length) {
          return {
            error: `Possible duplicate: ${describeMatches(matches)}. Check the records, then tick "This is a different student" to approve anyway.`,
            duplicate: true,
          };
        }
      }
    }
    // Approving also creates the student's ID card.
    if (formData.get("create_card") !== "1") {
      const { data: cur } = await supabase.from("application").select("status").eq("id", id).maybeSingle();
      if (cur?.status !== "approved") return { error: "Tick \"Create the student ID card\": an application is approved together with its ID card." };
    }
    const { data, error } = await supabase.rpc("fn_approve_application", {
      p_application_id: id,
      p_review_note: note || null,
    });
    if (error) return { error: "Could not approve the application: " + error.message };
    revalidatePath("/applications");
    revalidatePath("/students");
    revalidatePath("/id-cards");
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
