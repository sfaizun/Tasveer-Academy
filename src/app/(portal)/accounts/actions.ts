"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean; email?: string; password?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createTeacherLogin(_prev: State, formData: FormData): Promise<State> {
  const teacher_id = String(formData.get("teacher_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!teacher_id) return { error: "Choose a teacher." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { data: teacher } = await supabase.from("teacher").select("full_name").eq("id", teacher_id).maybeSingle();
  if (!teacher) return { error: "Teacher not found." };

  const { data, error } = await supabase.rpc("fn_admin_create_login", {
    p_email: email,
    p_full_name: teacher.full_name,
    p_role: "teacher",
    p_teacher_id: teacher_id,
  });
  if (error) return { error: "Could not create the login — " + error.message };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/accounts");
  return { ok: true, email: row?.out_email, password: row?.out_password };
}

export async function createStudentLogin(_prev: State, formData: FormData): Promise<State> {
  const student_id = String(formData.get("student_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!student_id) return { error: "Choose a student." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { data: student } = await supabase.from("student").select("full_name").eq("id", student_id).maybeSingle();
  if (!student) return { error: "Student not found." };

  const { data, error } = await supabase.rpc("fn_admin_create_login", {
    p_email: email,
    p_full_name: student.full_name,
    p_role: "student",
    p_student_id: student_id,
  });
  if (error) return { error: "Could not create the login — " + error.message };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/accounts");
  return { ok: true, email: row?.out_email, password: row?.out_password };
}

export async function resetLoginPassword(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Missing account." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_admin_reset_password", { p_email: email });
  if (error) return { error: "Could not reset the password — " + error.message };

  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, email: row?.out_email, password: row?.out_password };
}

export async function setAppUserActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("app_user").update({ active }).eq("id", id);
  revalidatePath("/accounts");
}
