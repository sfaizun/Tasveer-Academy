import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import ActivityAuditReport from "../reports/ActivityAuditReport";

export const dynamic = "force-dynamic";

const monthInputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** GET-submitted month filter — no client JS needed, just a plain form against this page. */
function MonthFilter({ month }: { month: string | null }) {
  return (
    <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <label className="lbl" style={{ margin: 0 }}>Month</label>
      <input type="month" name="month" defaultValue={month ?? ""} style={monthInputStyle} />
      <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>
        Filter
      </button>
      {month && (
        <a className="btn ghost" href="/audit-log" style={{ fontSize: 12, padding: "8px 12px" }}>
          All time
        </a>
      )}
    </form>
  );
}

/**
 * Admin-only Activity / audit log — its own page in the sidebar (previously a section at
 * the bottom of Reports). Same `audit_log` read and the same `ActivityAuditReport`
 * component Reports used to embed; it just has a URL and a nav entry of its own now.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; entity?: string }>;
}) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
  const monthDate = month ? `${month}-01` : null;
  const fileTag = month ?? "all-time";
  const entity = typeof sp.entity === "string" && sp.entity ? sp.entity : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("app_user")
    .select("role")
    .eq("auth_id", user?.id ?? "")
    .maybeSingle();

  if (me?.role !== "admin") redirect("/dashboard");

  return (
    <>
      <header className="top">
        <h1>Audit log</h1>
        <div className="sub">Every recorded change across the academy — who did what, and when</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel" style={{ padding: 16 }}>
          <MonthFilter month={month} />
        </div>

        <ActivityAuditReport supabase={supabase} month={month} monthDate={monthDate} fileTag={fileTag} entity={entity} />
      </div>
    </>
  );
}
