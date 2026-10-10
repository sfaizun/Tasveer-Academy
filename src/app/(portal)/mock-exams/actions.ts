"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string; message?: string } | null;

function nice(m: string | undefined | null) {
  const s = (m ?? "Something went wrong").trim();
  if (/mock_exam_series_subject_key/.test(s)) return "This series already has a mock exam for that subject.";
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".");
}

function refresh(examId?: string | null, studentId?: string | null) {
  revalidatePath("/mock-exams");
  if (examId) revalidatePath(`/mock-exams/${examId}`);
  if (studentId) revalidatePath(`/students/${studentId}`);
  revalidatePath("/roster");
}

function readExam(formData: FormData) {
  const series = String(formData.get("series") ?? "").trim();
  const subject_id = String(formData.get("subject_id") ?? "").trim();
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const fee = Math.round(Number(feeRaw) * 100) / 100;
  const note = String(formData.get("note") ?? "").trim() || null;
  const teacher_id = String(formData.get("teacher_id") ?? "").trim() || null;

  if (!series) return { error: "Enter the series name, e.g. Winter Mocks 2026." };
  if (!subject_id) return { error: "Choose the subject." };
  if (!feeRaw || !Number.isFinite(fee) || fee < 0) return { error: "Enter the exam fee." };
  // Mock exams have no date, time or room: just series, subject, fee and teacher.
  return { values: { series, subject_id, fee, note, teacher_id } };
}

export async function createMockExam(_prev: State, formData: FormData): Promise<State> {
  const r = readExam(formData);
  if ("error" in r) return { error: r.error };
  const supabase = await createClient();
  const { error } = await supabase.from("mock_exam").insert(r.values);
  if (error) return { error: nice(error.message) };
  refresh();
  return { ok: true };
}

export async function updateMockExam(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const r = readExam(formData);
  if ("error" in r) return { error: r.error };
  const status = String(formData.get("status") ?? "open");
  if (!["open", "closed"].includes(status)) return { error: "Choose open or closed." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mock_exam")
    .update({ ...r.values, status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "cancelled");
  if (error) return { error: nice(error.message) };
  refresh(id);
  return { ok: true };
}

/** Teacher: edit a mock exam assigned to them (series, note, registration open/closed only). */
export async function teacherUpdateMockExam(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const series = String(formData.get("series") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "open");
  if (!series) return { error: "Enter the series name." };
  if (!["open", "closed"].includes(status)) return { error: "Choose open or closed." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mock_exam")
    .update({ series, note, status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "cancelled")
    .select("id");
  if (error) return { error: nice(error.message) };
  if (!data || data.length === 0) return { error: "You can only edit mock exams assigned to you." };
  refresh(id);
  return { ok: true };
}

export async function cancelMockExam(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for cancelling." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cancel_mock_exam", { p_mock_exam_id: id, p_reason: reason });
  if (error) return { error: nice(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  refresh(id);
  const kept = row?.fees_kept ?? 0;
  return {
    ok: true,
    message: `Cancelled. ${row?.withdrawn ?? 0} candidate(s) withdrawn, ${row?.fees_removed ?? 0} unpaid fee(s) removed${kept ? `, ${kept} already-paid fee(s) left on the invoice for you to refund or credit` : ""}.`,
  };
}

export async function registerForMock(_prev: State, formData: FormData): Promise<State> {
  const examId = String(formData.get("mock_exam_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  if (!examId) return { error: "Choose a mock exam." };
  if (!studentId) return { error: "Choose a student." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_register_mock", { p_student_id: studentId, p_mock_exam_id: examId });
  if (error) return { error: nice(error.message) };
  refresh(examId, studentId);
  return { ok: true, message: "Registered. The exam fee is on this month's invoice." };
}

export async function withdrawFromMock(_prev: State, formData: FormData): Promise<State> {
  const regId = String(formData.get("registration_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const examId = String(formData.get("mock_exam_id") ?? "") || null;
  const studentId = String(formData.get("student_id") ?? "") || null;
  if (!reason) return { error: "Give a reason for withdrawing." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_withdraw_mock", { p_registration_id: regId, p_reason: reason });
  if (error) return { error: nice(error.message) };
  refresh(examId, studentId);
  return {
    ok: true,
    message:
      data === "kept"
        ? "Withdrawn. The fee was already paid, so it stays on the invoice; give a refund or credit separately if needed."
        : "Withdrawn and the fee removed from the invoice.",
  };
}

export async function setMockAttendance(formData: FormData) {
  const regId = String(formData.get("registration_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const examId = String(formData.get("mock_exam_id") ?? "") || null;
  const supabase = await createClient();
  await supabase.rpc("fn_set_mock_attendance", { p_registration_id: regId, p_status: status });
  refresh(examId);
}
