"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNABLE_PAGES } from "@/lib/access";

type State = { ok?: boolean; error?: string; message?: string; email?: string; password?: string } | null;

const KEYS = new Set<string>(ASSIGNABLE_PAGES.map((p) => p.key));
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);

function refresh() {
  revalidatePath("/access");
  revalidatePath("/", "layout");
}

/** Saves the ticked pages for every role whose column changed. */
export async function saveMatrix(_prev: State, formData: FormData): Promise<State> {
  let changes: { id: string; name: string; pages: string[] }[];
  try {
    changes = JSON.parse(String(formData.get("changes") ?? "[]"));
    if (!Array.isArray(changes)) throw new Error();
  } catch {
    return { error: "Could not read the changes. Please try again." };
  }
  if (!changes.length) return { error: "Nothing has changed." };
  const supabase = await createClient();
  for (const c of changes) {
    if (!isId(c.id) || !Array.isArray(c.pages) || !c.pages.every((p) => KEYS.has(p))) return { error: "Could not read the changes." };
    const { error } = await supabase.rpc("fn_save_admin_role", { p_id: c.id, p_name: c.name, p_pages: c.pages });
    if (error) return { error: `Could not save ${c.name}: ${error.message}` };
  }
  refresh();
  return { ok: true, message: `Saved ${changes.length} ${changes.length === 1 ? "role" : "roles"}.` };
}

export async function addRole(_prev: State, formData: FormData): Promise<State> {
  const name = String(formData.get("name") ?? "").trim();
  const copyFrom = String(formData.get("copy_from") ?? "");
  if (!name) return { error: "Enter a name for the role." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  const supabase = await createClient();
  let pages: string[] = [];
  if (isId(copyFrom)) {
    const { data } = await supabase.from("admin_role").select("pages, is_super").eq("id", copyFrom).maybeSingle();
    pages = data?.is_super ? [...KEYS] : ((data?.pages ?? []) as string[]);
  }
  const { error } = await supabase.rpc("fn_save_admin_role", { p_id: null, p_name: name, p_pages: pages });
  if (error) return { error: error.message.includes("duplicate") ? "A role with this name already exists." : "Could not add the role: " + error.message };
  refresh();
  return { ok: true, message: `Added ${name}. Tick its pages in the table and save.` };
}


export async function removeRoleChecked(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "");
  if (!isId(id)) return { error: "Missing role." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_delete_admin_role", { p_id: id });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function setUserRole(_prev: State, formData: FormData): Promise<State> {
  const userId = String(formData.get("user_id") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  if (!isId(userId)) return { error: "Missing login." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_user_admin_role", { p_user_id: userId, p_role_id: isId(roleId) ? roleId : null });
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function createAdminLogin(_prev: State, formData: FormData): Promise<State> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("role_id") ?? "");
  if (!full_name) return { error: "Enter the name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!isId(roleId)) return { error: "Choose the access role." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_create_admin_login", { p_email: email, p_full_name: full_name, p_admin_role_id: roleId });
  if (error) return { error: "Could not create the login: " + error.message };
  const row = Array.isArray(data) ? data[0] : data;
  refresh();
  revalidatePath("/accounts");
  return { ok: true, email: row?.out_email, password: row?.out_password };
}
