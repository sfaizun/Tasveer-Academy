import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, monthName } from "@/lib/format";
import ExportCsvButton from "@/components/ExportCsvButton";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

const ACTION_LABEL: Record<string, string> = { insert: "Created", update: "Changed", delete: "Deleted" };
const ENTITY_LABEL: Record<string, string> = {
  payment: "Payment", payment_allocation: "Payment allocation", invoice: "Invoice", invoice_line: "Invoice line",
  enrolment: "Enrolment", student: "Student", app_user: "Account", subject: "Subject",
  teacher_subject: "Teacher–subject mapping", fee_rate: "Fee rate", announcement: "Announcement",
};

function short(v: string | null, max = 60) {
  if (v == null) return "—";
  return v.length > max ? v.slice(0, max - 1) + "…" : v;
}

/** A whole-row insert/delete logs the full row as JSON — pull out a few human-relevant
 * fields instead of dumping the raw blob. */
function summarizeRow(json: string | null): string {
  if (!json) return "—";
  try {
    const obj = JSON.parse(json);
    const skip = new Set(["id", "created_at", "updated_at", "created_by", "received_by", "reviewed_by", "voided_by", "auth_id"]);
    const parts = Object.entries(obj)
      .filter(([k, v]) => !skip.has(k) && v !== null && v !== "")
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? short(v, 24) : v}`);
    return parts.join(", ") || "—";
  } catch {
    return short(json);
  }
}

const ENTITY_OPTIONS = Object.keys(ENTITY_LABEL);

export default async function ActivityAuditReport({
  supabase,
  month,
  monthDate,
  fileTag,
  cashDate,
  entity,
}: {
  supabase: Supabase;
  month: string | null;
  monthDate: string | null;
  fileTag: string;
  cashDate?: string;
  entity: string | null;
}) {
  let q = supabase
    .from("audit_log")
    .select("id, entity, entity_id, action, field, old_value, new_value, reason, actor_id, actor_role, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(300);

  if (monthDate) {
    const [y, mo] = month!.split("-").map(Number);
    const nextMonth = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
    q = q.gte("occurred_at", monthDate).lt("occurred_at", nextMonth);
  }
  if (entity) q = q.eq("entity", entity);

  const [{ data: logRows }, { data: users }] = await Promise.all([
    q,
    supabase.from("app_user").select("id, full_name"),
  ]);

  const nameById = new Map(((users ?? []) as any[]).map((u) => [u.id, u.full_name]));
  const rows = ((logRows ?? []) as any[]).map((r) => ({
    ...r,
    actorName: r.actor_id ? nameById.get(r.actor_id) ?? "Unknown" : "System",
  }));

  return (
    <div className="panel">
      <div className="phead" style={{ flexWrap: "wrap" }}>
        <div className="ptitle">Activity / audit log</div>
        <div className="sub">
          {month ? `Changes in ${monthName(monthDate!)}` : "Most recent 300 changes"}
          {entity ? ` — ${ENTITY_LABEL[entity] ?? entity} only` : ""}
        </div>
        <div className="spacer" />
        <ExportCsvButton
          filename={`audit-log-${fileTag}${entity ? `-${entity}` : ""}`}
          headers={["When", "Who", "Role", "Entity", "Action", "Field", "Change", "Reason"]}
          rows={rows.map((r) => [
            r.occurred_at,
            r.actorName,
            r.actor_role ?? "",
            ENTITY_LABEL[r.entity] ?? r.entity,
            ACTION_LABEL[r.action] ?? r.action,
            r.field ?? "",
            r.field ? `${short(r.old_value)} -> ${short(r.new_value)}` : (r.action === "delete" ? summarizeRow(r.old_value) : summarizeRow(r.new_value)),
            r.reason ?? "",
          ])}
        />
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {month && <input type="hidden" name="month" value={month} />}
          {cashDate && <input type="hidden" name="cash_date" value={cashDate} />}
          <label className="lbl" style={{ margin: 0 }}>Entity</label>
          <select name="entity" defaultValue={entity ?? ""} style={selectStyle}>
            <option value="">All</option>
            {ENTITY_OPTIONS.map((e) => (
              <option key={e} value={e}>{ENTITY_LABEL[e]}</option>
            ))}
          </select>
          <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Filter</button>
          {entity && (
            <a
              className="btn ghost"
              href={month ? `/reports?month=${month}` : "/reports"}
              style={{ fontSize: 12, padding: "8px 12px" }}
            >
              Clear
            </a>
          )}
        </form>
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr><th>When</th><th>Who</th><th>Entity</th><th>Action</th><th>Field</th><th>Change</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono sub">{fmtDateTime(r.occurred_at)}</td>
                <td>
                  {r.actorName}
                  {r.actor_role && <span className="sub"> ({r.actor_role})</span>}
                </td>
                <td className="sub">{ENTITY_LABEL[r.entity] ?? r.entity}</td>
                <td className="sub">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="mono sub">{r.field ?? "—"}</td>
                <td className="sub">
                  {r.field ? `${short(r.old_value)} → ${short(r.new_value)}` : (r.action === "delete" ? summarizeRow(r.old_value) : summarizeRow(r.new_value))}
                  {r.reason ? ` (${r.reason})` : ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="sub">Nothing recorded {month ? "in this month" : "yet"}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length === 300 && (
        <div className="sub" style={{ padding: "0 16px 16px" }}>
          Showing the most recent 300 — narrow with the month filter above or the entity filter to see older activity.
        </div>
      )}
    </div>
  );
}
