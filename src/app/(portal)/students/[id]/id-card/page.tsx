import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import IdCard from "@/components/IdCard";
import { requirePage } from "@/lib/require-page";
import { viewReadOnly } from "@/lib/access";
import { loadIdCard } from "@/lib/id-card";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { IssueCard, PrintCard } from "../../../id-cards/IdCardControls";

export const dynamic = "force-dynamic";

/** One student's ID card, front and back, ready to print: each side prints on its own page at
 * the card size (54 x 85.6 mm), for a card printer or "Save as PDF". */
export default async function StudentIdCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("id_cards");
  const { id } = await params;
  const supabase = await createClient();
  const { me } = await getViewer();
  const loaded = await loadIdCard(supabase, id);
  if (!loaded) notFound();
  const { data, card } = loaded;
  const canEdit = !viewReadOnly(me);

  return (
    <>
      {/* Paper = the card itself when printing this page. */}
      <style>{`@media print{@page{size:54mm 85.6mm;margin:0} html,body{background:#fff!important} .content{padding:0!important} .top{display:none!important}}`}</style>
      <header className="top no-print">
        <h1>ID card · {data.student.name}</h1>
        <div className="sub mono">{data.student.regNo}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="panel no-print" style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {card ? (
            <>
              <span className="st paid"><span className="dot" />Issued</span>
              <span className="sub">
                Card {card.issue_no} · {fmtDate(card.issued_at)}{card.issued_by_user ? ` by ${card.issued_by_user.full_name}` : ""}
                {" · "}printed {card.print_count} {card.print_count === 1 ? "time" : "times"}{card.last_printed_at ? ` (last ${fmtDateTime(card.last_printed_at)})` : ""}
              </span>
              <div className="spacer" style={{ flex: 1 }} />
              {canEdit && <PrintCard cardId={card.id} />}
              {canEdit && <IssueCard studentId={id} hasCard />}
            </>
          ) : (
            <>
              <span className="st due"><span className="dot" />No ID card yet</span>
              <div className="spacer" style={{ flex: 1 }} />
              {canEdit && <IssueCard studentId={id} hasCard={false} />}
            </>
          )}
          <a className="btn ghost" href={`/students/${id}`}>Back to student</a>
        </div>
        {!data.links.facebook || !data.links.instagram ? (
          <div className="sub no-print">
            The Facebook and Instagram codes show once their links are added on Fees &amp; settings (ID card links).
          </div>
        ) : null}
        <div style={{ opacity: card ? 1 : 0.55 }}>
          <IdCard d={data} />
        </div>
        <div className="sub no-print" style={{ textAlign: "center" }}>
          Printing makes two card-sized pages (front, then back). For a PDF, choose &quot;Save as PDF&quot; in the print dialog.
          The card always shows the current details from the student&apos;s record.
        </div>
      </div>
    </>
  );
}
