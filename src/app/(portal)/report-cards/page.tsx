import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import { dhakaTodayISO } from "@/lib/format";
import { subjectLabel } from "@/lib/mock";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin, viewReadOnly } from "@/lib/access";
import ReportCard from "./ReportCard";
import BatchEditor from "./BatchEditor";
import { CommentListEditor, GenerateButton } from "./Forms";
import { loadAcademy } from "./load";
import { monthKey, monthTitle, type RcBatchRow, type RcCard, type RcComment } from "./shared";

export const dynamic = "force-dynamic";
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const sel: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", minWidth: 160,
};

/** Monthly report cards.
 * Office / Student Admin: generate the month's cards for every student, see them all, add
 * comments for any batch and keep the comment list. A teacher: generate and comment for their
 * own batches. A student (or guardian) picks a month and sees the card. */
export default async function ReportCardsPage({ searchParams }: { searchParams: Promise<{ month?: string; batch?: string; student?: string }> }) {
  await requirePage("report_cards");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const supabase = await createClient();
  const sp = await searchParams;
  const thisMonth = dhakaTodayISO().slice(0, 7);
  const isAdmin = actsAsAdmin(me, "report_cards");
  const isTeacher = !isAdmin && me.role === "teacher";

  // ---- Student / guardian: pick a month, see the card. ----
  if (!isAdmin && !isTeacher) {
    const { data: kidRows } = await supabase.from("student").select("id, full_name").order("full_name");
    const kids = (kidRows ?? []) as { id: string; full_name: string }[];
    const kid = kids.find((k) => k.id === sp.student) ?? kids[0];
    const { data: monthRows } = kid ? await supabase.rpc("fn_report_card_months", { p_student_id: kid.id }) : { data: [] };
    const months = ((monthRows ?? []) as string[]).map((m) => m.slice(0, 7));
    const month = months.includes(monthKey(sp.month) ?? "") ? (monthKey(sp.month) as string) : months[0];
    const [{ data: cardData }, academy] = await Promise.all([
      kid && month ? supabase.rpc("fn_report_card", { p_student_id: kid.id, p_month: `${month}-01` }) : Promise.resolve({ data: null }),
      loadAcademy(supabase),
    ]);
    const card = cardData as RcCard | null;
    return (
      <>
        <header className="top no-print">
          <h1>Report cards</h1>
          <div className="sub">{kid?.full_name ?? ""}</div>
          <div className="spacer" />
          {card && <PrintButton label="Print / Save as PDF" />}
          <ThemeToggle />
        </header>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {months.length > 0 && (
            <form method="GET" className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {kids.length > 1 && (
                <select name="student" defaultValue={kid?.id} style={sel} aria-label="Student">
                  {kids.map((k) => <option key={k.id} value={k.id}>{k.full_name}</option>)}
                </select>
              )}
              <select name="month" defaultValue={month} style={sel} aria-label="Month">
                {months.map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
              </select>
              <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Show</button>
            </form>
          )}
          {card ? <ReportCard card={card} academy={academy} /> : (
            <div className="panel" style={{ padding: 18 }}><div className="sub">No report cards yet. They appear here once the academy makes them each month.</div></div>
          )}
        </div>
      </>
    );
  }

  // ---- Staff ----
  const readOnly = isAdmin && viewReadOnly(me);
  let month = monthKey(sp.month) ?? thisMonth;
  if (month > thisMonth) month = thisMonth;

  let teacherId: string | null = null;
  if (isTeacher) {
    const { data: t } = await supabase.from("teacher").select("id").eq("app_user_id", me.id).maybeSingle();
    teacherId = t?.id ?? null;
  }
  let gq = supabase.from("class_group").select("id, batch_name, teacher_id, active, subject(name, level, programme(code)), teacher(full_name)").eq("active", true);
  if (isTeacher) gq = gq.eq("teacher_id", teacherId ?? "00000000-0000-0000-0000-000000000000");
  const [{ data: groupRows }, { data: commentRows }, { data: monthCards }] = await Promise.all([
    gq,
    supabase.from("report_comment").select("id, text, category, active, sort_order").order("sort_order"),
    isAdmin ? supabase.rpc("fn_report_cards_month", { p_month: `${month}-01` }) : Promise.resolve({ data: [] }),
  ]);
  const groups = ((groupRows ?? []) as any[])
    .map((g) => ({ id: g.id as string, label: `${subjectLabel(g.subject)} · Batch ${g.batch_name}`, teacher: g.teacher?.full_name as string | undefined }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const comments = (commentRows ?? []) as RcComment[];
  const cards = (monthCards ?? []) as { student_id: string; name: string; reg_no: string | null; subjects: number; commented: number }[];
  const batch = groups.find((g) => g.id === sp.batch) ?? (isTeacher && groups.length === 1 ? groups[0] : undefined);
  const { data: batchData } = batch ? await supabase.rpc("fn_report_batch", { p_class_group_id: batch.id, p_month: `${month}-01` }) : { data: null };
  const b = batchData as { set_count: number | null; set_from_tasks?: boolean; missing: number; can_edit: boolean; students: RcBatchRow[] } | null;

  return (
    <>
      <header className="top">
        <h1>Report cards</h1>
        <div className="sub">{monthTitle(month)}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="month" name="month" defaultValue={month} max={thisMonth} style={sel} aria-label="Month" />
          <select name="batch" defaultValue={batch?.id ?? ""} style={{ ...sel, minWidth: 220 }} aria-label="Batch">
            <option value="">{isTeacher ? "Choose your batch…" : "Choose a batch to add comments…"}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.label}{isAdmin && g.teacher ? ` (${g.teacher})` : ""}</option>)}
          </select>
          <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Show</button>
        </form>

        {isAdmin && !readOnly && (
          <div className="panel" style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <b>{cards.length ? `${cards.length} report cards for ${monthTitle(month)}` : `No report cards for ${monthTitle(month)} yet`}</b>
              <div className="sub">Makes a card for every student enrolled that month, with all their subjects. Students see it straight away; comments appear as teachers add them. Running it again adds new students or subjects and keeps comments.</div>
            </div>
            <GenerateButton month={month} label={cards.length ? "Update report cards" : `Generate for ${monthTitle(month)}`} />
          </div>
        )}

        {batch && b && (
          <div className="panel">
            <div className="phead" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="ptitle">{batch.label}</div>
              <div className="sub">{b.students.length} report card{b.students.length === 1 ? "" : "s"}</div>
              <div style={{ flex: 1 }} />
              {b.can_edit && !readOnly && (b.missing > 0 || b.students.length === 0) && (
                <GenerateButton month={month} batch={batch.id} label={b.students.length ? `Add ${b.missing} missing` : "Generate for this batch"} />
              )}
            </div>
            {b.students.length === 0 ? (
              <div className="sub" style={{ padding: "14px 18px" }}>No report cards for this batch in {monthTitle(month)} yet.</div>
            ) : (
              <BatchEditor batch={batch.id} month={month} setCount={b.set_count} setFromTasks={!!b.set_from_tasks} rows={b.students} comments={comments} canEdit={b.can_edit && !readOnly} />
            )}
          </div>
        )}

        {isTeacher && !batch && groups.length > 0 && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Your batches</div></div>
            {groups.map((g) => (
              <div key={g.id} style={{ padding: "10px 18px", borderTop: "1px solid var(--line)" }}>
                <a href={`/report-cards?month=${month}&batch=${g.id}`}>{g.label}</a>
              </div>
            ))}
          </div>
        )}
        {isTeacher && groups.length === 0 && (
          <div className="panel" style={{ padding: 18 }}><div className="sub">You have no active batches.</div></div>
        )}

        {isAdmin && cards.length > 0 && (
          <details className="panel" open={!batch}>
            <summary className="phead" style={{ cursor: "pointer" }}><div className="ptitle">All report cards ({cards.length})</div></summary>
            <div className="tblwrap">
              <table>
                <thead><tr><th>Student</th><th>Student ID</th><th className="n">Subjects</th><th className="n">With comments</th><th /></tr></thead>
                <tbody>
                  {cards.map((c) => (
                    <tr key={c.student_id}>
                      <td><b>{c.name}</b></td>
                      <td className="mono">{c.reg_no ?? "-"}</td>
                      <td className="n">{c.subjects}</td>
                      <td className="n">{c.commented === c.subjects ? <span className="st paid">All</span> : `${c.commented} of ${c.subjects}`}</td>
                      <td className="n"><a href={`/report-cards/view?student=${c.student_id}&month=${month}`}>View</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {isAdmin && !readOnly && (
          <details className="panel">
            <summary className="phead" style={{ cursor: "pointer" }}>
              <div className="ptitle">Comment list</div>
              <div className="sub">What teachers choose from. Retire a comment to stop it being offered.</div>
            </summary>
            <CommentListEditor comments={comments} />
          </details>
        )}
      </div>
    </>
  );
}
