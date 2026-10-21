import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import AccountsAdmin from "./AccountsAdmin";
import { requirePage } from "@/lib/require-page";
import { accessOf, actsAsAdmin, canOpen } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requirePage("accounts");
  const supabase = await createClient();
  const { me } = await getViewer();

  if (!actsAsAdmin(me, "accounts")) redirect("/dashboard");

  const [{ data: teachers }, { data: students }, { data: accounts }, { data: roleData }, { data: linked }] = await Promise.all([
    supabase.from("teacher").select("id, full_name").is("app_user_id", null).eq("active", true).order("full_name"),
    supabase
      .from("student")
      .select("id, full_name, reg_no, email")
      .is("app_user_id", null)
      .in("status", ["applicant", "active", "on_hold"])
      .order("full_name"),
    supabase.from("app_user").select("id, full_name, email, role, is_owner, active, app_user_role(role_id)").order("created_at", { ascending: false }),
    supabase.from("admin_role").select("id, name, is_super, read_only").order("sort_order").order("name"),
    supabase.from("teacher").select("app_user_id").not("app_user_id", "is", null),
  ]);
  const teacherLogins = new Set(((linked ?? []) as any[]).map((t) => t.app_user_id as string));
  const canManageAccess = canOpen(accessOf(me), "access");

  return (
    <>
      <header className="top">
        <h1>Accounts</h1>
        <div className="sub">Create teacher, student and canteen logins, and manage existing accounts. Admin logins are created on Access; access roles can be changed below.</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AccountsAdmin
          teachersWithoutLogin={(teachers ?? []).map((t: any) => ({ id: t.id, label: t.full_name }))}
          studentsWithoutLogin={(students ?? []).map((s: any) => ({ id: s.id, label: `${s.full_name} (${s.reg_no})`, email: s.email }))}
          accounts={((accounts ?? []) as any[]).map(({ app_user_role, ...a }) => ({
            ...a,
            role_ids: ((app_user_role ?? []) as { role_id: string }[]).map((x) => x.role_id),
            is_teacher: teacherLogins.has(a.id),
          }))}
          isOwner={!!me?.is_owner}
          roles={(roleData ?? []) as any[]}
          canManageAccess={canManageAccess}
          meId={me?.id ?? ""}
          canViewAs={!!me && !me.impersonation && (me.is_owner || me.roles.some((r) => r.is_super && !r.read_only))}
        />
      </div>
    </>
  );
}
