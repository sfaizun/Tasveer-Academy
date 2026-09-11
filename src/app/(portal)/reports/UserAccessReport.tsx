import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import ExportCsvButton from "@/components/ExportCsvButton";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const ROLE_LABEL: Record<string, string> = { admin: "Admin", teacher: "Teacher", student: "Student", guardian: "Guardian" };

/**
 * A periodic-security-review view over `app_user` — every login account, active or
 * deactivated, by role — plus how many teachers/students still don't have one yet
 * (the same underlying data the Accounts page uses to build its "give a login" pickers).
 */
export default async function UserAccessReport({ supabase }: { supabase: Supabase }) {
  const [{ data: accounts }, { data: teachersNoLogin }, { data: studentsNoLogin }] = await Promise.all([
    supabase.from("app_user").select("id, full_name, email, phone, role, is_owner, active, created_at").order("role").order("full_name"),
    supabase.from("teacher").select("id").is("app_user_id", null).eq("active", true),
    supabase.from("student").select("id").is("app_user_id", null).in("status", ["applicant", "active", "on_hold"]),
  ]);

  const rows = (accounts ?? []) as any[];
  const byRole = new Map<string, { active: number; inactive: number }>();
  for (const a of rows) {
    const cur = byRole.get(a.role) ?? { active: 0, inactive: 0 };
    if (a.active) cur.active++;
    else cur.inactive++;
    byRole.set(a.role, cur);
  }
  const totalActive = rows.filter((a) => a.active).length;
  const totalInactive = rows.length - totalActive;
  const teachersGap = (teachersNoLogin ?? []).length;
  const studentsGap = (studentsNoLogin ?? []).length;

  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">User access / login report</div>
        <div className="sub">
          {rows.length} account{rows.length === 1 ? "" : "s"} — {totalActive} active
          {totalInactive > 0 ? `, ${totalInactive} deactivated` : ""}
        </div>
        <div className="spacer" />
        <ExportCsvButton
          filename="user-access"
          headers={["Name", "Role", "Email", "Phone", "Owner", "Status", "Created"]}
          rows={rows.map((a) => [
            a.full_name,
            ROLE_LABEL[a.role] ?? a.role,
            a.email ?? "",
            a.phone ?? "",
            a.is_owner ? "Yes" : "",
            a.active ? "Active" : "Deactivated",
            a.created_at ? String(a.created_at).slice(0, 10) : "",
          ])}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, padding: "0 16px 16px" }}>
        {Array.from(byRole.entries()).map(([role, v]) => (
          <div key={role} className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="lbl">{ROLE_LABEL[role] ?? role}</div>
            <div className="mono" style={{ fontWeight: 600 }}>{v.active} active</div>
            {v.inactive > 0 && <div className="sub" style={{ color: "var(--crit)" }}>{v.inactive} deactivated</div>}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="panel" style={{ padding: "10px 14px", background: "var(--tint)" }}>
            <div className="sub">No accounts yet.</div>
          </div>
        )}
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Role</th><th>Contact</th><th>Created</th><th className="n">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <b>{a.full_name}</b>
                  {a.is_owner && <span className="sub"> (owner)</span>}
                </td>
                <td className="sub">{ROLE_LABEL[a.role] ?? a.role}</td>
                <td className="sub">{[a.email, a.phone].filter(Boolean).join(" · ") || "—"}</td>
                <td className="mono sub">{fmtDate(a.created_at)}</td>
                <td className="n">
                  {a.active ? (
                    <span className="st paid"><span className="dot" />Active</span>
                  ) : (
                    <span className="st over"><span className="dot" />Deactivated</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="sub">No accounts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(teachersGap > 0 || studentsGap > 0) && (
        <div className="sub" style={{ padding: "0 16px 16px" }}>
          {teachersGap} teacher{teachersGap === 1 ? "" : "s"} and {studentsGap} student{studentsGap === 1 ? "" : "s"} still
          don&apos;t have a login — give one from the <a href="/accounts">Accounts</a> page.
        </div>
      )}
    </div>
  );
}
