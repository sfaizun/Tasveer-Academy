import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import { dhakaToday } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import AdminDashboard from "./AdminDashboard";
import TeacherDashboard from "./TeacherDashboard";
import MyAnnouncements from "../announcements/MyAnnouncements";
import { markSeenAndGetAcks } from "../announcements/receipts";
import { feedOf } from "../announcements/shared";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin } from "@/lib/access";
import ApptCard from "../appointments/ApptCard";
import { StudentAttendanceCard } from "../attendance/AttendanceCards";

export const dynamic = "force-dynamic";

const ANN_SELECT =
  "id, title, body, urgency, scope, status, requires_ack, publish_at, expires_at, published_at, " +
  "announcement_target(class_group_id, class_level_id, class_group(subject(name, level), batch_name), class_level(name, programme(name))), " +
  "announcement_attachment(id, file_path, filename)";

export default async function Dashboard() {
  await requirePage("dashboard");
  const supabase = await createClient();
  const { me } = await getViewer();
  const academyAccess = actsAsAdmin(me, "dashboard");

  // The view in use decides: an access role with the Dashboard sees the academy dashboard, a
  // teacher's own view their own dashboard.
  if (academyAccess) return <AdminDashboard apptUserId={me && actsAsAdmin(me, "appointments") ? me.id : null} attendance={!!me && actsAsAdmin(me, "attendance")} />;
  if (me?.role === "teacher") return <TeacherDashboard appUserId={me.id} fullName={me.full_name} />;

  // Student / guardian: published announcements from every class they're enrolled in (RLS on
  // `announcement` already scopes this to the viewer's own classes plus academy-wide notices).
  // Ended ones stay published and readable; the dashboard shows the live ones and the 3 latest
  // ended ones, with a link to the full list.
  const { data: announcements } = await supabase
    .from("announcement")
    .select(ANN_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  // The student's own record, or a guardian's children (RLS limits this to them).
  const { data: kidRows } = me?.role === "student" || me?.role === "guardian"
    ? await supabase.from("student").select("id, full_name").order("full_name")
    : { data: [] as { id: string; full_name: string }[] };
  const kids = (kidRows ?? []) as { id: string; full_name: string }[];

  const shown = feedOf((announcements ?? []) as any[], 3).list;
  const acknowledgedIds = await markSeenAndGetAcks(supabase, shown.map((a: any) => a.id));

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
        {kids.map((k) => (
          <StudentAttendanceCard key={k.id} studentId={k.id} title={kids.length > 1 || me?.role === "guardian" ? `Attendance: ${k.full_name}` : "My attendance"} />
        ))}
        {me?.role === "student" && <ApptCard mode="student" appUserId={me.id} />}
        <div>
          <div className="lbl" style={{ margin: "4px 0 10px" }}>Announcements</div>
          <MyAnnouncements announcements={(announcements ?? []) as any[]} acknowledgedIds={acknowledgedIds} pastLimit={3} />
        </div>
      </div>
    </>
  );
}
