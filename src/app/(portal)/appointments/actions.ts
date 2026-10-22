"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s);
const tidy = (msg: string) => {
  const m = msg.trim().replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1) + ".";
};
const done = () => { revalidatePath("/appointments"); revalidatePath("/dashboard"); };

/** Book an appointment. The database decides who may book what (see fn_book_appointment). */
export async function bookAppointment(_prev: State, f: FormData): Promise<State> {
  const studentId = String(f.get("student_id") ?? "");
  const withWho = String(f.get("with") ?? "");
  const subjectId = String(f.get("subject_id") ?? "");
  const date = String(f.get("date") ?? "");
  const time = String(f.get("time") ?? "");
  const minutes = Number(f.get("minutes") ?? 30);
  const reason = String(f.get("reason") ?? "");
  const note = String(f.get("note") ?? "").trim();
  const office = withWho === "office";

  if (!office && !isId(withWho)) return { error: "Choose the teacher or the office." };
  if (!office && !isId(subjectId)) return { error: "Choose the subject." };
  if (office && !reason) return { error: "Choose the reason for the office appointment." };
  if (!isDate(date)) return { error: "Choose the date." };
  if (!isTime(time)) return { error: "Choose the time." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_book_appointment", {
    p_student_id: isId(studentId) ? studentId : null,
    p_with_office: office,
    p_teacher_id: office ? null : withWho,
    p_subject_id: office ? null : subjectId,
    p_date: date,
    p_time: time,
    p_minutes: minutes,
    p_reason: office ? reason : null,
    p_note: note || null,
  });
  if (error) return { error: tidy(error.message) };
  done();
  return { ok: true };
}

export async function respondAppointment(_prev: State, f: FormData): Promise<State> {
  const id = String(f.get("id") ?? "");
  const accept = String(f.get("accept") ?? "") === "1";
  const note = String(f.get("note") ?? "").trim();
  if (!isId(id)) return { error: "Missing appointment." };
  if (!accept && !note) return { error: "Give a reason for declining." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_respond_appointment", { p_id: id, p_accept: accept, p_note: note || null });
  if (error) return { error: tidy(error.message) };
  done();
  return { ok: true };
}

export async function cancelAppointment(_prev: State, f: FormData): Promise<State> {
  const id = String(f.get("id") ?? "");
  const reason = String(f.get("reason") ?? "").trim();
  if (!isId(id)) return { error: "Missing appointment." };
  if (!reason) return { error: "Give a reason for cancelling." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cancel_appointment", { p_id: id, p_reason: reason });
  if (error) return { error: tidy(error.message) };
  done();
  return { ok: true };
}

export async function rescheduleAppointment(_prev: State, f: FormData): Promise<State> {
  const id = String(f.get("id") ?? "");
  const date = String(f.get("date") ?? "");
  const time = String(f.get("time") ?? "");
  const minutes = Number(f.get("minutes") ?? 30);
  const reason = String(f.get("reason") ?? "").trim();
  if (!isId(id)) return { error: "Missing appointment." };
  if (!isDate(date)) return { error: "Choose the new date." };
  if (!isTime(time)) return { error: "Choose the new time." };
  if (!reason) return { error: "Give a reason for moving the appointment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_reschedule_appointment", {
    p_id: id, p_date: date, p_time: time, p_minutes: minutes, p_reason: reason,
  });
  if (error) return { error: tidy(error.message) };
  done();
  return { ok: true };
}
