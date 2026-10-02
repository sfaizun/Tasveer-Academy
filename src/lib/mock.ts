import { fmtDate } from "@/lib/format";

export type MockExam = {
  id: string;
  series: string;
  subject_id: string;
  exam_date: string;
  start_time: string | null;
  duration_min: number | null;
  room: string | null;
  fee: number;
  status: "open" | "closed" | "cancelled";
  note: string | null;
  cancel_reason: string | null;
  teacher_id: string | null;
  teacher?: { id: string; full_name: string } | null;
  subject?: { name: string; level: string | null; programme?: { code: string; name: string } | null } | null;
};

export const MOCK_EXAM_COLS =
  "id, series, subject_id, exam_date, start_time, duration_min, room, fee, status, note, cancel_reason, teacher_id, teacher(id, full_name), subject(name, level, programme(code, name))";

export function subjectLabel(s: { name: string; level: string | null; programme?: { code: string } | null } | null | undefined) {
  if (!s) return "Subject";
  if (s.level) return `${s.name} (${String(s.level).toUpperCase()})`;
  return s.programme?.code === "o_level" ? `${s.name} (O Level)` : s.name;
}

/** "10:00" from "10:00:00" */
export function hm(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

/** "10:00 to 12:00" when a duration is set. */
export function timeRange(start: string | null | undefined, durationMin: number | null | undefined) {
  if (!start) return "";
  if (!durationMin) return hm(start);
  const [h, m] = hm(start).split(":").map(Number);
  const end = h * 60 + m + durationMin;
  return `${hm(start)} to ${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function examTitle(e: Pick<MockExam, "series" | "exam_date"> & { subject?: MockExam["subject"] }) {
  return `${subjectLabel(e.subject)}, ${e.series}, ${fmtDate(e.exam_date)}`;
}

export const REG_STATUS: Record<string, { text: string; cls: string }> = {
  registered: { text: "Registered", cls: "due" },
  sat: { text: "Sat", cls: "paid" },
  absent: { text: "Absent", cls: "past" },
  withdrawn: { text: "Withdrawn", cls: "" },
};

export const EXAM_STATUS: Record<string, { text: string; cls: string }> = {
  open: { text: "Open for registration", cls: "paid" },
  closed: { text: "Registration closed", cls: "due" },
  cancelled: { text: "Cancelled", cls: "past" },
};
