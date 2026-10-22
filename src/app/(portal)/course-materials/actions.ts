"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const BUCKET = "course-materials";
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);

type FileIn = { path: string; name: string; type: string; size: number };
function readFiles(raw: FormDataEntryValue | null): FileIn[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((f) => f && typeof f.path === "string") : [];
  } catch {
    return [];
  }
}

const tidy = (msg: string) => msg.charAt(0).toUpperCase() + msg.slice(1).replace(/\.$/, "") + ".";

/** Add or edit a material. The files were uploaded from the browser first; their paths come here. */
export async function saveMaterial(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const groupId = String(formData.get("class_group_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("material_date") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const files = readFiles(formData.get("files"));
  const removeIds = formData.getAll("remove_file").map(String).filter(isId);
  const dropUploads = async () => { if (files.length) await supabase.storage.from(BUCKET).remove(files.map((f) => f.path)); };

  let err: string | null = null;
  if (!isId(groupId)) err = "Choose the batch.";
  else if (!title) err = "Enter the topic or name of the material.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) err = "Choose the date.";
  else if (!isId(id) && files.length === 0) err = "Attach at least one file.";
  if (err) { await dropUploads(); return { error: err }; }

  const { data, error } = await supabase.rpc("fn_save_course_material", {
    p_id: isId(id) ? id : null, p_class_group_id: groupId, p_title: title, p_date: date, p_note: note || null,
    p_add_files: files, p_remove_file_ids: removeIds,
  });
  if (error) { await dropUploads(); return { error: "Could not save: " + tidy(error.message) }; }
  const removed = ((data as { removed?: string[] } | null)?.removed ?? []).filter(Boolean);
  if (removed.length) await supabase.storage.from(BUCKET).remove(removed);
  revalidatePath("/course-materials");
  return { ok: true };
}

export async function removeMaterial(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  if (!isId(id)) return { error: "Missing material." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_delete_course_material", { p_id: id });
  if (error) return { error: tidy(error.message) };
  const paths = ((data as string[] | null) ?? []).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  revalidatePath("/course-materials");
  return { ok: true };
}
