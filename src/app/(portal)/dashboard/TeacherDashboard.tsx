import { createClient } from "@/lib/supabase/server";
import { dhakaToday } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";

export default async function TeacherDashboard({ appUserId, fullName }: { appUserId: string; fullName: string }) {
  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teacher")
    .select("id, full_name, phone, email, active")
    .eq("app_user_id", appUserId)
    .maybeSingle();

  if (!teacher) {
    return (
      <>
        <header className="top">
          <h1>Dashboard</h1>
          <div className="sub">{dhakaToday()}</div>
          <div className="spacer" />
          <ThemeToggle />
        </header>
        <div className="content">
          <div className="panel" style={{ padding: 18 }}>
            <div className="sub">
              Your account isn&apos;t linked to a teacher record yet — ask an admin to check your invite.
            </div>
          </div>
        </div>
      </>
    );
  }

  const [{ data: subjects }, { data: classGroups }] = await Promise.all([
    supabase
      .from("teacher_subject")
      .select("active, subject(name, level, programme(name))")
      .eq("teacher_id", teacher.id),
    supabase
      .from("class_group")
      .select(
        "id, batch_name, active, subject(name, level, programme(name)), enrolment(id, status, student(id, reg_no, full_name, phone, guardian(full_name, phone, is_primary)))"
      )
      .eq("teacher_id", teacher.id),
  ]);

  const activeSubjects = (subjects ?? []).filter((s: any) => s.active);
  const groups = (classGroups ?? []).filter((g: any) => g.active);

  const totalStudents = new Set(
    groups.flatMap((g: any) => (g.enrolment ?? []).filter((e: any) => e.status === "active").map((e: any) => e.student?.id))
  ).size;

  return (
    <>
      <header className="top">
        <h1>Welcome, {fullName.split(" ")[0]}</h1>
        <div className="sub">{dhakaToday()} · Teacher</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <div className="panel" style={{ padding: "16px 18px" }}>
            <div className="lbl">Subjects taught</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{activeSubjects.length}</div>
          </div>
          <div className="panel" style={{ padding: "16px 18px" }}>
            <div className="lbl">Classes</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{groups.length}</div>
          </div>
          <div className="panel" style={{ padding: "16px 18px" }}>
            <div className="lbl">Students</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{totalStudents}</div>
          </div>
        </div>

        <div className="panel">
          <div className="phead"><div className="ptitle">My subjects</div></div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Programme</th><th>Subject</th><th className="n">Status</th></tr></thead>
              <tbody>
                {(subjects ?? []).map((s: any, i: number) => (
                  <tr key={i}>
                    <td>{s.subject?.programme?.name}</td>
                    <td>{s.subject?.name}{s.subject?.level ? ` (${String(s.subject.level).toUpperCase()})` : ""}</td>
                    <td className="n">
                      {s.active
                        ? <span className="st paid"><span className="dot" />Active</span>
                        : <span className="st over"><span className="dot" />Retired</span>}
                    </td>
                  </tr>
                ))}
                {(subjects ?? []).length === 0 && (
                  <tr><td colSpan={3} className="sub">No subjects mapped to you yet — ask an admin to add this from Subjects &amp; teachers.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {groups.map((g: any) => {
          const roster = (g.enrolment ?? []).filter((e: any) => e.status === "active");
          return (
            <div className="panel" key={g.id}>
              <div className="phead">
                <div className="ptitle">
                  {g.subject?.name}{g.subject?.level ? ` (${String(g.subject.level).toUpperCase()})` : ""} — Batch {g.batch_name}
                </div>
                <div className="sub">{g.subject?.programme?.name}</div>
                <div className="spacer" />
                <div className="sub">{roster.length} student{roster.length === 1 ? "" : "s"}</div>
              </div>
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Reg. no.</th><th>Student</th><th>Student contact</th><th>Guardian</th></tr></thead>
                  <tbody>
                    {roster.map((e: any) => {
                      const g2 = (e.student?.guardian ?? []).find((x: any) => x.is_primary) ?? e.student?.guardian?.[0];
                      return (
                        <tr key={e.id}>
                          <td className="mono">{e.student?.reg_no}</td>
                          <td><b>{e.student?.full_name}</b></td>
                          <td className="sub">{e.student?.phone ?? "—"}</td>
                          <td className="sub">{g2 ? `${g2.full_name} (${g2.phone ?? "—"})` : "—"}</td>
                        </tr>
                      );
                    })}
                    {roster.length === 0 && (
                      <tr><td colSpan={4} className="sub">No students enrolled in this class yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="panel" style={{ padding: 18 }}>
            <div className="sub">
              No classes yet. A class is created the first time a student is enrolled in one of
              your subjects through admission approval.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
