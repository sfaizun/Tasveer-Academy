"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const BUCKET = "homework-files";
const TASK_BUCKET = "homework-tasks";
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

/** Teacher: set homework for a batch, or edit it. Files were uploaded from the browser first. */
export async function saveTask(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const groupId = String(formData.get("class_group_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const due = String(formData.get("due_on") ?? "");
  const files = readFiles(formData.get("files"));
  const removeIds = formData.getAll("remove_file").map(String).filter(isId);
  const dropUploads = async () => { if (files.length) await supabase.storage.from(TASK_BUCKET).remove(files.map((f) => f.path)); };

  let err: string | null = null;
  if (!isId(groupId)) err = "Choose the batch.";
  else if (!title) err = "Enter the homework title.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) err = "Choose the due date.";
  if (err) { await dropUploads(); return { error: err }; }

  const { data, error } = await supabase.rpc("fn_save_hw_task", {
    p_id: isId(id) ? id : null, p_class_group_id: groupId, p_title: title, p_instructions: instructions || null,
    p_due_on: due, p_add_files: files, p_remove_file_ids: removeIds,
  });
  if (error) { await dropUploads(); return { error: "Could not save: " + tidy(error.message) }; }
  const removed = ((data as { removed?: string[] } | null)?.removed ?? []).filter(Boolean);
  if (removed.length) await supabase.storage.from(TASK_BUCKET).remove(removed);
  revalidatePath("/homework");
  return { ok: true };
}

export async function removeTask(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  if (!isId(id)) return { error: "Missing homework." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_delete_hw_task", { p_id: id });
  if (error) return { error: tidy(error.message) };
  const paths = ((data as string[] | null) ?? []).filter(Boolean);
  if (paths.length) await supabase.storage.from(TASK_BUCKET).remove(paths);
  revalidatePath("/homework");
  return { ok: true };
}

/** Student: submit work for a homework task. The files were uploaded from the browser first. */
export async function submitTask(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const taskId = String(formData.get("task_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const files = readFiles(formData.get("files"));
  const dropUploads = async () => { if (files.length) await supabase.storage.from(BUCKET).remove(files.map((f) => f.path)); };
  if (!isId(taskId)) { await dropUploads(); return { error: "Missing homework." }; }
  if (!files.length) return { error: "Attach your homework file." };
  const { error } = await supabase.rpc("fn_submit_hw_task", { p_task_id: taskId, p_note: note || null, p_files: files });
  if (error) { await dropUploads(); return { error: "Could not submit: " + tidy(error.message) }; }
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
