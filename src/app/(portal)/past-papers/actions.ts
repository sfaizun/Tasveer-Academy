"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const BUCKET = "past-papers";
const KINDS = ["qp", "ms", "er"];
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const tidy = (msg: string) => msg.charAt(0).toUpperCase() + msg.slice(1).replace(/\.$/, "") + ".";

type FileIn = { kind: string; path: string; name: string; type: string; size: number };
function readFiles(raw: FormDataEntryValue | null): FileIn[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((f) => f && typeof f.path === "string" && KINDS.includes(f.kind)) : [];
  } catch {
    return [];
  }
}

/** Add or edit a past paper. The files were uploaded from the browser first; their paths come here. */
export async function savePaper(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const subjectId = String(formData.get("subject_id") ?? "");
  const year = Number(formData.get("year"));
  const session = String(formData.get("session") ?? "");
  const paper = String(formData.get("paper") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const files = readFiles(formData.get("files"));
  const removeKinds = formData.getAll("remove_kind").map(String).filter((k) => k === "ms" || k === "er");
  const dropUploads = async () => { if (files.length) await supabase.storage.from(BUCKET).remove(files.map((f) => f.path)); };

  let err: string | null = null;
  if (!isId(subjectId)) err = "Choose the subject.";
  else if (!Number.isInteger(year) || year < 1990) err = "Enter the year.";
  else if (!["jan", "jun", "nov"].includes(session)) err = "Choose the exam session.";
  else if (!paper) err = "Enter the paper, e.g. Paper 1 or Unit 2.";
  else if (!isId(id) && !files.some((f) => f.kind === "qp")) err = "Attach the question paper.";
  if (err) { await dropUploads(); return { error: err }; }

  const { data, error } = await supabase.rpc("fn_save_past_paper", {
    p_id: isId(id) ? id : null, p_subject_id: subjectId, p_year: year, p_session: session, p_paper: paper,
    p_note: note || null, p_files: files, p_remove_kinds: removeKinds,
  });
  if (error) { await dropUploads(); return { error: "Could not save: " + tidy(error.message) }; }
  const removed = ((data as { removed?: string[] } | null)?.removed ?? []).filter(Boolean);
  if (removed.length) await supabase.storage.from(BUCKET).remove(removed);
  revalidatePath("/past-papers");
  return { ok: true };
}

export async function removePaper(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  if (!isId(id)) return { error: "Missing paper." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_delete_past_paper", { p_id: id });
  if (error) return { error: tidy(error.message) };
  const paths = ((data as string[] | null) ?? []).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  revalidatePath("/past-papers");
  return { ok: true };
}
