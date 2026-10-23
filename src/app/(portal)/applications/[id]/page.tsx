import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import ThemeToggle from "@/components/ThemeToggle";
import { fmtDate, fmtDateTime, taka } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import { loadAcademy } from "../../report-cards/load";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

const PROGRAMME: Record<string, string> = { junior: "Junior", o_level: "O Level", a_level: "A Level" };
const STATUS: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under review", changes_requested: "Changes requested", approved: "Approved", rejected: "Rejected",
};
const cap = (s: unknown) => (typeof s === "string" && s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function F({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span className="lbl">{label}</span>
      <b>{value || "-"}</b>
    </div>
  );
}

/** One admission application as a printable form (A4), with ?print=1 opening the print dialog. */
export default async function ApplicationPrintPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }>;
}) {
  await requirePage("applications");
  const { id } = await params;
  const { print } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data }, academy] = await Promise.all([
    supabase.from("application").select("id, ref_no, status, payload, submitted_at, created_at, review_note, reviewed_at").eq("id", id).maybeSingle(),
    loadAcademy(supabase),
  ]);
  if (!data) notFound();
  const app: any = data;
  const p = app.payload ?? {};
  const st = p.student ?? {};
  const g = p.guardian ?? {};
  const siblings = (p.siblings ?? []) as any[];
  const subjects = (p.subjects ?? []) as any[];
  const fee = p.fee_summary ?? {};

  return (
    <>
      {print === "1" && <AutoPrint />}
      <header className="top no-print">
        <h1>Application {app.ref_no}</h1>
        <div className="spacer" />
        <a className="btn ghost" href="/applications" style={{ fontSize: 12, padding: "6px 10px" }}>Back</a>
        <PrintButton label="Print / Save as PDF" />
        <ThemeToggle />
      </header>
      <div className="content">
        <div className="rc">
          <div className="rc-head">
            <img src="/logo.png" alt="" width={52} height={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rc-academy">{academy.name}</div>
              <div className="rc-addr">{academy.address}{academy.phone ? ` · ${academy.phone}` : ""}</div>
            </div>
            <div className="rc-title">
              <div>ADMISSION FORM</div>
              <b className="mono">{app.ref_no}</b>
            </div>
          </div>

          <div className="rc-student">
            <F label="Submitted" value={fmtDateTime(app.submitted_at ?? app.created_at)} />
            <F label="Status" value={STATUS[app.status] ?? app.status} />
            <F label="Visit date" value={p.visit_date ? fmtDate(p.visit_date) : ""} />
            <F label="Programme" value={`${PROGRAMME[p.programme_code] ?? p.programme_code ?? ""}${p.mock_only ? " (Mock exam only)" : ""}`} />
            {!p.mock_only && (p.programme_code === "junior"
              ? <F label="Class" value={p.class_level_code} />
              : <F label="Start month" value={p.start_month ? fmtDate(`${p.start_month}-01`).slice(3) : ""} />)}
            {p.previous_reg_no && <F label="Previous reg. no." value={p.previous_reg_no} />}
          </div>

          <section className="rc-subject">
            <div className="rc-sname" style={{ marginBottom: 8 }}>Student</div>
            <div className="rc-facts">
              <F label="Full name" value={st.full_name} />
              <F label="Date of birth" value={st.date_of_birth ? fmtDate(st.date_of_birth) : ""} />
              <F label="Gender" value={cap(st.gender)} />
              <F label="Nationality" value={st.nationality} />
              <F label="WhatsApp / mobile" value={st.phone} />
              <F label="Email" value={st.email} />
              <F label="School" value={st.school_name} />
              <F label="Address" value={st.address} wide />
            </div>
          </section>

          <section className="rc-subject">
            <div className="rc-sname" style={{ marginBottom: 8 }}>Guardian</div>
            <div className="rc-facts">
              <F label="Full name" value={g.full_name} />
              <F label="Relation" value={cap(g.relation)} />
              <F label="Father's name" value={g.father_name} />
              <F label="Mother's name" value={g.mother_name} />
              <F label="WhatsApp / mobile" value={g.phone} />
              <F label="Email" value={g.email} />
              <F label="Address" value={g.address} wide />
            </div>
          </section>

          {siblings.length > 0 && (
            <section className="rc-subject">
              <div className="rc-sname" style={{ marginBottom: 6 }}>Siblings</div>
              <table className="rc-marks keep-table">
                <thead><tr><th>Name</th><th>Class</th><th>School</th></tr></thead>
                <tbody>{siblings.map((s, i) => <tr key={i}><td>{s.full_name}</td><td>{s.class_name || "-"}</td><td>{s.school_name || "-"}</td></tr>)}</tbody>
              </table>
            </section>
          )}

          {subjects.length > 0 && (
            <section className="rc-subject">
              <div className="rc-sname" style={{ marginBottom: 6 }}>{p.mock_only ? "Mock exams" : "Subjects"}</div>
              <table className="rc-marks keep-table">
                {p.mock_only ? (
                  <>
                    <thead><tr><th>Mock exam</th><th className="n">Fee</th></tr></thead>
                    <tbody>{subjects.map((s, i) => (
                      <tr key={i}>
                        <td>{s.mock_exam_label ?? `${s.subject_name}${s.level ? ` (${String(s.level).toUpperCase()})` : ""}`}</td>
                        <td className="n mono">{s.mock_fee != null ? taka(s.mock_fee) : "-"}</td>
                      </tr>
                    ))}</tbody>
                  </>
                ) : (
                  <>
                    <thead><tr><th>Subject</th><th>Teacher</th><th className="n">Fee / month</th></tr></thead>
                    <tbody>{subjects.map((s, i) => (
                      <tr key={i}>
                        <td>{s.subject_name}{s.level ? ` (${String(s.level).toUpperCase()})` : ""}</td>
                        <td>{s.teacher_name || "-"}</td>
                        <td className="n mono">{taka(s.monthly_fee ?? 0)}</td>
                      </tr>
                    ))}</tbody>
                  </>
                )}
              </table>
            </section>
          )}

          <section className="rc-subject">
            <div className="rc-sname" style={{ marginBottom: 8 }}>Fees (indicative)</div>
            <div className="rc-facts">
              <F label="Admission fee" value={taka(fee.admission_fee ?? 0)} />
              {p.mock_only
                ? <F label="Mock exam fees" value={taka(fee.mock_fee ?? 0)} />
                : <F label="Monthly fee" value={taka(fee.monthly_total ?? 0)} />}
            </div>
          </section>

          {app.review_note && (
            <section className="rc-subject">
              <div className="rc-sname" style={{ marginBottom: 4 }}>Office note</div>
              <div>{app.review_note}</div>
            </section>
          )}

          <div className="rc-comments" style={{ marginTop: 16 }}>
            <span className="lbl">Declaration</span>
            <div style={{ color: "#3d3632", marginTop: 4 }}>
              {p.declaration_accepted ? "Accepted: " : ""}I confirm the information given above is correct to the best of my knowledge, and I accept
              {" "}{academy.name}&apos;s rules on fees, attendance and conduct.
            </div>
          </div>

          <div className="rc-foot" style={{ marginTop: 40 }}>
            <span>Guardian&apos;s signature: ____________________</span>
            <span>Received by (office): ____________________</span>
          </div>
        </div>
      </div>
    </>
  );
}
