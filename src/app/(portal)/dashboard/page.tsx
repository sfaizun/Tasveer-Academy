import { createClient } from "@/lib/supabase/server";
import { dhakaToday } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import AdminDashboard from "./AdminDashboard";
import TeacherDashboard from "./TeacherDashboard";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("app_user")
    .select("id, full_name, role")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle();

  if (me?.role === "admin") return <AdminDashboard />;
  if (me?.role === "teacher") return <TeacherDashboard appUserId={me.id} fullName={me.full_name} />;

  return (
    <>
      <header className="top">
        <h1>Welcome{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}</h1>
        <div className="sub">{dhakaToday()}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content">
        <div className="panel" style={{ padding: 18 }}>
          <div className="sub">
            Your dashboard — fees, receipts and announcements for your own account — is on the
            way. For now, please reach the academy directly for anything you need.
          </div>
        </div>
      </div>
    </>
  );
}
