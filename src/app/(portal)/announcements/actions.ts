"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

async function myAppUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("app_user").select("id").eq("auth_id", user.id).maybeSingle();
  return data?.id ?? null;
}

function toIso(local: string) {
  // <input type="datetime-local"> gives "YYYY-MM-DDTHH:MM" with no timezone — treat it
  // as Asia/Dhaka, the academy's own timezone, rather than the server's.
  if (!local) return null;
  return new Date(local + ":00+06:00").toISOString();
}

/** Admin: create and publish an announcement immediately (or scope it academy-wide). */
export async function createAnnouncement(_prev: State, formData: FormData): Promise<State> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const urgency = String(formData.get("urgency") ?? "normal");
  const targetType = String(formData.get("target_type") ?? "academy");
  const subject_id = String(formData.get("subject_id") ?? "").trim() || null;
  const teacher_id = String(formData.get("teacher_id") ?? "").trim() || null;
  const batch = String(formData.get("batch") ?? "").trim() || "A";
  const class_level_id = String(formData.get("class_level_id") ?? "").trim() || null;
  const expiresLocal = String(formData.get("expires_at") ?? "").trim();

  if (!title) return { error: "Enter a title." };
  if (!body) return { error: "Enter the announcement text." };
  if (targetType === "class_group" && (!subject_id || !teacher_id)) return { error: "Choose a subject and teacher." };
  if (targetType === "class_level" && !class_level_id) return { error: "Choose a junior class." };

  const supabase = await createClient();
  const authorId = await myAppUserId(supabase);
  if (!authorId) return { error: "Could not identify your account." };

  let class_group_id: string | null = null;
  if (targetType === "class_group") {
    const { data, error } = await supabase.rpc("fn_ensure_class_group", {
      p_subject_id: subject_id,
      p_teacher_id: teacher_id,
      p_batch: batch,
    });
    if (error) return { error: "Could not resolve the class — " + error.message };
    class_group_id = data as string;
  }

  const scope = targetType === "academy" ? "academy" : "class";

  const { data: ann, error } = await supabase
    .from("announcement")
    .insert({
      author_id: authorId,
      scope,
      title,
      body,
      urgency,
      status: "published",
      publish_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      expires_at: toIso(expiresLocal),
      reviewed_by: authorId,
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !ann) return { error: "Could not create the announcement — " + (error?.message ?? "unknown error") };

  if (targetType !== "academy") {
    const { error: targetErr } = await supabase.from("announcement_target").insert({
      announcement_id: ann.id,
      class_group_id: targetType === "class_group" ? class_group_id : null,
      class_level_id: targetType === "class_level" ? class_level_id : null,
    });
    if (targetErr) {
      await supabase.from("announcement").delete().eq("id", ann.id);
      return { error: "Could not target the announcement — " + targetErr.message };
    }
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Admin: take an announcement already live back down. */
export async function unpublishAnnouncement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("announcement").update({ status: "unpublished" }).eq("id", id);
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}

/** Teacher: request that an announcement be shared with one of their own classes. */
export async function submitAnnouncementRequest(_prev: State, formData: FormData): Promise<State> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const subject_id = String(formData.get("subject_id") ?? "").trim();
  const batch = String(formData.get("batch") ?? "").trim() || "A";
  const publishLocal = String(formData.get("publish_at") ?? "").trim();
  const expiresLocal = String(formData.get("expires_at") ?? "").trim();

  if (!title) return { error: "Enter a title." };
  if (!body) return { error: "Enter the announcement text." };
  if (!subject_id) return { error: "Choose which of your subjects this is for." };
  if (!publishLocal) return { error: "Choose when this should start showing." };
  if (!expiresLocal) return { error: "Choose how long it should stay visible." };

  const publish_at = toIso(publishLocal);
  const expires_at = toIso(expiresLocal);
  if (publish_at && expires_at && expires_at <= publish_at) {
    return { error: "The end time must be after the start time." };
  }

  const supabase = await createClient();
  const authorId = await myAppUserId(supabase);
  if (!authorId) return { error: "Could not identify your account." };

  const { data: teacherRow } = await supabase.from("teacher").select("id").eq("app_user_id", authorId).maybeSingle();
  if (!teacherRow) return { error: "Your account isn't linked to a teacher record." };

  const { data: class_group_id, error: cgErr } = await supabase.rpc("fn_ensure_class_group", {
    p_subject_id: subject_id,
    p_teacher_id: teacherRow.id,
    p_batch: batch,
  });
  if (cgErr) return { error: "Could not resolve the class — " + cgErr.message };

  const { data: ann, error } = await supabase
    .from("announcement")
    .insert({
      author_id: authorId,
      scope: "class",
      title,
      body,
      status: "pending_review",
      publish_at,
      expires_at,
    })
    .select("id")
    .single();

  if (error || !ann) return { error: "Could not submit the request — " + (error?.message ?? "unknown error") };

  const { error: targetErr } = await supabase
    .from("announcement_target")
    .insert({ announcement_id: ann.id, class_group_id });

  if (targetErr) {
    await supabase.from("announcement").delete().eq("id", ann.id);
    return { error: "Could not attach the class — " + targetErr.message };
  }

  revalidatePath("/announcements");
  return { ok: true };
}

/** Teacher: withdraw a request that hasn't been decided yet. */
export async function withdrawAnnouncementRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("announcement").delete().eq("id", id).eq("status", "pending_review");
  revalidatePath("/announcements");
}

/** Admin: approve or decline a teacher's pending request. */
export async function decideAnnouncementRequest(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id) return { error: "Missing request." };
  if (decision !== "approve" && decision !== "decline") return { error: "Choose approve or decline." };
  if (decision === "decline" && !note) return { error: "Add a short reason for declining." };

  const supabase = await createClient();
  const authorId = await myAppUserId(supabase);
  if (!authorId) return { error: "Could not identify your account." };

  const { data: current } = await supabase
    .from("announcement")
    .select("publish_at")
    .eq("id", id)
    .maybeSingle();

  const update =
    decision === "approve"
      ? {
          status: "published" as const,
          published_at: new Date().toISOString(),
          publish_at: current?.publish_at ?? new Date().toISOString(),
          reviewed_by: authorId,
          reviewed_at: new Date().toISOString(),
          decision_note: note || null,
        }
      : {
          status: "declined" as const,
          reviewed_by: authorId,
          reviewed_at: new Date().toISOString(),
          decision_note: note,
        };

  const { error } = await supabase.from("announcement").update(update).eq("id", id);
  if (error) return { error: "Could not record the decision — " + error.message };

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { ok: true };
}
