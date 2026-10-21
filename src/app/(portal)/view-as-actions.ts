"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VIEW_COOKIE } from "@/lib/supabase/viewer";

type State = { error?: string } | null;

/** Super Admin: view the portal as another login (read only). Logged in the audit log. */
export async function startViewAs(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("user_id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Missing login." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_start_impersonation", { p_user_id: id });
  if (error) return { error: error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
  // Start in that person's default view, not the one this admin last picked.
  (await cookies()).delete(VIEW_COOKIE);
  redirect("/dashboard");
}

/** Stop viewing as someone and go back to your own portal. */
export async function stopViewAs() {
  const supabase = await createClient();
  await supabase.rpc("fn_stop_impersonation");
  (await cookies()).delete(VIEW_COOKIE);
  redirect("/accounts");
}
