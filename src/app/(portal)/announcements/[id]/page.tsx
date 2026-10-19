import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import { dhakaTodayISO, fmtDate } from "@/lib/format";
import AutoPrint from "@/app/(portal)/invoices/[id]/AutoPrint";
import { fmtDhaka, targetLabel } from "../shared";
import { requirePage } from "@/lib/require-page";

export const dynamic = "force-dynamic";

/** One announcement as a clean, printable notice. Anyone who can see the announcement can
 * open it (row level security decides); ?print=1 opens the print dialog. */
export default async function AnnouncementPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  await requirePage("announcements");
  const { id } = await params;
  const { print } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("announcement")
    .select(
      "id, title, body, urgency, scope, status, requires_ack, published_at, expires_at, created_at, " +
        "announcement_target(class_group(subject(name, level), batch_name), class_level(name, programme(name))), " +
        "announcement_attachment(file_path)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const a: any = data;
  const audience = targetLabel((a.announcement_target ?? [])[0] ?? null, a.scope);
  const image = (a.announcement_attachment ?? [])[0]?.file_path as string | undefined;

  return (
    <>
      {print === "1" && <AutoPrint />}
      <header className="top no-print">
        <h1>Announcement</h1>
        <div className="spacer" />
        <a className="btn ghost" href="/announcements" style={{ fontSize: 12, padding: "6px 10px" }}>
          Back to announcements
        </a>
        <PrintButton label="Print announcement" />
      </header>

      <div className="content">
        <div className="panel inv-doc">
          <div className="inv-doc-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Tasveer Academy" className="inv-doc-logo" />
            <div>
              <div className="inv-doc-name">Tasveer Academy</div>
              <div className="sub">105/A (2nd &amp; 3rd Floor), Kakrail, Dhaka 1000</div>
            </div>
            <div className="spacer" />
            <div style={{ textAlign: "right" }}>
              <div className="inv-doc-title">NOTICE</div>
              {a.urgency === "urgent" && <div style={{ fontWeight: 700, color: "var(--crit)", letterSpacing: ".08em" }}>URGENT</div>}
            </div>
          </div>

          <div className="inv-doc-meta">
            <div>
              <div className="lbl">For</div>
              <b style={{ color: "var(--ink)" }}>{audience}</b>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="lbl">Date</div>
              <div className="mono">{fmtDhaka(a.published_at ?? a.created_at)}</div>
              {a.expires_at && (
                <>
                  <div className="lbl" style={{ marginTop: 8 }}>Valid until</div>
                  <div className="mono">{fmtDhaka(a.expires_at)}</div>
                </>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: 20, color: "var(--ink)", margin: "6px 0 12px" }}>{a.title}</h2>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.6, color: "var(--ink)" }}>{a.body}</div>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" style={{ maxWidth: "100%", maxHeight: 520, borderRadius: 8, display: "block", margin: "16px 0 0" }} />
          )}
          {a.requires_ack && (
            <div className="sub" style={{ marginTop: 16 }}>Students are asked to acknowledge this notice on the portal.</div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <span className="sub">Printed {fmtDate(dhakaTodayISO())}</span>
            <span className="sub">Authorised by: ____________________</span>
          </div>
        </div>
      </div>
    </>
  );
}
