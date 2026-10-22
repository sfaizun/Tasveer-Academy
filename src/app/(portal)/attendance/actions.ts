"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const tidy = (msg: string) => {
  const m = msg.trim().replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1) + ".";
};

/** Save one class's attendance. The form sends slot_id, date and one "m_<student id>" per student. */
export async function saveAttendance(_prev: State, f: FormData): Promise<State> {
  const slotId = String(f.get("slot_id") ?? "");
  const date = String(f.get("date") ?? "");
  if (!isId(slotId)) return { error: "Missing class." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Missing date." };
  const marks: { student_id: string; status: string }[] = [];
  for (const [k, v] of f.entries()) {
    if (!k.startsWith("m_")) continue;
    const id = k.slice(2);
    const status = String(v);
    if (!isId(id)) continue;
    if (status !== "present" && status !== "absent") return { error: "Mark every student present or absent." };
    marks.push({ student_id: id, status });
  }
  if (!marks.length) return { error: "No students to mark." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_save_attendance", { p_slot_id: slotId, p_date: date, p_marks: marks });
  if (error) return { error: tidy(error.message) };
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return { ok: true };
}
