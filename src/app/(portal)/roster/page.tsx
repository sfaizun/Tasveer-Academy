import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import RosterAdmin from "./RosterAdmin";
import { WEEKDAYS, fmtTime } from "./shared";

export const dynamic = "force-dynamic";

function slotLabel(row: any) {
  if (row.class_group) {
    const s = row.class_group.subject;
    const name = s?.name ?? "Subject";
    const level = s?.level ? ` (${String(s.level).toUpperCase()})` : "";
    return { title: `${name}${level} — Batch ${row.class_group.batch_name}`, teacher: row.class_group.teacher?.full_name ?? "—" };
  }
  if (row.class_level) {
    const prog = row.class_level.programme?.name ?? "";
    return { title: `${row.class_level.name}${prog ? ` (${prog})` : ""}`, teacher: row.teacher?.full_name ?? "—" };
  }
  return { title: "—", teacher: "—" };
}

export default async function RosterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("app_user")
    .select("id, role")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle();

  const isAdmin = me?.role === "admin";

  const [{ data: slots }, adminData] = await Promise.all([
    supabase
      .from("class_slot")
      .select(
        `id, weekday, start_time, end_time, room, capacity, class_group_id, class_level_id, teacher_id,
         class_group(id, batch_name, subject(name, level), teacher(full_name)),
         class_level(id, name, programme(code, name)),
         teacher:teacher_id(full_name)`
      )
      .order("weekday")
      .order("start_time"),
    isAdmin
      ? Promise.all([
          supabase
            .from("class_group")
            .select("id, batch_name, active, subject(name, level, programme(name)), teacher(full_name)")
            .eq("active", true),
          supabase.from("class_level").select("id, name, programme(code, name)").order("sort_order"),
          supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
        ])
      : Promise.resolve(null),
  ]);

  const rows = (slots ?? []) as any[];
  const byDay = WEEKDAYS.map((_, wd) => rows.filter((r) => r.weekday === wd));

  return (
    <>
      <header className="top">
        <h1>Roster</h1>
        <div className="sub">Weekly class timing — {isAdmin ? "admin managed" : "read only"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {isAdmin && adminData && (
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
              label: slotLabel(r).title,
            }))}
            classGroups={(adminData[0].data ?? []) as any[]}
            classLevels={(adminData[1].data ?? []) as any[]}
            teachers={(adminData[2].data ?? []) as any[]}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {WEEKDAYS.map((day, wd) => {
            const dayRows = byDay[wd];
            return (
              <div className="panel" key={day}>
                <div className="phead">
                  <div className="ptitle">{day}</div>
                  <div className="sub">{dayRows.length} class{dayRows.length === 1 ? "" : "es"}</div>
                </div>
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Class</th>
                        <th>Teacher</th>
                        <th>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((r) => {
                        const { title, teacher } = slotLabel(r);
                        return (
                          <tr key={r.id}>
                            <td className="mono">{fmtTime(r.start_time)} – {fmtTime(r.end_time)}</td>
                            <td><b>{title}</b></td>
                            <td className="sub">{teacher}</td>
                            <td className="sub">{r.room ?? "—"}</td>
                          </tr>
                        );
                      })}
                      {dayRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="sub">No classes scheduled.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
