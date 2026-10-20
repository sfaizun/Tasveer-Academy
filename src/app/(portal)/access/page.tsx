import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { requirePage } from "@/lib/require-page";
import AccessMatrix, { type RoleRow } from "./AccessMatrix";
import AdminLogins, { type AdminUser } from "./AdminLogins";

export const dynamic = "force-dynamic";

/** Academy > Access (Super Admin only): which pages each admin role can open, and which role
 * each login holds. The database enforces the same access (has_access, can_see_fees). */
export default async function AccessPage() {
  await requirePage("access");
  const { me } = await getViewer();
  const supabase = await createClient();

  const [{ data: roleData }, { data: userData }] = await Promise.all([
    supabase.from("admin_role").select("id, name, pages, is_super, is_system, read_only, sort_order").order("sort_order").order("name"),
    supabase.from("app_user").select("id, full_name, email, is_owner, active, role, app_user_role(role_id)").order("full_name"),
  ]);

  // Admin logins, and any other login holding at least one access role.
  const users: AdminUser[] = ((userData ?? []) as any[])
    .map(({ app_user_role, ...u }) => ({ ...u, role_ids: ((app_user_role ?? []) as { role_id: string }[]).map((x) => x.role_id) }))
    .filter((u) => u.role === "admin" || u.is_owner || u.role_ids.length > 0);
  const roles: RoleRow[] = ((roleData ?? []) as any[]).map((r) => ({
    id: r.id, name: r.name, pages: (r.pages ?? []) as string[], is_super: r.is_super, is_system: r.is_system, read_only: !!r.read_only,
    users: users.filter((u) => u.role_ids.includes(r.id) || (r.is_super && u.is_owner)).length,
  }));

  return (
    <>
      <header className="top">
        <h1>Access</h1>
        <div className="sub">What each admin can see and do</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AccessMatrix roles={roles} />
        <AdminLogins users={users} roles={roles.map((r) => ({ id: r.id, name: r.name, is_super: r.is_super, read_only: r.read_only }))} meId={me?.id ?? ""} />
        <div className="sub">
          Teachers and the canteen manager always keep their own portal; each access role they hold adds a view they
          can switch to from the &ldquo;Viewing as&rdquo; menu. Give roles to any login from Academy &gt; Accounts.
          Students and guardians can&apos;t have an access role.
        </div>
      </div>
    </>
  );
}
