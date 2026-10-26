import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO } from "@/lib/format";
import { subjectLabel } from "@/lib/mock";
import { requirePage } from "@/lib/require-page";
import { viewReadOnly } from "@/lib/access";
import PaperForm, { type PaperRow, type SubjectOpt } from "./PaperForm";
import { SESSIONS } from "./shared";
import BulkUpload from "./BulkUpload";
import PapersTable from "./PapersTable";

export const dynamic = "force-dynamic";

const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const SESSION_ORDER: Record<string, number> = { nov: 3, jun: 2, jan: 1 };

const sel: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5,
  background: "var(--paper)", color: "var(--ink)", maxWidth: "100%", fontFamily: "inherit",
};

/** Past papers: question papers, mark schemes and examiner reports by subject, year and session.
 * Students see their own subjects; teachers see all and add papers for the subjects they teach;
 * admins with Past papers see and manage all. */
export default async function PastPapersPage({ searchParams }: {
  searchParams: Promise<{ level?: string; subject?: string; year?: string; session?: string }>;
}) {
  await requirePage("past_papers");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const supabase = await createClient();
  const sp = await searchParams;
  const thisYear = Number(dhakaTodayISO().slice(0, 4));
  const isStudent = me.role === "student" || me.role === "guardian";

  const [{ data: subjData }, { data: index }, { data: mine }] = await Promise.all([
    supabase.from("subject").select("id, name, level, sort_order, programme(code)").eq("active", true),
    // Every paper this login can see (row level security), for the filter choices.
    supabase.from("past_paper").select("subject_id, year").limit(5000),
    isStudent || viewReadOnly(me) ? Promise.resolve({ data: [] as string[] }) : supabase.rpc("fn_past_paper_subjects"),
  ]);

  const allSubjects: SubjectOpt[] = ((subjData ?? []) as any[])
    .filter((s) => s.programme?.code === "o_level" || s.programme?.code === "a_level")
    .sort((a, b) => (a.programme.code === b.programme.code ? 0 : a.programme.code === "o_level" ? -1 : 1) || a.name.localeCompare(b.name) || String(a.level ?? "").localeCompare(String(b.level ?? "")))
    .map((s) => ({ id: s.id, label: subjectLabel(s), programme: s.programme.code, name: s.name, level: s.level ?? null }));
  const subjectById = new Map(allSubjects.map((s) => [s.id, s]));
  const manageable = ((mine ?? []) as any[]).map((x) => (typeof x === "string" ? x : x.fn_past_paper_subjects ?? x.id)).filter(Boolean) as string[];
  const manageSubjects = allSubjects.filter((s) => manageable.includes(s.id));

  // Filters, limited to what this login can see.
  const seen = (index ?? []) as { subject_id: string; year: number }[];
  const seenSubjects = new Set(seen.map((x) => x.subject_id));
  const level = sp.level === "o_level" || sp.level === "a_level" ? sp.level : "";
  const subjectOpts = allSubjects.filter((s) => seenSubjects.has(s.id) && (!level || s.programme === level));
  const subject = isId(sp.subject) && subjectOpts.some((s) => s.id === sp.subject) ? sp.subject : "";
  const years = [...new Set(seen.map((x) => x.year))].sort((a, b) => b - a);
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : null;
  const session = SESSIONS.some((s) => s.value === sp.session) ? (sp.session as string) : "";
  const levels = [...new Set([...seenSubjects].map((id) => subjectById.get(id)?.programme).filter(Boolean))] as string[];

  let q = supabase.from("past_paper").select("id, subject_id, year, session, paper, note, past_paper_file(id, kind, name, size)").limit(1000);
  if (subject) q = q.eq("subject_id", subject);
  else if (level) q = q.in("subject_id", subjectOpts.length ? subjectOpts.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"]);
  if (year) q = q.eq("year", year);
  if (session) q = q.eq("session", session);
  const { data } = await q;

  const rows: PaperRow[] = ((data ?? []) as any[])
    .map((p) => {
      const s = subjectById.get(p.subject_id);
      return {
        id: p.id, subject_id: p.subject_id, subject_label: s?.label ?? "Subject", programme: s?.programme ?? "",
        year: p.year, session: p.session, paper: p.paper, note: p.note,
        files: ((p.past_paper_file ?? []) as any[]).map((f) => ({ id: f.id, kind: f.kind, name: f.name, size: f.size })),
      };
    })
    .sort((a, b) =>
      (a.programme === b.programme ? 0 : a.programme === "o_level" ? -1 : 1) || a.subject_label.localeCompare(b.subject_label)
      || b.year - a.year || (SESSION_ORDER[b.session] ?? 0) - (SESSION_ORDER[a.session] ?? 0)
      || a.paper.localeCompare(b.paper, undefined, { numeric: true }));

  const filtered = !!(level || subject || year || session);

  return (
    <>
      <header className="top">
        <h1>Past papers</h1>
        <div className="sub">{isStudent ? "Question papers and mark schemes for your subjects" : "O Level and A Level question papers, mark schemes and examiner reports"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {manageSubjects.length > 0 && (
          <details className="panel collapsible no-print">
            <summary className="phead">
              <div className="ptitle">Add a past paper</div>
              <div className="sub">{manageSubjects.length === allSubjects.length ? "Any O Level or A Level subject" : "For the subjects you teach"}</div>
            </summary>
            <div style={{ padding: 18 }}>
              <PaperForm subjects={manageSubjects} thisYear={thisYear} />
            </div>
          </details>
        )}
        {manageSubjects.length > 0 && (
          <details className="panel collapsible no-print">
            <summary className="phead">
              <div className="ptitle">Upload many papers at once</div>
              <div className="sub">Choose all the PDFs of one exam session; each file is matched to its subject and paper by its name</div>
            </summary>
            <div style={{ padding: 18 }}>
              <BulkUpload subjects={manageSubjects} thisYear={thisYear} />
            </div>
          </details>
        )}

        <div className="panel">
          <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="ptitle">Papers</div>
            <div className="sub">{rows.length} {rows.length === 1 ? "paper" : "papers"}</div>
            <div className="spacer" />
            {seen.length > 0 && (
              <form method="get" className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {levels.length > 1 && (
                  <select name="level" defaultValue={level} aria-label="Level" style={sel}>
                    <option value="">O and A Level</option>
                    <option value="o_level">O Level</option>
                    <option value="a_level">A Level</option>
                  </select>
                )}
                <select name="subject" defaultValue={subject} aria-label="Subject" style={sel}>
                  <option value="">All subjects</option>
                  {subjectOpts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select name="year" defaultValue={year ?? ""} aria-label="Year" style={sel}>
                  <option value="">All years</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select name="session" defaultValue={session} aria-label="Session" style={sel}>
                  <option value="">All sessions</option>
                  {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "7px 12px" }}>Show</button>
                {filtered && <a className="btn ghost" href="/past-papers" style={{ fontSize: 12, padding: "7px 12px" }}>Clear</a>}
              </form>
            )}
          </div>
          {seen.length === 0 && isStudent ? (
            <div className="sub" style={{ padding: 18 }}>No past papers have been added for your subjects yet.</div>
          ) : (
            <PapersTable rows={rows} manageable={manageable} subjects={manageSubjects} thisYear={thisYear} />
          )}
        </div>
      </div>
    </>
  );
}
