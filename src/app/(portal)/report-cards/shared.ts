/** Shared types and helpers for report cards. */

export type RcMark = { name: string; date: string; marks: number; out_of: number; pct: number; grade: string };

/** One subject's figures for a student and month (from _rc_subject_json). */
export type RcFigures = {
  tests: RcMark[];
  mocks: RcMark[];
  avg_pct: number | null;
  grade: string | null;
  att_held: number | null;
  att_present: number | null;
  hw_submitted: number | null;
  hw_set: number | null;
};

export type RcSubject = RcFigures & {
  id: string;
  subject: string;
  teacher: string | null;
  batch: string | null;
  comments: string[];
  comment_text: string | null;
};

export type RcCard = {
  id: string;
  month: string;
  generated_at: string;
  student: { id: string; name: string; reg_no: string | null; school: string | null; programme: string | null };
  subjects: RcSubject[];
};

export type RcBatchRow = RcFigures & {
  id: string;
  student_id: string;
  name: string;
  reg_no: string | null;
  comment_ids: string[];
  comment_text: string | null;
};

export type RcComment = { id: string; text: string; category: "excellent" | "good" | "improve"; active: boolean; sort_order: number };

export const CATEGORIES: { key: RcComment["category"]; label: string }[] = [
  { key: "excellent", label: "Excellent" },
  { key: "good", label: "Good" },
  { key: "improve", label: "Needs improvement" },
];

/** "2026-10" from a date or month string; null when it doesn't look like one. */
export function monthKey(s: unknown): string | null {
  return typeof s === "string" && /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : null;
}

/** "October 2026" */
export function monthTitle(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, mo - 1, 1)));
}

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/** Homework completion: submitted of set, capped at 100%. */
export function homework(f: Pick<RcFigures, "hw_submitted" | "hw_set">) {
  const done = f.hw_submitted ?? 0;
  if (f.hw_set == null) return { text: `${done} submitted`, pct: null as number | null };
  if (f.hw_set === 0) return { text: "None set", pct: null as number | null };
  return { text: `${Math.min(done, f.hw_set)} of ${f.hw_set}`, pct: pct(Math.min(done, f.hw_set), f.hw_set) };
}

export function attendance(f: Pick<RcFigures, "att_held" | "att_present">) {
  const held = f.att_held ?? 0;
  if (!held) return { text: "No classes marked", pct: null as number | null };
  return { text: `${f.att_present ?? 0} of ${held}`, pct: pct(f.att_present ?? 0, held) };
}
