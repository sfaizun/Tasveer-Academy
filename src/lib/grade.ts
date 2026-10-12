/** Tasveer Academy grading scales. Kept in step with the database functions `_grade_for`,
 * `_grade_valid` and `_grade_scale` (the scale follows the subject's programme). */
export type GradeScale = "o_level" | "a_level" | "junior";

type Band = { min: number; grade: string };

export const SCALES: Record<GradeScale, { label: string; bands: Band[] }> = {
  a_level: {
    label: "A Level",
    bands: [
      { min: 90, grade: "A*" }, { min: 80, grade: "A" }, { min: 70, grade: "B" }, { min: 60, grade: "C" },
      { min: 50, grade: "D" }, { min: 40, grade: "E" }, { min: 0, grade: "U" },
    ],
  },
  o_level: {
    label: "O Level",
    bands: [
      { min: 90, grade: "9/A*" }, { min: 80, grade: "8/A*" }, { min: 70, grade: "7/A" }, { min: 60, grade: "6/B" },
      { min: 50, grade: "5/B" }, { min: 40, grade: "4/C" }, { min: 30, grade: "3/D" }, { min: 20, grade: "2/E" },
      { min: 0, grade: "1/U" },
    ],
  },
  junior: {
    label: "Junior classes",
    bands: [
      { min: 90, grade: "A" }, { min: 80, grade: "B" }, { min: 70, grade: "C" }, { min: 60, grade: "D" },
      { min: 50, grade: "E" }, { min: 0, grade: "U" },
    ],
  },
};

export function scaleForProgramme(code: string | null | undefined): GradeScale {
  return code === "a_level" || code === "o_level" ? code : "junior";
}

export function gradesFor(scale: GradeScale): string[] {
  return SCALES[scale].bands.map((b) => b.grade);
}

export function percentOf(marks: number, outOf: number): number | null {
  if (!Number.isFinite(marks) || !Number.isFinite(outOf) || outOf <= 0 || marks < 0 || marks > outOf) return null;
  return Math.round((marks * 10000) / outOf) / 100;
}

export function gradeFor(pct: number | null, scale: GradeScale): string | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  return SCALES[scale].bands.find((b) => pct >= b.min)?.grade ?? null;
}

/** Highest and lowest grade on a scale. */
export const isTopGrade = (scale: GradeScale, g: string) => g === SCALES[scale].bands[0].grade || (scale === "o_level" && g === "8/A*");
export const isBottomGrade = (scale: GradeScale, g: string) => g === SCALES[scale].bands[SCALES[scale].bands.length - 1].grade;

/** Badge colour class for a grade, by its place on the scale. */
export function gradeTone(g: string | null | undefined, scale: GradeScale = "junior"): string {
  const list = gradesFor(scale);
  const i = g ? list.indexOf(g) : -1;
  if (i < 0 || i === list.length - 1) return "g-u";
  const pos = i / (list.length - 1);
  if (pos < 0.3) return "g-hi";
  if (pos < 0.6) return "g-mid";
  return "g-lo";
}

/** One line per scale, for legends under results. */
export function scaleText(scale: GradeScale): string {
  const b = SCALES[scale].bands;
  return `${SCALES[scale].label}: ` + b.map((x, i) => (i === b.length - 1 ? `${x.grade} below ${b[i - 1].min}%` : `${x.grade} ${x.min}%+`)).join(", ");
}

export function fmtNum(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "");
}
