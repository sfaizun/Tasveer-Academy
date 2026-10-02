import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO, fmtDate, taka } from "@/lib/format";
import { EXAM_STATUS, MOCK_EXAM_COLS, subjectLabel, timeRange, type MockExam } from "@/lib/mock";
import MockExamForm from "./MockExamForm";

export const dynamic = "force-dynamic";

export default async function MockExamsPage({ searchParams }: { searchParams: Promise<{ show?: string; series?: string }> }) {
  const { me } = await getViewer();
  if (me?.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const show = sp.show === "past" || sp.show === "all" ? sp.show : "upcoming";
  const today = dhakaTodayISO();
  const supabase = await createClient();

  const [{ data: exams }, { data: subjects }, { data: rate }, { data: teachers }, { data: teacherSubjects }] = await Promise.all([
    supabase.from("mock_exam").select(`${MOCK_EXAM_COLS}, mock_registration(status)`).order("exam_date").order("start_time"),
    supabase.from("subject").select("id, name, level, programme(code, name)").eq("active", true).order("sort_order"),
    supabase.from("fee_rate").select("amount").eq("kind", "mock").lte("effective_from", today).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("teacher_subject").select("teacher_id, subject_id").eq("active", true),
  ]);

  const all = ((exams ?? []) as any[]).map((e) => ({
    ...(e as MockExam),
    regs: (e.mock_registration ?? []) as { status: string }[],
  }));
  const seriesOptions = [...new Set(all.map((e) => e.series))].sort();
  const list = all
    .filter((e) => (show === "upcoming" ? e.exam_date >= today : show === "past" ? e.exam_date < today : true))
    .filter((e) => !sp.series || e.series === sp.series);
  if (show === "past") list.reverse();

  // Group by series so a season's papers sit together.
  const bySeries = new Map<string, typeof list>();
  for (const e of list) bySeries.set(e.series, [...(bySeries.get(e.series) ?? []), e]);

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
    const s = p.toString();
    return `/mock-exams${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <header className="top">
        <h1>Mock exams</h1>
        <span className="sub">O Level and A Level mocks, billed per subject</span>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <details className="panel collapsible" open={all.length === 0}>
          <summary className="phead"><div className="ptitle">Add a mock exam</div><div className="sub">one exam per subject in a series</div></summary>
          <MockExamForm
            subjects={((subjects ?? []) as any[]).filter((s) => s.programme?.code === "o_level" || s.programme?.code === "a_level")}
            defaultFee={rate?.amount != null ? Number(rate.amount) : 5000}
            seriesOptions={seriesOptions}
            teachers={(teachers ?? []) as any}
            teacherSubjects={(teacherSubjects ?? []) as any}
          />
        </details>

        <div className="panel" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="fchips">
            {(["upcoming", "past", "all"] as const).map((k) => (
              <Link key={k} className={show === k ? "fchip on" : "fchip"} href={q({ show: k === "upcoming" ? undefined : k, series: sp.series })}>
                {k === "upcoming" ? "Upcoming" : k === "past" ? "Past" : "All"}
              </Link>
            ))}
          </div>
          {seriesOptions.length > 1 && (
            <div className="fchips">
              <Link className={!sp.series ? "fchip on" : "fchip"} href={q({ show: show === "upcoming" ? undefined : show })}>All series</Link>
              {seriesOptions.map((s) => (
                <Link key={s} className={sp.series === s ? "fchip on" : "fchip"} href={q({ show: show === "upcoming" ? undefined : show, series: s })}>{s}</Link>
              ))}
            </div>
          )}
          <div className="spacer" style={{ flex: 1 }} />
          <span className="sub">New candidate from outside? Use the <Link href="/apply">admission form</Link> with &ldquo;Mock Exam Only&rdquo;.</span>
        </div>

        {list.length === 0 && (
          <div className="panel sub" style={{ padding: 16 }}>
            {all.length === 0 ? "No mock exams yet. Add the first one above." : "No mock exams in this view."}
          </div>
        )}

        {[...bySeries.entries()].map(([series, exams]) => (
          <div key={series} className="panel">
            <div className="phead">
              <div className="ptitle">{series}</div>
              <div className="sub">
                {exams.length} exam{exams.length === 1 ? "" : "s"} · {exams.reduce((a, e) => a + e.regs.filter((r) => r.status !== "withdrawn").length, 0)} registrations
              </div>
            </div>
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th className="n">Fee</th><th className="n">Candidates</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {exams.map((e) => {
                    const active = e.regs.filter((r) => r.status !== "withdrawn");
                    const st = EXAM_STATUS[e.status];
                    return (
                      <tr key={e.id}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(e.exam_date)}</td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{timeRange(e.start_time, e.duration_min) || "—"}</td>
                        <td><b style={{ color: "var(--ink)" }}>{subjectLabel(e.subject)}</b></td>
                        <td className="sub">
                          {e.teacher?.full_name ?? <span style={{ color: "var(--warn)" }}>Not set</span>}
                        </td>
                        <td>{e.room ?? "—"}</td>
                        <td className="n mono">{taka(e.fee)}</td>
                        <td className="n mono">
                          {active.length}
                          {active.some((r) => r.status === "sat" || r.status === "absent") && (
                            <div className="sub">{active.filter((r) => r.status === "sat").length} sat · {active.filter((r) => r.status === "absent").length} absent</div>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}><span className={`st ${st.cls}`}><span className="dot" />{st.text}</span></td>
                        <td className="n"><Link className="btn ghost" href={`/mock-exams/${e.id}`} style={{ fontSize: 12, padding: "5px 10px" }}>Open</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
