import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/viewer";
import { signOut } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function NoAccess() {
  // Checked again here: if the login does have access (a lookup failed for a moment earlier),
  // go straight into the portal instead of showing this page.
  let hasAccess = false;
  try {
    const { user, me } = await getViewer();
    if (!user) redirect("/login");
    hasAccess = !!me;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
  }
  if (hasAccess) redirect("/dashboard");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="panel" style={{ padding: 28, maxWidth: 440 }}>
        <h1 style={{ fontSize: 19, marginBottom: 8 }}>This account has no access yet</h1>
        <p style={{ marginTop: 0, color: "var(--body)" }}>
          You signed in successfully, but no role has been assigned to this email. An admin needs
          to add you before the portal will show anything.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn" href="/dashboard">Try again</a>
          <form action={signOut}>
            <button className="btn ghost" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </main>
  );
}
