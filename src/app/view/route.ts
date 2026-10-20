import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VIEW_COOKIE, loadMe } from "@/lib/supabase/viewer";
import { accessOfView, homeFor } from "@/lib/access";

/** Switches the "Viewing as" view: /view?to=<view key>&next=<page>. Only views the login
 * really has are accepted. The choice is remembered in a cookie. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url));
  const me = await loadMe(supabase, user.id);
  if (!me) return NextResponse.redirect(new URL("/no-access", url));

  const view = me.views.find((v) => v.key === url.searchParams.get("to"));
  if (!view) return NextResponse.redirect(new URL("/dashboard", url));

  const next = url.searchParams.get("next") ?? "";
  const safe = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !next.startsWith("/view");
  const dest = safe ? next : homeFor(accessOfView(view, me.role), { ...me, view });
  const res = NextResponse.redirect(new URL(dest, url));
  res.cookies.set(VIEW_COOKIE, view.key, { path: "/", sameSite: "lax", httpOnly: true, secure: url.protocol === "https:", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
