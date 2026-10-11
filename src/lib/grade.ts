/** Tasveer Academy grading: A 90%+, B 80%+, C 70%+, D 60%+, E 50%+, U below 50%.
 * Kept in step with the database function `_grade_for`. */
export const GRADES = ["A", "B", "C", "D", "E", "U"] as const;
export type Grade = (typeof GRADES)[number];

export function percentOf(marks: number, outOf: number): number | null {
  if (!Number.isFinite(marks) || !Number.isFinite(outOf) || outOf <= 0 || marks < 0 || marks > outOf) return null;
  return Math.round((marks * 10000) / outOf) / 100;
}

export function gradeFor(pct: number | null): Grade | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  if (pct >= 50) return "E";
  return "U";
}

/** Badge colour class for a grade. */
export function gradeTone(g: string | null | undefined): string {
  if (g === "A" || g === "B") return "g-hi";
  if (g === "C" || g === "D") return "g-mid";
  if (g === "E") return "g-lo";
  return "g-u";
}

export function fmtNum(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "");
}
