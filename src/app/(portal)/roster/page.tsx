import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import RosterAdmin from "./RosterAdmin";
import ScheduleView from "./ScheduleView";
import { myStudentIds } from "../announcements/receipts";

export const dynamic = "force-dynamic";

// Normalizes a class_slot row (which may point at either a subject class_group or a
// junior class_level) into the flat shape ScheduleView needs — including a subjectId and
// teacherId so the schedule can be filtered by either one.
function slotInfo(row: any) {
  if (row.class_group) {
    const s = row.class_group.subject;
    const name = s?.name ?? "Subject";
    const level = s?.level ? ` (${String(s.level).toUpperCase()})` : "";
    const subjectLabel = `${name}${level}`;
    return {
      title: `${subjectLabel} — Batch ${row.class_group.batch_name}`,
      teacherId: row.class_group.teacher_id ?? row.class_group.teacher?.id ?? null,
      teacherName: row.class_group.teacher?.full_name ?? "—",
      subjectId: row.class_group.subject_id ?? s?.id ?? null,
      subjectLabel,
    };
  }
  if (row.class_level) {
    const prog = row.class_level.programme?.name ?? "";
    return {
      title: `${row.class_level.name}${prog ? ` (${prog})` : ""}`,
      teacherId: row.teacher_id ?? row.teacher?.id ?? null,
      teacherName: row.teacher?.full_name ?? "—",
      subjectId: null,
      subjectLabel: null,
    };
  }
  return { title: "—", teacherId: null, teacherName: "—", subjectId: null, subjectLabel: null };
}

export default async function RosterPage() {
  const supabase = await createClient();
  const { me } = await getViewer();

  const isAdmin = me?.role === "admin";
  const isStudentOrGuardian = me?.role === "student" || me?.role === "guardian";

  const [{ data: slots }, adminData, myScope] = await Promise.all([
    supabase
      .from("class_slot")
      .select(
        `id, weekday, start_time, end_time, room, capacity, class_group_id, class_level_id, teacher_id,
         class_group(id, batch_name, subject_id, subject(id, name, level), teacher_id, teacher(id, full_name)),
         class_level(id, name, programme(code, name)),
         teacher:teacher_id(id, full_name)`
      )
      .order("weekday")
      .order("start_time"),
    isAdmin
      ? Promise.all([
          supabase
            .from("subject")
            .select("id, name, level, programme:programme_id(code, name)")
            .eq("active", true)
            .order("name"),
          supabase.from("class_level").select("id, name, programme(code, name)").order("sort_order"),
          supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
          supabase.from("teacher_subject").select("teacher_id, subject_id").eq("active", true),
        ])
      : Promise.resolve(null),
    // A student/guardian only ever sees the classes they're actually enrolled in — every
    // active O/A Level class_group from their enrolments, plus their own class_level for
    // Junior (which has no per-subject class_group at all).
    isStudentOrGuardian
      ? (async () => {
          const studentIds = await myStudentIds(supabase);
          if (studentIds.length === 0) return { classGroupIds: new Set<string>(), classLevelIds: new Set<string>() };
          const [{ data: enrolments }, { data: students }] = await Promise.all([
            supabase.from("enrolment").select("class_group_id").eq("status", "active").in("student_id", studentIds),
            supabase.from("student").select("class_level_id").in("id", studentIds),
          ]);
          return {
            classGroupIds: new Set(((enrolments ?? []) as any[]).map((e) => e.class_group_id).filter(Boolean)),
            classLevelIds: new Set(((students ?? []) as any[]).map((s) => s.class_level_id).filter(Boolean)),
          };
        })()
      : Promise.resolve(null),
  ]);

  let rows = (slots ?? []) as any[];
  if (isStudentOrGuardian && myScope) {
    rows = rows.filter(
      (r) =>
        (r.class_group_id && myScope.classGroupIds.has(r.class_group_id)) ||
        (r.class_level_id && myScope.classLevelIds.has(r.class_level_id))
    );
  }
  const scheduleRows = rows.map((r) => {
    const info = slotInfo(r);
    return {
      id: r.id,
      weekday: r.weekday,
      start_time: r.start_time,
      end_time: r.end_time,
      room: r.room,
      title: info.title,
      teacherId: info.teacherId,
      teacherName: info.teacherName,
      subjectId: info.subjectId,
      subjectLabel: info.subjectLabel,
    };
  });

  return (
    <>
      <header className="top">
        <h1>Class Schedule</h1>
        <div className="sub">
          Weekly class timing — {isAdmin ? "admin managed" : isStudentOrGuardian ? "your enrolled classes only" : "read only"}
        </div>
        <div className="spacer" />
        <span className="no-print"><ThemeToggle /></span>
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {isAdmin && adminData && (
          <div className="no-print">
            <RosterAdmin
              slots={rows.map((r) => ({
                id: r.id,
                weekday: r.weekday,
                start_time: r.start_time,
                end_time: r.end_time,
                room: r.room,
                capacity: r.capacity,
                teacher_id: r.teacher_id,
                isJunior: !!r.class_level_id,
                label: slotInfo(r).title,
              }))}
              subjects={(adminData[0].data ?? []) as any[]}
              classLevels={(adminData[1].data ?? []) as any[]}
              teachers={(adminData[2].data ?? []) as any[]}
              teacherSubjects={(adminData[3].data ?? []) as any[]}
            />
          </div>
        )}

        <ScheduleView rows={scheduleRows} />
      </div>
    </>
  );
}
