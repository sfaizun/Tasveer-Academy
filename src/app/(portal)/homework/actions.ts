"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const BUCKET = "homework-files";
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const tidy = (msg: string) => msg.charAt(0).toUpperCase() + msg.slice(1).replace(/\.$/, "") + ".";

type FileIn = { path: string; name: string; type: string; size: number };
function readFiles(raw: FormDataEntryValue | null): FileIn[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((f) => f && typeof f.path === "string") : [];
  } catch {
    return [];
  }
}

/** Student: upload homework. The files were uploaded from the browser first; their paths come here.
 * The enrolment gives the teacher, subject and batch. */
export async function submitHomework(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const date = String(formData.get("homework_date") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const files = readFiles(formData.get("files"));
  const dropUploads = async () => { if (files.length) await supabase.storage.from(BUCKET).remove(files.map((f) => f.path)); };

  let err: string | null = null;
  if (!isId(enrolmentId)) err = "Choose the teacher and subject.";
  else if (!title) err = "Enter what the homework is.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) err = "Choose the date.";
  else if (!files.length) err = "Attach your homework file.";
  if (err) { await dropUploads(); return { error: err }; }

  const { error } = await supabase.rpc("fn_submit_homework", {
    p_enrolment_id: enrolmentId, p_date: date, p_title: title, p_note: note || null, p_files: files,
  });
  if (error) { await dropUploads(); return { error: "Could not upload: " + tidy(error.message) }; }
  revalidatePath("/homework");
  return { ok: true };
}

export async function removeHomework(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  if (!isId(id)) return { error: "Missing homework." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_delete_homework", { p_id: id });
  if (error) return { error: tidy(error.message) };
  const paths = ((data as string[] | null) ?? []).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  revalidatePath("/homework");
  return { ok: true };
}

/** Teacher: mark reviewed with a comment (or reopen). */
export async function reviewHomework(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  if (!isId(id)) return { error: "Missing homework." };
  const reviewed = formData.get("reviewed") !== "0";
  const comment = String(formData.get("comment") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_review_homework", { p_id: id, p_comment: comment || null, p_reviewed: reviewed });
  if (error) return { error: tidy(error.message) };
  revalidatePath("/homework");
  return { ok: true };
}
