import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO, fmtDate, monthName } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin } from "@/lib/access";
import FeeCollectionReport from "./FeeCollectionReport";
import type { CollectionRow, RefundCollectionRow, VoidRow } from "./types";

export const dynamic = "force-dynamic";

const monthInput: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** Monthly Fees Collection, cash basis: every payment received in the chosen calendar month
 * (Dhaka time), whatever month, invoice or session it paid for. The office (an admin view with
 * this page) sees the whole academy; a teacher sees the tuition and mock fees of their own
 * subjects only. Admission fees and other office income never count for a teacher. */
export default async function FeeCollectionPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePage("fee_collection");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const full = actsAsAdmin(me, "fee_collection");
  const sp = await searchParams;
  const thisMonth = dhakaTodayISO().slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? (sp.month as string) : thisMonth;
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one (29 February in a leap year).
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${month}-${String(lastDay).padStart(2, "0")}`;

  const supabase = await createClient();
  const [{ data: rowsData, error }, { data: voidData }, { data: refundData }] = await Promise.all([
    supabase.rpc("fn_fee_collection", { p_month: first, p_mine: !full }),
    supabase.rpc("fn_fee_collection_voids", { p_month: first, p_mine: !full }),
    supabase.rpc("fn_fee_collection_refunds", { p_month: first, p_mine: !full }),
  ]);
  const rows = ((rowsData ?? []) as CollectionRow[]).map((r) => ({ ...r, amount: Number(r.amount), payment_amount: Number(r.payment_amount) }));
  const voids = ((voidData ?? []) as VoidRow[]).map((v) => ({ ...v, amount: Number(v.amount) }));
  const refunds = ((refundData ?? []) as RefundCollectionRow[]).map((r) => ({ ...r, amount: Number(r.amount), refund_amount: Number(r.refund_amount) }));

  return (
    <>
      <header className="top">
        <h1>Monthly Fees Collection</h1>
        <div className="sub">{full ? "Fees received across the academy" : "Fees received for your subjects"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel no-print" style={{ padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label className="lbl" htmlFor="fc-month" style={{ margin: 0 }}>Month</label>
            <input id="fc-month" type="month" name="month" defaultValue={month} max={thisMonth} style={monthInput} required />
            <button className="btn" type="submit" style={{ fontSize: 12, padding: "8px 14px" }}>Show</button>
            {month !== thisMonth && <a className="btn ghost" href="/fee-collection" style={{ fontSize: 12, padding: "8px 12px" }}>This month</a>}
          </form>
          <div className="sub">
            {fmtDate(first)} 00:00:00 to {fmtDate(last)} 23:59:59, Dhaka time
          </div>
        </div>
        {error ? (
          <div className="panel" style={{ padding: 18, color: "var(--crit)" }}>Could not load the collection: {error.message}</div>
        ) : (
          <FeeCollectionReport
            rows={rows}
            voids={voids}
            refunds={refunds}
            month={month}
            monthLabel={monthName(first)}
            period={`${fmtDate(first)} 00:00:00 to ${fmtDate(last)} 23:59:59 (Dhaka time)`}
            full={full}
            scopeLabel={full ? "Whole academy" : `${me.full_name} (your subjects)`}
            linkStudents={full && actsAsAdmin(me, "students")}
            linkInvoices={full && actsAsAdmin(me, "invoices")}
          />
        )}
      </div>
    </>
  );
}
