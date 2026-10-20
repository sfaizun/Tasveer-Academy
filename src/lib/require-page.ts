import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getViewer } from "@/lib/supabase/viewer";
import { type PageKey, accessOf, homeFor, viewAllows } from "@/lib/access";

/** Top of a portal page. The page opens when the view in use (Viewing as) includes it. When
 * only another of the login's views includes it (say a link to Invoices opened while viewing as
 * Teacher), the login is switched to that view and comes straight back. Otherwise it goes to
 * the home page of its current view. */
export async function requirePage(key: PageKey) {
  const { me } = await getViewer();
  if (!me) redirect("/login");
  if (viewAllows(me, me.view, key)) return;
  // The Dashboard is where everyone lands after signing in, so it never switches views: a view
  // without it opens its own home page instead.
  const other = key === "dashboard" ? null : me.views.find((v) => v.key !== me.view?.key && viewAllows(me, v, key));
  if (other) {
    const h = await headers();
    const next = (h.get("x-pathname") ?? "") + (h.get("x-search") ?? "");
    redirect(`/view?to=${encodeURIComponent(other.key)}${next.startsWith("/") ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  redirect(homeFor(accessOf(me), me));
}
