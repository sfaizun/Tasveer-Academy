/** Shared by the Appointments page and the dashboard cards. */

export type ApptRow = {
  id: string;
  student_id: string;
  student_name: string;
  reg_no: string | null;
  with_office: boolean;
  teacher_id: string | null;
  teacher_name: string | null;
  subject_name: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  note: string | null;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  booked_as: "student" | "teacher" | "office";
  booked_by_name: string | null;
  response_note: string | null;
  cancel_reason: string | null;
  previous_starts_at: string | null;
  reschedule_reason: string | null;
  rescheduled_by_name: string | null;
  can_handle: boolean;
  can_change: boolean;
};

export type BookPair = { teacher_id: string; teacher_name: string; subject_id: string; subject_name: string };
export type BookStudent = { id: string; name: string; reg_no: string | null; pairs: BookPair[] };

export const REASONS: { value: string; label: string }[] = [
  { value: "financial", label: "Financial" },
  { value: "disciplinary", label: "Disciplinary" },
  { value: "add_drop_subject", label: "Add or drop a subject" },
  { value: "other", label: "Other" },
];
export const reasonLabel = (v: string | null) => REASONS.find((r) => r.value === v)?.label ?? "";

export const LENGTHS = [15, 30, 45, 60, 90];

const TZ = "Asia/Dhaka";

/** "Mon, 26 Oct 2026" */
export function apptDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

/** "6:30 PM" */
export function apptTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
}

/** "2026-10-26" and "18:30" in Dhaka time, for date and time inputs. */
export function apptInputs(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export const apptMinutes = (r: Pick<ApptRow, "starts_at" | "ends_at">) =>
  Math.round((new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 60000);

/** What the appointment is with: "Ashik Hossain · Mathematics B" or "Office · Financial". */
export const withLabel = (r: ApptRow) =>
  r.with_office ? `Office · ${reasonLabel(r.reason)}` : `${r.teacher_name ?? "Teacher"}${r.subject_name ? ` · ${r.subject_name}` : ""}`;

/** True once a confirmed appointment's time has passed. */
export const isDone = (r: ApptRow, now = Date.now()) => r.status === "confirmed" && new Date(r.ends_at).getTime() < now;

export function StatusTag({ row }: { row: ApptRow }) {
  if (isDone(row)) return <span className="st due"><span className="dot" />Done</span>;
  if (row.status === "confirmed") return <span className="st paid"><span className="dot" />Confirmed</span>;
  if (row.status === "pending") return <span className="st past"><span className="dot" />Waiting for reply</span>;
  if (row.status === "declined") return <span className="st due"><span className="dot" />Declined</span>;
  return <span className="st due"><span className="dot" />Cancelled</span>;
}
