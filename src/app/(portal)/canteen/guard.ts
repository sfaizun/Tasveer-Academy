import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/viewer";
import { actsAsAdmin } from "@/lib/access";

/** Canteen pages are for the canteen manager, and for any login whose access role includes
 * the canteen (those also see costs and profit). */
export async function requireCanteenAccess() {
  const { me } = await getViewer();
  const isAdmin = actsAsAdmin(me, "canteen");
  if (me?.role !== "canteen_manager" && !isAdmin) redirect("/dashboard");
  return { me: me!, isAdmin };
}
