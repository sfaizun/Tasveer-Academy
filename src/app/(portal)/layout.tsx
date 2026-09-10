import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import NavLink from "@/components/NavLink";
import Logo from "@/components/Logo";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("app_user")
    .select("full_name, role, is_owner")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!me) redirect("/no-access");

  const isAdmin = me.role === "admin";
  const initials = me.full_name.split(" ").map((p: string) => p[0]).slice(0, 2).join("");

  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">
          <Logo size={32} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", lineHeight: 1.15 }}>
              Tasveer Academy
            </div>
            <div className="lbl" style={{ fontSize: 9.5 }}>
              {me.is_owner ? "Owner" : me.role}
            </div>
          </div>
        </div>

        <div className="navlbl">Overview</div>
        <NavLink href="/dashboard">Dashboard</NavLink>
        <NavLink href="/roster">Roster</NavLink>
        <NavLink href="/announcements">Announcements</NavLink>

        {isAdmin && (
          <>
            <div className="navlbl">Admissions</div>
            <NavLink href="/applications">Applications</NavLink>
            <NavLink href="/students">Students</NavLink>

            <div className="navlbl">Billing</div>
            <NavLink href="/billing">Billing run</NavLink>

            <div className="navlbl">Academy</div>
            <NavLink href="/catalogue">Subjects &amp; teachers</NavLink>
            <NavLink href="/accounts">Accounts</NavLink>
            <NavLink href="/settings">Fees &amp; settings</NavLink>
          </>
        )}

        <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <NavLink href="/account">Change password</NavLink>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 8px" }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: "50%", flex: "0 0 28px",
                background: "var(--tint2)", border: "1px solid var(--line)",
                display: "grid", placeItems: "center", fontSize: 11,
                fontWeight: 600, color: "var(--ink)",
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {me.full_name}
              </div>
              <div className="sub" style={{ fontSize: 10.5 }}>{user.email}</div>
            </div>
          </div>
          <form action={signOut} style={{ padding: "0 8px" }}>
            <button className="btn ghost" type="submit" style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <div className="main">{children}</div>
    </div>
  );
}
