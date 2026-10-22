import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO, fmtDate, fmtDateTime } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin, viewReadOnly } from "@/lib/access";
import Sheet from "./Sheet";
import { classTitle, clock, type AttClass } from "./shared";

export const dynamic = "force-dynamic";

const WEEKDAY = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Attendance by class schedule. Every class running on the chosen day (today by default) with
 * its student list; mark each Present or Absent and save. Office and Student Admin: every class,
 * any day up to today. A teacher: their own classes; can save only on the day of the class. */
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePage("attendance");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const sp = await searchParams;
  let date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  if (date > today) date = today;

  const isAdmin = actsAsAdmin(me, "attendance");
  const readOnly = isAdmin && viewReadOnly(me);
  const { data } = await supabase.rpc("fn_attendance_day", { p_date: date, p_mine: !isAdmin });
  const classes = (data ?? []) as AttClass[];
  const taken = classes.filter((c) => c.session_id).length;
  const notTaken = classes.length - taken;

  return (
    <>
      <header className="top">
        <h1>Attendance</h1>
        <div className="sub">{WEEKDAY(date)}, {fmtDate(date)}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a className="btn ghost" href={`/attendance?date=${shift(date, -1)}`} style={{ fontSize: 12, padding: "8px 12px" }}>← Previous day</a>
          <input type="date" name="date" defaultValue={date} max={today} aria-label="Date"
            style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px", fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit" }} />
          <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Show</button>
          {date < today && <a className="btn ghost" href={date === shift(today, -1) ? "/attendance" : `/attendance?date=${shift(date, 1)}`} style={{ fontSize: 12, padding: "8px 12px" }}>Next day →</a>}
          {date !== today && <a className="btn ghost" href="/attendance" style={{ fontSize: 12, padding: "8px 12px" }}>Today</a>}
        </form>

        {classes.length > 0 && (
          <div className="sub">
            {classes.length} class{classes.length === 1 ? "" : "es"} · {taken} taken
            {notTaken > 0 && <> · <b style={{ color: "var(--warn)" }}>{notTaken} not taken yet</b></>}
            {!isAdmin && date !== today && " · You can only change attendance on the day of the class; the office can change past days."}
          </div>
        )}

        {classes.length === 0 && (
          <div className="panel" style={{ padding: 18 }}>
            <div className="sub">
              {isAdmin ? "No classes on the schedule for this day." : "You have no classes on the schedule for this day."}
            </div>
          </div>
        )}

        {classes.map((c) => {
          const absent = c.students.filter((s) => s.status === "absent").length;
          return (
            <details key={c.slot_id} className="panel" open={!c.session_id && c.can_edit && !readOnly}>
              <summary className="phead" style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="mono" style={{ fontWeight: 600 }}>{clock(c.start_time)} to {clock(c.end_time)}</span>
                <span className="ptitle">{classTitle(c)}</span>
                <span className="sub">
                  {isAdmin && c.teacher_name ? `${c.teacher_name} · ` : ""}{c.room ? `Room ${c.room.replace(/^room\s*/i, "")} · ` : ""}{c.students.length} student{c.students.length === 1 ? "" : "s"}
                </span>
                <span style={{ flex: 1 }} />
                {c.session_id
                  ? <span className="st paid"><span className="dot" />Taken{absent ? ` · ${absent} absent` : ""}</span>
                  : <span className="st past"><span className="dot" />Not taken</span>}
              </summary>
              {c.session_id && (
                <div className="sub" style={{ padding: "0 18px 8px" }}>
                  Taken by {c.taken_by ?? "-"}, {fmtDateTime(c.taken_at)}
                  {c.updated_at && c.taken_at && c.updated_at !== c.taken_at && c.updated_by ? ` · last changed by ${c.updated_by}, ${fmtDateTime(c.updated_at)}` : ""}
                </div>
              )}
              <Sheet cls={c} date={date} readOnly={readOnly} />
            </details>
          );
        })}
      </div>
    </>
  );
}
