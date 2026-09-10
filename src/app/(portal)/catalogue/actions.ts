"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

export async function addTeacher(_prev: State, formData: FormData): Promise<State> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!full_name) return { error: "Enter the teacher's name." };

  const supabase = await createClient();
  const { error } = await supabase.from("teacher").insert({
    full_name,
    phone: phone || null,
    email: email || null,
  });
  if (error) return { error: "Could not add teacher — " + error.message };

  revalidatePath("/catalogue");
  return { ok: true };
}

export async function setTeacherActive(formData: FormData) {
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("teacher").update({ active }).eq("id", id);
  revalidatePath("/catalogue");
}

export async function addSubject(_prev: State, formData: FormData): Promise<State> {
  const name = String(formData.get("name") ?? "").trim();
  const programme_id = String(formData.get("programme_id") ?? "");
  const level = String(formData.get("level") ?? "") || null;
  if (!name) return { error: "Enter a subject name." };
  if (!programme_id) return { error: "Choose a programme." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("subject")
    .select("id, name, level, sort_order")
    .eq("programme_id", programme_id);

  // Postgres unique constraints treat NULL as distinct, so a (programme, name, NULL level)
  // duplicate would otherwise slip past the DB and needs catching here instead.
  const duplicate = (existing ?? []).some(
    (s: any) => s.name.trim().toLowerCase() === name.toLowerCase() && (s.level ?? null) === (level ?? null)
  );
  if (duplicate) return { error: "That subject (with this level) already exists." };

  const nextSort = (existing ?? []).reduce((max: number, s: any) => Math.max(max, s.sort_order ?? 0), 0) + 1;

  const { error } = await supabase.from("subject").insert({
    name,
    programme_id,
    level,
    sort_order: nextSort,
  });
  if (error) {
    const msg = error.code === "23505" ? "That subject (with this level) already exists." : error.message;
    return { error: "Could not add subject — " + msg };
  }

  revalidatePath("/catalogue");
  revalidatePath("/apply");
  return { ok: true };
}

export async function setSubjectActive(formData: FormData) {
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("subject").update({ active }).eq("id", id);
  revalidatePath("/catalogue");
  revalidatePath("/apply");
}

export async function addMapping(_prev: State, formData: FormData): Promise<State> {
  const teacher_id = String(formData.get("teacher_id") ?? "");
  const subject_id = String(formData.get("subject_id") ?? "");
  if (!teacher_id || !subject_id) return { error: "Choose a subject." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_subject")
    .upsert({ teacher_id, subject_id, active: true }, { onConflict: "teacher_id,subject_id" });
  if (error) return { error: "Could not map subject — " + error.message };

  revalidatePath("/catalogue");
  revalidatePath("/apply");
  return { ok: true };
}

export async function setMappingActive(formData: FormData) {
  const teacher_id = String(formData.get("teacher_id"));
  const subject_id = String(formData.get("subject_id"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("teacher_subject").update({ active }).eq("teacher_id", teacher_id).eq("subject_id", subject_id);
  revalidatePath("/catalogue");
  revalidatePath("/apply");
}
