import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import { requirePage } from "@/lib/require-page";
import ReportCard from "../ReportCard";
import { loadAcademy } from "../load";
import { monthKey, monthTitle, type RcCard } from "../shared";

export const dynamic = "force-dynamic";
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);

/** One student's report card for a month, ready to print or save as PDF. */
export default async function ReportCardView({ searchParams }: { searchParams: Promise<{ student?: string; month?: string }> }) {
  await requirePage("report_cards");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const sp = await searchParams;
  const month = monthKey(sp.month);
  if (!isId(sp.student) || !month) redirect("/report-cards");
  const supabase = await createClient();
  const [{ data }, academy] = await Promise.all([
    supabase.rpc("fn_report_card", { p_student_id: sp.student, p_month: `${month}-01` }),
    loadAcademy(supabase),
  ]);
  const card = data as RcCard | null;
  const back = me.role === "student" || me.role === "guardian" ? `/report-cards?month=${month}` : `/report-cards?month=${month}`;

  return (
    <>
      <header className="top no-print">
        <h1>Report card</h1>
        <div className="sub">{card ? `${card.student.name} · ${monthTitle(month)}` : monthTitle(month)}</div>
        <div className="spacer" />
        <a className="btn ghost" href={back} style={{ fontSize: 12, padding: "6px 10px" }}>Back</a>
        {card && <PrintButton label="Print / Save as PDF" />}
        <ThemeToggle />
      </header>
      <div className="content">
        {card ? <ReportCard card={card} academy={academy} /> : (
          <div className="panel" style={{ padding: 18 }}><div className="sub">No report card for this student and month.</div></div>
        )}
      </div>
    </>
  );
}
