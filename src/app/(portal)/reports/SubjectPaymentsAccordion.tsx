"use client";
import { Fragment, useState } from "react";
import { taka } from "@/lib/format";

export type StudentPaymentRow = {
  student_id: string;
  student_name: string;
  reg_no: string;
  monthly_rate: number;
  billed: number;
  paid: number;
  balance: number;
  invoice_count: number;
};

export type SubjectGroup = {
  class_group_id: string;
  subject_name: string;
  level: string | null;
  teacher_name: string;
  students: StudentPaymentRow[];
  totalBilled: number;
  totalPaid: number;
  totalBalance: number;
};

export default function SubjectPaymentsAccordion({
  groups,
  showTeacherColumn,
  linkStudents,
}: {
  groups: SubjectGroup[];
  showTeacherColumn: boolean;
  linkStudents: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (groups.length === 0) {
    return <div className="sub" style={{ padding: "0 16px 16px" }}>No active subject enrolments yet.</div>;
  }

  const colSpan = showTeacherColumn ? 7 : 6;

  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            {showTeacherColumn && <th>Teacher</th>}
            <th className="n">Students</th>
            <th className="n">Billed</th>
            <th className="n">Paid</th>
            <th className="n">Balance</th>
            <th className="n"></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const isOpen = open === g.class_group_id;
            const sortedStudents = g.students.slice().sort((a, b) => a.student_name.localeCompare(b.student_name));
            return (
              <Fragment key={g.class_group_id}>
                <tr>
                  <td><b>{g.subject_name}{g.level ? ` (${g.level.toUpperCase()})` : ""}</b></td>
                  {showTeacherColumn && <td className="sub">{g.teacher_name}</td>}
                  <td className="n mono">{g.students.length}</td>
                  <td className="n mono">{taka(g.totalBilled)}</td>
                  <td className="n mono">{taka(g.totalPaid)}</td>
                  <td className="n mono" style={{ color: g.totalBalance > 0 ? "var(--crit)" : undefined }}>
                    {taka(g.totalBalance)}
                  </td>
                  <td className="n">
                    <button
                      className="btn ghost"
                      type="button"
                      style={{ fontSize: 12, padding: "6px 10px" }}
                      onClick={() => setOpen(isOpen ? null : g.class_group_id)}
                    >
                      {isOpen ? "Hide" : "Students"}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={colSpan} style={{ padding: "10px 16px", background: "var(--tint)" }}>
                      <table style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Reg. no.</th>
                            <th className="n">Rate</th>
                            <th className="n">Billed</th>
                            <th className="n">Paid</th>
                            <th className="n">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedStudents.map((s) => (
                            <tr key={s.student_id}>
                              <td>
                                {linkStudents ? <a href={`/students/${s.student_id}`}>{s.student_name}</a> : s.student_name}
                              </td>
                              <td className="mono sub">{s.reg_no}</td>
                              <td className="n mono">{taka(s.monthly_rate)}</td>
                              <td className="n mono">{taka(s.billed)}</td>
                              <td className="n mono">{taka(s.paid)}</td>
                              <td className="n mono" style={{ color: s.balance > 0 ? "var(--crit)" : undefined }}>
                                {taka(s.balance)}
                              </td>
                            </tr>
                          ))}
                          {sortedStudents.length === 0 && (
                            <tr><td colSpan={6} className="sub">No students currently enrolled.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
