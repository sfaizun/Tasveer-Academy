export type AttStudent = { id: string; name: string; reg_no: string | null; status: "present" | "absent" | null };

export type AttClass = {
  slot_id: string;
  start_time: string;
  end_time: string;
  room: string | null;
  label: string;
  batch: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  session_id: string | null;
  taken_at: string | null;
  updated_at: string | null;
  taken_by: string | null;
  updated_by: string | null;
  can_edit: boolean;
  students: AttStudent[];
};

/** "17:00" to "5:00 PM" */
export function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
}

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export const classTitle = (c: AttClass) => `${c.label}${c.batch ? ` · Batch ${c.batch}` : ""}`;
