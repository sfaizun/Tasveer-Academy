import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/viewer";

/** Canteen pages are for admin and the canteen manager only. */
export async function requireCanteenAccess() {
  const { me } = await getViewer();
  const role = me?.role;
  if (role !== "admin" && role !== "canteen_manager") redirect("/dashboard");
  return { me: me!, isAdmin: role === "admin" };
}
