import type { SupabaseClient } from "@supabase/supabase-js";
import { actsAsAdmin, viewReadOnly } from "@/lib/access";
import type { ApptRow, BookStudent } from "./shared";

export type ApptMode = "office" | "teacher" | "student";

type MeLike = Parameters<typeof actsAsAdmin>[0] & { id: string; role: string };

/** Which side of appointments the view in use is on: office staff (Appointments page in an access
 * role), a teacher's own portal, or a student. Guardians and other views get null. */
export function apptMode(me: MeLike): ApptMode | null {
  if (actsAsAdmin(me, "appointments")) return "office";
  if (me?.role === "teacher") return "teacher";
  if (me?.role === "student") return "student";
  return null;
}

export async function myTeacherId(supabase: SupabaseClient, appUserId: string) {
  const { data } = await supabase.from("teacher").select("id, full_name").eq("app_user_id", appUserId).maybeSingle();
  return data as { id: string; full_name: string } | null;
}

/** Appointments for the view: upcoming (open, not yet over) or past/closed. A teacher's own view
 * shows only their own, even when one of their access roles could see more. */
export async function loadAppointments(supabase: SupabaseClient, mode: ApptMode, upcoming: boolean, teacherId: string | null, limit = 200) {
  const { data } = await supabase.rpc("fn_list_appointments", { p_upcoming: upcoming, p_limit: limit });
  let rows = (data ?? []) as ApptRow[];
  if (mode === "teacher") rows = rows.filter((r) => r.teacher_id && r.teacher_id === teacherId);
  return rows;
}

/** Students the view can book for, each with the teacher and subject pairs they study now. */
export async function loadBookOptions(supabase: SupabaseClient, mode: ApptMode, teacherId: string | null): Promise<BookStudent[]> {
  const { data } = await supabase.rpc("fn_appointment_options");
  let students = (((data as any)?.students ?? []) as BookStudent[]);
  if (mode === "teacher") {
    students = students
      .map((s) => ({ ...s, pairs: s.pairs.filter((p) => p.teacher_id === teacherId) }))
      .filter((s) => s.pairs.length > 0);
  }
  return students;
}

export const apptReadOnly = (me: MeLike, mode: ApptMode) => mode === "office" && viewReadOnly(me);
