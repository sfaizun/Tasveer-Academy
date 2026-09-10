"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

function parseCapacity(raw: string) {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function addClassSlot(_prev: State, formData: FormData): Promise<State> {
  const targetType = String(formData.get("target_type") ?? "");
  const subject_id = String(formData.get("subject_id") ?? "").trim() || null;
  const batch = String(formData.get("batch") ?? "").trim() || "A";
  const class_level_id = String(formData.get("class_level_id") ?? "").trim() || null;
  const teacher_id = String(formData.get("teacher_id") ?? "").trim() || null;
  const weekday = Number(formData.get("weekday"));
  const start_time = String(formData.get("start_time") ?? "").trim();
  const end_time = String(formData.get("end_time") ?? "").trim();
  const room = String(formData.get("room") ?? "").trim() || null;
  const capacity = parseCapacity(String(formData.get("capacity") ?? ""));

  if (targetType === "class_group" && (!subject_id || !teacher_id)) return { error: "Choose a subject and teacher." };
  if (targetType === "class_level" && !class_level_id) return { error: "Choose a junior class." };
  if (targetType !== "class_group" && targetType !== "class_level") return { error: "Choose what this slot is for." };
  if (Number.isNaN(weekday) || weekday < 0 || weekday > 6) return { error: "Choose a day of the week." };
  if (!start_time || !end_time) return { error: "Enter a start and end time." };
  if (end_time <= start_time) return { error: "End time must be after the start time." };

  const supabase = await createClient();

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

  const { error } = await supabase.from("class_slot").insert({
    class_group_id,
    class_level_id: targetType === "class_level" ? class_level_id : null,
    teacher_id: targetType === "class_level" ? teacher_id : null,
    weekday,
    start_time,
    end_time,
    room,
    capacity,
  });
  if (error) return { error: "Could not add the slot — " + error.message };

  revalidatePath("/roster");
  return { ok: true };
}

export async function updateClassSlot(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const isJunior = formData.get("is_junior") === "true";
  const teacher_id = String(formData.get("teacher_id") ?? "").trim() || null;
  const weekday = Number(formData.get("weekday"));
  const start_time = String(formData.get("start_time") ?? "").trim();
  const end_time = String(formData.get("end_time") ?? "").trim();
  const room = String(formData.get("room") ?? "").trim() || null;
  const capacity = parseCapacity(String(formData.get("capacity") ?? ""));

  if (!id) return { error: "Missing slot." };
  if (Number.isNaN(weekday) || weekday < 0 || weekday > 6) return { error: "Choose a day of the week." };
  if (!start_time || !end_time) return { error: "Enter a start and end time." };
  if (end_time <= start_time) return { error: "End time must be after the start time." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_slot")
    .update({
      weekday,
      start_time,
      end_time,
      room,
      capacity,
      // teacher_id is only ever meaningful for a junior (class_level) slot — a
      // class_group slot's teacher always comes from the class group itself.
      teacher_id: isJunior ? teacher_id : null,
    })
    .eq("id", id);
  if (error) return { error: "Could not update the slot — " + error.message };

  revalidatePath("/roster");
  return { ok: true };
}

export async function deleteClassSlot(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("class_slot").delete().eq("id", id);
  revalidatePath("/roster");
}
