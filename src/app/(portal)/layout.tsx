import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getViewer } from "@/lib/supabase/viewer";
import { signOut } from "../login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import NavLink from "@/components/NavLink";
import Logo from "@/components/Logo";
import PortalNav from "@/components/PortalNav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, me } = await getViewer();
  if (!user) redirect("/login");
  if (!me) redirect("/no-access");

  const isAdmin = me.role === "admin";
  const isTeacher = me.role === "teacher";
  const isCanteen = me.role === "canteen_manager";

  // The canteen manager only ever works in the canteen section (plus their own password page).
  // Academy data is already hidden from them in the database; this keeps them off the
  // academy pages too, e.g. the /dashboard landing page after sign-in.
  if (isCanteen) {
    const path = (await headers()).get("x-pathname") ?? "";
    const allowed = path === "/canteen" || path.startsWith("/canteen/") || path === "/account" || path.startsWith("/account/");
    if (!allowed) redirect("/canteen");
  }
  const roleName = me.is_owner ? "Owner" : isCanteen ? "Canteen manager" : me.role;
  const initials = me.full_name.split(" ").map((p: string) => p[0]).slice(0, 2).join("");

  return (
    <div className="shell">
      <PortalNav>
        <div className="brand">
          <Logo size={32} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", lineHeight: 1.15 }}>
              Tasveer Academy
            </div>
            <div className="lbl" style={{ fontSize: 9.5 }}>
              {roleName}
            </div>
          </div>
        </div>

        {isCanteen ? (
          <>
            <div className="navlbl">Canteen</div>
            <NavLink href="/canteen" exact>Canteen home</NavLink>
            <NavLink href="/canteen/sell">Sell</NavLink>
            <NavLink href="/canteen/stock">Today&apos;s stock</NavLink>
            <NavLink href="/canteen/close">Close day</NavLink>
            <NavLink href="/canteen/plan">Prep plan</NavLink>
            <NavLink href="/canteen/requests">Requests</NavLink>
            <NavLink href="/canteen/reports">Reports</NavLink>
            <div className="navlbl">Set up</div>
            <NavLink href="/canteen/menu">Menu &amp; prices</NavLink>
            <NavLink href="/canteen/hours">Opening hours</NavLink>
          </>
        ) : (
          <>
            <div className="navlbl">Overview</div>
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/roster">Class Schedule</NavLink>
            {(isAdmin || isTeacher) && <NavLink href="/announcements">Announcements</NavLink>}
            {isTeacher && <NavLink href="/mock-exams">Mock exams</NavLink>}
            <NavLink href="/reports">Reports</NavLink>
          </>
        )}

        {isAdmin && (
          <>
            <div className="navlbl">Admissions</div>
            <NavLink href="/applications">Applications</NavLink>
            <NavLink href="/students">Students</NavLink>
            <NavLink href="/mock-exams">Mock exams</NavLink>

            <div className="navlbl">Billing</div>
            <NavLink href="/billing">Billing run</NavLink>
            <NavLink href="/invoices">Invoices</NavLink>
            <NavLink href="/expenses">Expenses</NavLink>

            <div className="navlbl">Academy</div>
            <NavLink href="/catalogue">Subjects &amp; teachers</NavLink>
            <NavLink href="/accounts">Accounts</NavLink>
            <NavLink href="/settings">Fees &amp; settings</NavLink>
            <NavLink href="/audit-log">Audit log</NavLink>

            {/* The canteen is a separate business: its own boxed, differently coloured group at the end. */}
            <div className="navgroup-canteen">
              <div className="navgroup-head">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8z" />
                  <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
                  <path d="M8 2.5v2.5M11.5 2.5v2.5" />
                </svg>
                Canteen
              </div>
              <NavLink href="/canteen" exact>Canteen overview</NavLink>
              <NavLink href="/canteen/reports">Sales reports</NavLink>
              <NavLink href="/canteen/sell">Sell</NavLink>
              <NavLink href="/canteen/stock">Today&apos;s stock</NavLink>
              <NavLink href="/canteen/close">Cash &amp; day close</NavLink>
              <NavLink href="/canteen/plan">Prep plan</NavLink>
              <NavLink href="/canteen/requests">Requests</NavLink>
              <NavLink href="/canteen/menu">Menu &amp; prices</NavLink>
              <NavLink href="/canteen/hours">Opening hours</NavLink>
            </div>
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
      </PortalNav>

      <div className="main">{children}</div>
    </div>
  );
}
