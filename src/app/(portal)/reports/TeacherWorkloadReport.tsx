import { createClient } from "@/lib/supabase/server";
import ExportCsvButton from "@/components/ExportCsvButton";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Active classes, distinct enrolled students, and scheduled weekly hours per teacher.
 * Weekly hours come from every class_slot row currently on the Class Schedule — this app
 * doesn't filter that page by active_from/active_to either, so a slot's presence there is
 * treated as "part of the current schedule" here too. A slot's teacher is either its own
 * teacher_id (a Junior slot) or its class_group's teacher_id (an O/A Level subject class).
 */
export default async function TeacherWorkloadReport({
  supabase,
  onlyTeacherId,
  title = "Teacher workload",
  subtitle = "Active classes, enrolled students, and scheduled weekly hours per teacher",
}: {
  supabase: Supabase;
  onlyTeacherId?: string;
  title?: string;
  subtitle?: string;
}) {
  const [{ data: teachers }, { data: classGroups }, { data: activeEnrolments }, { data: slots }] = await Promise.all([
    supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("class_group").select("id, teacher_id").eq("active", true),
    supabase.from("enrolment").select("teacher_id, student_id").eq("status", "active"),
    supabase.from("class_slot").select("start_time, end_time, teacher_id, class_group(teacher_id)"),
  ]);

  const rows = ((teachers ?? []) as any[])
    .filter((t) => !onlyTeacherId || t.id === onlyTeacherId)
    .map((t) => {
      const classes = ((classGroups ?? []) as any[]).filter((cg) => cg.teacher_id === t.id).length;
      const students = new Set(
        ((activeEnrolments ?? []) as any[]).filter((e) => e.teacher_id === t.id).map((e) => e.student_id)
      ).size;
      const minutes = ((slots ?? []) as any[])
        .filter((sl) => (sl.teacher_id ?? sl.class_group?.teacher_id) === t.id)
        .reduce((sum, sl) => sum + Math.max(0, timeToMinutes(sl.end_time) - timeToMinutes(sl.start_time)), 0);
      return { teacher_id: t.id as string, full_name: t.full_name as string, classes, students, hours: minutes / 60 };
    });

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  return (
    <details className="panel collapsible" open>
      <summary className="phead">
        <div className="ptitle">{title}</div>
        <div className="sub">{subtitle}</div>
        <div className="spacer" />
        <ExportCsvButton
          filename="teacher-workload"
          headers={["Teacher", "Active classes", "Enrolled students", "Weekly hours"]}
          rows={rows.map((r) => [r.full_name, r.classes, r.students, Number(r.hours.toFixed(1))])}
        />
      </summary>
      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Teacher</th>
              <th className="n">Active classes</th>
              <th className="n">Enrolled students</th>
              <th className="n">Weekly hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teacher_id}>
                <td><b>{r.full_name}</b></td>
                <td className="n mono">{r.classes}</td>
                <td className="n mono">{r.students}</td>
                <td className="n mono">{r.hours.toFixed(1)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="sub">No active class or schedule data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div className="sub" style={{ padding: "0 16px 14px" }}>
          {rows.length} teacher{rows.length === 1 ? "" : "s"} · {totalHours.toFixed(1)} total weekly hours scheduled
          {onlyTeacherId ? "" : " across the academy"}
        </div>
      )}
    </details>
  );
}
