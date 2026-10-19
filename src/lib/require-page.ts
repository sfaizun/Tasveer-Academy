import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/viewer";
import { type PageKey, accessOf, canOpen, homeFor } from "@/lib/access";

/** Top of an admin page: sends an admin whose access role doesn't include this page to the
 * first page they can open. Other roles are left to the page's own checks. */
export async function requirePage(key: PageKey) {
  const { me } = await getViewer();
  if (me?.role !== "admin") return;
  const a = accessOf(me);
  if (!canOpen(a, key)) redirect(homeFor(a));
}
