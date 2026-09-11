import { createClient } from "@/lib/supabase/server";
import { dhakaToday } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import AdminDashboard from "./AdminDashboard";
import TeacherDashboard from "./TeacherDashboard";
import MyAnnouncements from "../announcements/MyAnnouncements";
import { markSeenAndGetAcks } from "../announcements/receipts";

export const dynamic = "force-dynamic";

const ANN_SELECT =
  "id, title, body, urgency, scope, status, requires_ack, publish_at, expires_at, published_at, " +
  "announcement_target(class_group_id, class_level_id, class_group(subject(name, level), batch_name), class_level(name, programme(name))), " +
  "announcement_attachment(id, file_path, filename)";

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

  // Student / guardian: aggregate published announcements from every class they're
  // enrolled in (RLS on `announcement` already scopes this to the viewer's own classes
  // plus academy-wide notices — no extra filtering needed here).
  const { data: announcements } = await supabase
    .from("announcement")
    .select(ANN_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const acknowledgedIds = await markSeenAndGetAcks(supabase, (announcements ?? []).map((a: any) => a.id));

  return (
    <>
      <header className="top">
        <h1>Welcome{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}</h1>
        <div className="sub">{dhakaToday()}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel" style={{ padding: 18 }}>
          <div className="sub">
            Fees and receipts for your own account are on the way. For now, please reach the
            academy directly for anything you need.
          </div>
        </div>
        <div>
          <div className="lbl" style={{ margin: "4px 0 10px" }}>Announcements</div>
          <MyAnnouncements announcements={(announcements ?? []) as any[]} acknowledgedIds={acknowledgedIds} />
        </div>
      </div>
    </>
  );
}
