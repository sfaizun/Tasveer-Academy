import { fmtDate } from "@/lib/format";
import { attendance, homework, monthTitle, pct, type RcCard, type RcMark } from "./shared";

function Marks({ title, rows }: { title: string; rows: RcMark[] }) {
  if (!rows.length) return null;
  return (
    <table className="rc-marks keep-table">
      <thead>
        <tr><th>{title}</th><th>Date</th><th className="n">Marks</th><th className="n">%</th><th className="n">Grade</th></tr>
      </thead>
      <tbody>
        {rows.map((m, i) => (
          <tr key={i}>
            <td>{m.name}</td>
            <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(m.date)}</td>
            <td className="n mono">{Number(m.marks)} / {Number(m.out_of)}</td>
            <td className="n mono">{Number(m.pct).toFixed(1)}</td>
            <td className="n"><b>{m.grade}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The monthly report card: every subject the student was enrolled in, with test and mock
 * marks, grade, attendance, homework and the teacher's comments. Prints on A4. */
export default function ReportCard({ card, academy }: { card: RcCard; academy: { name: string; address: string; phone: string } }) {
  const month = card.month.slice(0, 7);
  const held = card.subjects.reduce((n, s) => n + (s.att_held ?? 0), 0);
  const present = card.subjects.reduce((n, s) => n + (s.att_present ?? 0), 0);
  return (
    <div className="rc">
      <div className="rc-head">
        <img src="/logo.png" alt="" width={52} height={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rc-academy">{academy.name}</div>
          <div className="rc-addr">{academy.address}{academy.phone ? ` · ${academy.phone}` : ""}</div>
        </div>
        <div className="rc-title">
          <div>MONTHLY REPORT CARD</div>
          <b>{monthTitle(month)}</b>
        </div>
      </div>

      <div className="rc-student">
        <div><span className="lbl">Student</span><b>{card.student.name}</b></div>
        <div><span className="lbl">Student ID</span><b className="mono">{card.student.reg_no ?? "-"}</b></div>
        <div><span className="lbl">Programme</span><b>{card.student.programme ?? "-"}</b></div>
        <div><span className="lbl">Attendance this month</span><b>{held ? `${pct(present, held)}% (${present} of ${held} classes)` : "No classes marked"}</b></div>
      </div>

      {card.subjects.map((s) => {
        const a = attendance(s);
        const h = homework(s);
        return (
          <section key={s.id} className="rc-subject">
            <div className="rc-shead">
              <div className="rc-sname">{s.subject}</div>
              <div className="sub">{s.teacher ?? ""}{s.batch ? ` · Batch ${s.batch}` : ""}</div>
              <div style={{ flex: 1 }} />
              {s.grade && <div className="rc-grade" title="Grade from the average of this month's marks">Grade <b>{s.grade}</b>{s.avg_pct != null ? <span> · {Number(s.avg_pct).toFixed(1)}%</span> : null}</div>}
            </div>
            <Marks title="Class tests" rows={s.tests} />
            <Marks title="Mock exams" rows={s.mocks} />
            {!s.tests.length && !s.mocks.length && <div className="sub" style={{ padding: "6px 0" }}>No tests or mocks this month.</div>}
            <div className="rc-facts">
              <div><span className="lbl">Attendance</span><b>{a.pct != null ? `${a.pct}%` : "-"}</b> <span className="sub">{a.text}</span></div>
              <div><span className="lbl">Absent</span><b>{a.pct != null ? `${Math.round((100 - a.pct) * 10) / 10}%` : "-"}</b></div>
              <div><span className="lbl">Homework / assignments</span><b>{h.pct != null ? `${h.pct}%` : "-"}</b> <span className="sub">{h.text}</span></div>
            </div>
            <div className="rc-comments">
              <span className="lbl">Teacher&apos;s comments</span>
              {s.comments.length || s.comment_text ? (
                <ul>
                  {s.comments.map((c, i) => <li key={i}>{c}</li>)}
                  {s.comment_text && <li>{s.comment_text}</li>}
                </ul>
              ) : (
                <div className="sub">Not added yet.</div>
              )}
            </div>
          </section>
        );
      })}

      <div className="rc-foot">
        <span>Generated {fmtDate(card.generated_at.slice(0, 10))}</span>
        <span>Office signature: ____________________</span>
      </div>
    </div>
  );
}
