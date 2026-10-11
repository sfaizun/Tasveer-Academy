import { subjectLabel } from "@/lib/mock";
import type { MarkRow } from "./TestMarkForm";

export const MARK_COLS =
  "id, student_id, subject_id, teacher_id, test_name, test_date, marks, out_of, percentage, grade, auto_grade, remarks, attachment_name, created_at, student(full_name, reg_no), subject(name, level, programme(code)), teacher(full_name)";

export function toMarkRow(m: any): MarkRow {
  return {
    id: m.id, student_id: m.student_id, student_name: m.student?.full_name ?? "Student", reg_no: m.student?.reg_no ?? null,
    subject_id: m.subject_id, subject_label: subjectLabel(m.subject), teacher_name: m.teacher?.full_name ?? null,
    test_name: m.test_name, test_date: m.test_date, marks: Number(m.marks), out_of: Number(m.out_of),
    percentage: Number(m.percentage), grade: m.grade, auto_grade: m.auto_grade, remarks: m.remarks, attachment_name: m.attachment_name,
  };
}

