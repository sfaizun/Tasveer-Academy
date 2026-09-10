import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import AdminAnnouncements from "./AdminAnnouncements";
import TeacherAnnouncements from "./TeacherAnnouncements";
import MyAnnouncements from "./MyAnnouncements";

export const dynamic = "force-dynamic";

const ANN_SELECT =
  "id, title, body, urgency, scope, status, publish_at, expires_at, published_at, created_at, decision_note, " +
  "announcement_target(class_group_id, class_level_id, class_group(subject(name, level), batch_name), class_level(name, programme(name)))";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("app_user")
    .select("id, role, full_name")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle();

  const isAdmin = me?.role === "admin";
  const isTeacher = me?.role === "teacher";

  if (isAdmin) {
    const [{ data: pending }, { data: recent }, { data: classGroups }, { data: classLevels }] = await Promise.all([
      supabase.from("announcement").select(ANN_SELECT).eq("status", "pending_review").order("created_at"),
      supabase.from("announcement").select(ANN_SELECT).neq("status", "pending_review").order("created_at", { ascending: false }).limit(40),
      supabase.from("class_group").select("id, batch_name, active, subject(name, level, programme(name))").eq("active", true),
      supabase.from("class_level").select("id, name, programme(code, name)").order("sort_order"),
    ]);

    return (
      <>
        <header className="top">
          <h1>Announcements</h1>
          <div className="sub">Create, publish, and review teacher requests</div>
          <div className="spacer" />
          <ThemeToggle />
        </header>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AdminAnnouncements
            pending={(pending ?? []) as any[]}
            recent={(recent ?? []) as any[]}
            classGroups={(classGroups ?? []) as any[]}
            classLevels={(classLevels ?? []) as any[]}
          />
        </div>
      </>
    );
  }

  if (isTeacher) {
    const { data: teacher } = await supabase
      .from("teacher")
      .select("id")
      .eq("app_user_id", me!.id)
      .maybeSingle();

    const [{ data: myGroups }, { data: myRequests }, { data: published }] = await Promise.all([
      teacher ? supabase.from("class_group").select("id, batch_name, active, subject(name, level)").eq("teacher_id", teacher.id).eq("active", true) : Promise.resolve({ data: [] }),
      supabase.from("announcement").select(ANN_SELECT).eq("author_id", me!.id).order("created_at", { ascending: false }),
      supabase.from("announcement").select(ANN_SELECT).eq("status", "published").order("published_at", { ascending: false }),
    ]);

    return (
      <>
        <header className="top">
          <h1>Announcements</h1>
          <div className="sub">Request an announcement for your classes</div>
          <div className="spacer" />
          <ThemeToggle />
        </header>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <TeacherAnnouncements
            classGroups={(myGroups ?? []) as any[]}
            myRequests={(myRequests ?? []) as any[]}
            published={(published ?? []) as any[]}
            hasTeacherRecord={!!teacher}
          />
        </div>
      </>
    );
  }

  const { data: published } = await supabase
    .from("announcement")
    .select(ANN_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <>
      <header className="top">
        <h1>Announcements</h1>
        <div className="sub">From the academy and your classes</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <MyAnnouncements announcements={(published ?? []) as any[]} />
      </div>
    </>
  );
}
