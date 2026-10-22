import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getViewer } from "@/lib/supabase/viewer";
import { signOut } from "../login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import NavLink from "@/components/NavLink";
import Logo from "@/components/Logo";
import PortalNav from "@/components/PortalNav";
import ViewPicker from "@/components/ViewPicker";
import { stopViewAs } from "./view-as-actions";
import { PAGES, accessOf, canOpen, homeFor, pageKeyForPath } from "@/lib/access";

const ADMIN_GROUPS = ["Overview", "Admissions", "Billing", "Office Accounts", "Academy"];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, me } = await getViewer();
  if (!user) redirect("/login");
  if (!me) redirect("/no-access");

  // The view in use ("Viewing as"): the login's own portal, or one of its access roles. The menu
  // shows only that view's pages; the menu at the top switches between views.
  const ownView = me.view?.kind === "own";
  const isTeacher = me.role === "teacher";
  const isCanteen = me.role === "canteen_manager";
  const access = accessOf(me);

  // The canteen manager's own view is the canteen section only (plus their own password page).
  // Academy data is already hidden from them in the database; this keeps them off the academy
  // pages too, e.g. the /dashboard landing page after sign-in.
  if (isCanteen && ownView) {
    const path = (await headers()).get("x-pathname") ?? "";
    const key = pageKeyForPath(path);
    const allowed = path === "/canteen" || path.startsWith("/canteen/") || path === "/account" || path.startsWith("/account/")
      || path.startsWith("/view") || (key !== null && me.views.some((v) => v.kind === "role" && v.role && (v.role.is_super || (v.role.pages ?? []).includes(key))));
    if (!allowed) redirect("/canteen");
  }
  const roleName = me.is_owner && !ownView ? `Owner · ${me.view?.label ?? "Super Admin"}` : me.view?.label ?? "No access set";
  const readOnly = access.readOnly;
  const home = homeFor(access, me);
  const views = me.views.map((v) => ({ key: v.key, label: v.label + (v.role?.read_only ? " (view only)" : "") }));
  const initials = me.full_name.split(" ").map((p: string) => p[0]).slice(0, 2).join("");

  return (
    <div className="shell">
      <PortalNav home={home} bar={<ViewPicker views={views} current={me.view?.key ?? null} compact />}>
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

        <ViewPicker views={views} current={me.view?.key ?? null} />

        {ownView && isCanteen ? (
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
        ) : ownView ? (
          <>
            <div className="navlbl">Overview</div>
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/roster">Class Schedule</NavLink>
            {isTeacher && <NavLink href="/attendance">Attendance</NavLink>}
            <NavLink href="/test-marks">Test marks</NavLink>
            <NavLink href="/course-materials">Course materials</NavLink>
            <NavLink href="/homework">Homework</NavLink>
            {isTeacher && <NavLink href="/announcements">Announcements</NavLink>}
            {(isTeacher || me.role === "student") && <NavLink href="/appointments">Appointments</NavLink>}
            {isTeacher && <NavLink href="/mock-exams">Mock exams</NavLink>}
            <NavLink href="/reports">Reports</NavLink>
          </>
        ) : (
          // An access role's pages (Academy > Access).
          ADMIN_GROUPS.map((g) => {
            const pages = PAGES.filter((p) => p.group === g && p.key !== "canteen" && canOpen(access, p.key));
            if (!pages.length) return null;
            return (
              <div key={g} style={{ display: "contents" }}>
                <div className="navlbl">{g}</div>
                {pages.map((p) => <NavLink key={p.key} href={p.href}>{p.label}</NavLink>)}
              </div>
            );
          })
        )}

        {/* The canteen is a separate business: its own boxed, differently coloured group at the end. */}
        {!ownView && canOpen(access, "canteen") && (
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
        )}

        <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          {/* On phones the page headers hide their theme switch to save room; it lives here instead. */}
          <div className="nav-theme"><ThemeToggle /></div>
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
              <div className="sub" style={{ fontSize: 10.5 }}>{me.impersonation ? `Viewed by ${me.impersonation.adminName}` : user.email}</div>
            </div>
          </div>
          {/* Same outlined button style as Sign out, so it's easy to spot. */}
          <div style={{ padding: "0 8px 8px" }}>
            <a className="btn ghost" href="/account" style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>
              Change password
            </a>
          </div>
          <form action={signOut} style={{ padding: "0 8px" }}>
            <button className="btn ghost" type="submit" style={{ width: "100%", justifyContent: "center", fontSize: 12 }}>
              Sign out
            </button>
          </form>
        </div>
      </PortalNav>

      <div className="main">
        {me.impersonation && (
          <div className="viewas-bar" role="note">
            <span>
              <b>Viewing as {me.full_name}</b> ({me.views.find((v) => v.kind === "own")?.label ?? me.view?.label ?? me.role}).
              {" "}You see exactly what they see. Nothing can be changed while viewing as them.
            </span>
            <form action={stopViewAs}>
              <button className="btn" type="submit" style={{ fontSize: 12, padding: "6px 12px" }}>Stop viewing as</button>
            </form>
          </div>
        )}
        {readOnly && !me.impersonation && (
          <div className="viewonly-bar" role="note">
            <b>View only.</b> You are viewing as {me.view?.label}: you can open these pages but can&apos;t change anything.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
