import { createClient } from "@/lib/supabase/server";
import { StatusTag, apptDay, apptTime, withLabel } from "./shared";
import { loadAppointments, myTeacherId, type ApptMode } from "./load";

/** Dashboard panel: the next appointments, with a count of requests waiting for a reply. */
export default async function ApptCard({ mode, appUserId }: { mode: ApptMode; appUserId: string }) {
  const supabase = await createClient();
  const teacher = mode === "teacher" ? await myTeacherId(supabase, appUserId) : null;
  const rows = await loadAppointments(supabase, mode, true, teacher?.id ?? null, 100);
  const waiting = mode === "student" ? 0 : rows.filter((r) => r.status === "pending" && r.can_handle).length;
  const shown = rows.slice(0, 5);

  return (
    <div className="panel">
      <div className="phead" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="ptitle">Upcoming appointments</div>
        {waiting > 0 && <span className="st past"><span className="dot" />{waiting} waiting for your reply</span>}
        <div style={{ flex: 1 }} />
        <a href="/appointments" style={{ fontSize: 13 }}>{mode === "student" ? "Request or see all" : "Book or see all"} →</a>
      </div>
      {shown.length === 0 ? (
        <div className="sub" style={{ padding: "14px 18px" }}>No upcoming appointments.</div>
      ) : (
        shown.map((r) => (
          <div key={r.id} style={{ padding: "11px 18px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, minWidth: 120 }}>{apptDay(r.starts_at)}</span>
            <span className="mono" style={{ minWidth: 70 }}>{apptTime(r.starts_at)}</span>
            <span style={{ fontSize: 13.5, flex: "1 1 220px" }}>
              {mode !== "student" && <b>{r.student_name} </b>}
              {mode !== "student" ? "with " : "With "}{withLabel(r)}
            </span>
            <StatusTag row={r} />
          </div>
        ))
      )}
      {rows.length > shown.length && (
        <div className="sub" style={{ padding: "8px 18px 12px", borderTop: "1px solid var(--line)" }}>
          and {rows.length - shown.length} more on the Appointments page
        </div>
      )}
    </div>
  );
}
