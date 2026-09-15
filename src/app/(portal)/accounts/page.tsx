import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import AccountsAdmin from "./AccountsAdmin";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { me } = await getViewer();

  if (me?.role !== "admin") redirect("/dashboard");

  const [{ data: teachers }, { data: students }, { data: accounts }] = await Promise.all([
    supabase.from("teacher").select("id, full_name").is("app_user_id", null).eq("active", true).order("full_name"),
    supabase
      .from("student")
      .select("id, full_name, reg_no")
      .is("app_user_id", null)
      .in("status", ["applicant", "active", "on_hold"])
      .order("full_name"),
    supabase.from("app_user").select("id, full_name, email, role, is_owner, active").order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <header className="top">
        <h1>Accounts</h1>
        <div className="sub">Create teacher and student logins, and manage existing accounts</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AccountsAdmin
          teachersWithoutLogin={(teachers ?? []).map((t: any) => ({ id: t.id, label: t.full_name }))}
          studentsWithoutLogin={(students ?? []).map((s: any) => ({ id: s.id, label: `${s.full_name} (${s.reg_no})` }))}
          accounts={(accounts ?? []) as any[]}
          isOwner={!!me?.is_owner}
        />
      </div>
    </>
  );
}
