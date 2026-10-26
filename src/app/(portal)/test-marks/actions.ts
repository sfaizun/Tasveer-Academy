"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
type Supabase = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "test-mark-attachments";

function readMark(formData: FormData) {
  const student_id = String(formData.get("student_id") ?? "").trim();
  const subject_id = String(formData.get("subject_id") ?? "").trim();
  const test_name = String(formData.get("test_name") ?? "").trim();
  const test_date = String(formData.get("test_date") ?? "").trim();
  const marksRaw = String(formData.get("marks") ?? "").trim();
  const outRaw = String(formData.get("out_of") ?? "").trim();
  const marks = Math.round(Number(marksRaw) * 100) / 100;
  const out_of = Math.round(Number(outRaw) * 100) / 100;
  const remarks = String(formData.get("remarks") ?? "").trim().slice(0, 1000) || null;
  const mock = String(formData.get("kind") ?? "") === "mock";
  const mock_exam_id = mock ? String(formData.get("mock_exam_id") ?? "").trim() : "";
  if (mock && !/^[0-9a-f-]{36}$/.test(mock_exam_id)) return { error: "Choose the mock exam." };
  const mock_no = mock ? String(formData.get("mock_no") ?? "").trim().slice(0, 50) : null;
  if (mock && !mock_no) return { error: "Enter the mock number." };

  if (!student_id) return { error: "Choose the student." };
  if (!subject_id) return { error: "Choose the subject." };
  if (!test_name) return { error: "Enter the test name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(test_date)) return { error: "Choose the date of the test." };
  if (!marksRaw || !Number.isFinite(marks) || marks < 0) return { error: "Enter the marks obtained." };
  if (!outRaw || !Number.isFinite(out_of) || out_of <= 0) return { error: "Enter the total marks (Out of)." };
  if (marks > out_of) return { error: "Marks obtained can't be more than Out of." };
  return { values: { student_id, subject_id, test_name: test_name.slice(0, 200), test_date, marks, out_of, remarks, mock_exam_id: mock_exam_id || null, mock_no } };
}

type Attachment = { attachment_path: string; attachment_name: string; attachment_type: string | null; attachment_size: number | null };

/** The file is uploaded from the browser first; the form sends its storage path here. */
function readAttachment(formData: FormData): null | { error: string; values?: undefined } | { values: Attachment; error?: undefined } {
  const path = String(formData.get("attachment_path") ?? "").trim();
  if (!path) return null;
  if (!/^marks\/\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(path)) return { error: "The attachment upload was not valid. Attach the file again." };
  const name = String(formData.get("attachment_name") ?? "").trim().slice(0, 200) || "attachment";
  const type = String(formData.get("attachment_type") ?? "").trim() || null;
  const size = Number(formData.get("attachment_size") ?? 0) || null;
  return { values: { attachment_path: path, attachment_name: name, attachment_type: type, attachment_size: size } };
}

async function removeFile(supabase: Supabase, path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error("test mark attachment remove failed:", error.message);
}

function friendly(msg: string) {
  if (/row-level security/i.test(msg)) return "You can only record marks for your own students and subjects.";
  if (/test_mark_one_per_mock/i.test(msg)) return "Marks with this mock number are already recorded for this student. Use another mock number, or edit the saved marks.";
  return msg;
}

function refresh() {
  revalidatePath("/test-marks");
  revalidatePath("/students/[id]", "page");
}

export async function addTestMark(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const a = readAttachment(formData);
  const r = readMark(formData);
  if ("error" in r || a?.error) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: "error" in r ? r.error : a?.error };
  }
  const { data: me } = await supabase.rpc("my_app_user_id");
  const { error } = await supabase
    .from("test_mark")
    .insert({ ...r.values, ...(a?.values ?? {}), created_by: (me as string | null) ?? null });
  if (error) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: "Could not save the marks: " + friendly(error.message) };
  }
  refresh();
  return { ok: true };
}

export async function updateTestMark(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const a = readAttachment(formData);
  const r = readMark(formData);
  if ("error" in r || a?.error) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: "error" in r ? r.error : a?.error };
  }
  const removing = formData.get("attachment_removed") === "1";
  const { data: old } = await supabase.from("test_mark").select("attachment_path").eq("id", id).maybeSingle();
  if (!old) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: "You can't change these marks." };
  }
  // Remove the old file while it is still linked to these marks (that link is what grants a
  // teacher access to a file someone else uploaded).
  if ((a?.values || removing) && old.attachment_path) await removeFile(supabase, old.attachment_path);
  const fileChange = a?.values
    ? a.values
    : removing
      ? { attachment_path: null, attachment_name: null, attachment_type: null, attachment_size: null }
      : {};
  const { data, error } = await supabase
    .from("test_mark")
    .update({ ...r.values, ...fileChange })
    .eq("id", id)
    .select("id");
  if (error || !data || data.length === 0) {
    if (a?.values) await removeFile(supabase, a.values.attachment_path);
    return { error: error ? "Could not save the marks: " + friendly(error.message) : "You can't change these marks." };
  }
  refresh();
  return { ok: true };
}

export async function removeTestMark(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: row } = await supabase.from("test_mark").select("attachment_path").eq("id", id).maybeSingle();
  if (!row) return;
  // Remove the file while it is still linked to the marks (that link is what grants access to it).
  await removeFile(supabase, row.attachment_path);
  const { error } = await supabase.from("test_mark").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
