import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { requirePage } from "@/lib/require-page";
import AccessMatrix, { type RoleRow } from "./AccessMatrix";
import AdminLogins, { type AdminUser } from "./AdminLogins";

export const dynamic = "force-dynamic";

/** Academy > Access (Super Admin only): which pages each admin role can open, and which role
 * each admin login has. The database enforces the same access (has_access, can_see_fees). */
export default async function AccessPage() {
  await requirePage("access");
  const { me } = await getViewer();
  const supabase = await createClient();

  const [{ data: roleData }, { data: userData }] = await Promise.all([
    supabase.from("admin_role").select("id, name, pages, is_super, is_system, sort_order").order("sort_order").order("name"),
    supabase.from("app_user").select("id, full_name, email, is_owner, active, admin_role_id").eq("role", "admin").order("full_name"),
  ]);

  const users = (userData ?? []) as AdminUser[];
  const roles: RoleRow[] = ((roleData ?? []) as any[]).map((r) => ({
    id: r.id, name: r.name, pages: (r.pages ?? []) as string[], is_super: r.is_super, is_system: r.is_system,
    users: users.filter((u) => u.admin_role_id === r.id || (r.is_super && u.is_owner && !u.admin_role_id)).length,
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
        <AdminLogins users={users} roles={roles.map((r) => ({ id: r.id, name: r.name }))} meId={me?.id ?? ""} />
        <div className="sub">
          Teachers, students, guardians and the canteen manager keep their own fixed access and are not set here.
        </div>
      </div>
    </>
  );
}
