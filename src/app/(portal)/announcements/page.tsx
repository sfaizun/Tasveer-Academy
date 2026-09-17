import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import AdminAnnouncements from "./AdminAnnouncements";
import TeacherAnnouncements from "./TeacherAnnouncements";
import MyAnnouncements from "./MyAnnouncements";
import { markSeenAndGetAcks } from "./receipts";

export const dynamic = "force-dynamic";

const ANN_SELECT =
  "id, title, body, urgency, scope, status, requires_ack, publish_at, expires_at, published_at, created_at, decision_note, " +
  "announcement_target(class_group_id, class_level_id, class_group(subject(name, level), batch_name), class_level(name, programme(name))), " +
  "announcement_attachment(id, file_path, filename)";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { me } = await getViewer();

  const isAdmin = me?.role === "admin";
  const isTeacher = me?.role === "teacher";

  // Flip any "published" announcement whose "visible until" time has passed to
  // "unpublished" before anyone's list is read, so an expired notice reads as taken
  // down everywhere (admin's Active/Inactive split, the teacher/student feeds, and the
  // dashboard panel) rather than lingering as "live" past its own end time.
  await supabase.rpc("fn_expire_announcements");

  if (isAdmin) {
    const [{ data: pending }, { data: active }, { data: inactive }, { data: subjects }, { data: classLevels }, { data: teachers }, { data: teacherSubjects }] = await Promise.all([
      supabase.from("announcement").select(ANN_SELECT).eq("status", "pending_review").order("created_at"),
      supabase.from("announcement").select(ANN_SELECT).eq("status", "published").order("published_at", { ascending: false }).limit(200),
      supabase.from("announcement").select(ANN_SELECT).in("status", ["unpublished", "declined"]).order("created_at", { ascending: false }).limit(200),
      supabase.from("subject").select("id, name, level, programme:programme_id(code, name)").eq("active", true).order("name"),
      supabase.from("class_level").select("id, name, programme(code, name)").order("sort_order"),
      supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
      supabase.from("teacher_subject").select("teacher_id, subject_id").eq("active", true),
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
            active={(active ?? []) as any[]}
            inactive={(inactive ?? []) as any[]}
            subjects={(subjects ?? []) as any[]}
            classLevels={(classLevels ?? []) as any[]}
            teachers={(teachers ?? []) as any[]}
            teacherSubjects={(teacherSubjects ?? []) as any[]}
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

    const [{ data: mySubjects }, { data: myRequests }, { data: published }] = await Promise.all([
      teacher
        ? supabase
            .from("teacher_subject")
            .select("subject_id, subject:subject_id(id, name, level, programme:programme_id(code, name))")
            .eq("teacher_id", teacher.id)
            .eq("active", true)
        : Promise.resolve({ data: [] }),
      supabase.from("announcement").select(ANN_SELECT).eq("author_id", me!.id).order("created_at", { ascending: false }),
      supabase.from("announcement").select(ANN_SELECT).eq("status", "published").order("published_at", { ascending: false }),
    ]);

    const mySubjectRows = ((mySubjects ?? []) as any[]).map((ts) => ts.subject).filter(Boolean);

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
            subjects={mySubjectRows}
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

  const acknowledgedIds = await markSeenAndGetAcks(supabase, (published ?? []).map((a: any) => a.id));

  return (
    <>
      <header className="top">
        <h1>Announcements</h1>
        <div className="sub">From the academy and your classes</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <MyAnnouncements announcements={(published ?? []) as any[]} acknowledgedIds={acknowledgedIds} />
      </div>
    </>
  );
}
