import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import BookForm from "./BookForm";
import ApptList from "./ApptList";
import { apptMode, apptReadOnly, loadAppointments, loadBookOptions, myTeacherId } from "./load";

export const dynamic = "force-dynamic";

/** Appointments between a student and a teacher or the office.
 * Office staff (Appointments page) book for any student and see every appointment. A teacher books
 * with their own students and sees their own. A student requests one with a teacher or the office;
 * it waits for the teacher or office to accept. Either side can move or cancel with a reason. */
export default async function AppointmentsPage() {
  await requirePage("appointments");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const mode = apptMode(me);
  if (!mode) redirect("/dashboard");
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const readOnly = apptReadOnly(me, mode);

  const teacher = mode === "teacher" ? await myTeacherId(supabase, me.id) : null;
  const [upcoming, past, students] = await Promise.all([
    loadAppointments(supabase, mode, true, teacher?.id ?? null),
    loadAppointments(supabase, mode, false, teacher?.id ?? null, 60),
    readOnly ? Promise.resolve([]) : loadBookOptions(supabase, mode, teacher?.id ?? null),
  ]);

  const waiting = mode === "student" ? [] : upcoming.filter((r) => r.status === "pending" && r.can_handle);
  const rest = mode === "student" ? upcoming : upcoming.filter((r) => !(r.status === "pending" && r.can_handle));
  const showStudent = mode !== "student";

  return (
    <>
      <header className="top">
        <h1>Appointments</h1>
        <div className="sub">{mode === "office" ? "Office" : mode === "teacher" ? "Teacher" : "Student"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {waiting.length > 0 && (
          <div className="panel" style={{ borderLeft: "3px solid var(--warn)" }}>
            <div className="phead"><div className="ptitle">Waiting for your reply ({waiting.length})</div></div>
            <ApptList rows={waiting} today={today} showStudent={showStudent} studentSide={false} readOnly={readOnly} empty="" />
          </div>
        )}

        {!readOnly && (
          <div className="panel">
            <div className="phead"><div className="ptitle">{mode === "student" ? "Request an appointment" : "Book an appointment"}</div></div>
            <div style={{ padding: "14px 18px" }}>
              {students.length === 0 ? (
                <div className="sub">
                  {mode === "teacher" ? "You have no current students to book with." : mode === "student" ? "You have no current subjects yet. Please contact the office." : "No active students."}
                </div>
              ) : (
                <BookForm mode={mode} students={students} teacherName={teacher?.full_name} today={today} />
              )}
            </div>
          </div>
        )}

        <div className="panel">
          <div className="phead"><div className="ptitle">Upcoming</div></div>
          <ApptList rows={rest} today={today} showStudent={showStudent} studentSide={mode === "student"} readOnly={readOnly}
            empty={waiting.length ? "Nothing else coming up." : "No upcoming appointments."} />
        </div>

        <details className="panel">
          <summary className="phead" style={{ cursor: "pointer" }}><div className="ptitle">Past, declined and cancelled ({past.length})</div></summary>
          <ApptList rows={past} today={today} showStudent={showStudent} studentSide={mode === "student"} readOnly empty="Nothing here yet." />
        </details>
      </div>
    </>
  );
}
