import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import ExportCsvButton from "@/components/ExportCsvButton";
import { targetLabel } from "../announcements/shared";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/**
 * Reach & acknowledgment for the last 20 published announcements — how many of the
 * students who were actually eligible to see each one have (per `announcement_receipt`,
 * now wired up by the announcements page/dashboard on every view, and by the new
 * "Acknowledge" button for anything marked as requiring it). Eligibility is worked out
 * the same way the `announcement` RLS policy itself scopes a viewer's own feed: academy
 * scope reaches every active student, a subject-class target reaches its active
 * enrolments, a junior-class target reaches active students in that class level.
 */
export default async function AnnouncementReachReport({
  supabase,
  selectedId,
  month,
  cashDate,
}: {
  supabase: Supabase;
  selectedId?: string;
  month: string | null;
  cashDate?: string;
}) {
  const [{ data: annRows }, { data: students }, { data: enrolments }] = await Promise.all([
    supabase
      .from("announcement")
      .select("id, title, scope, urgency, requires_ack, published_at, announcement_target(class_group_id, class_level_id)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(20),
    supabase.from("student").select("id, full_name, reg_no, class_level_id").eq("status", "active"),
    supabase.from("enrolment").select("student_id, class_group_id").eq("status", "active"),
  ]);

  const anns = (annRows ?? []) as any[];
  const annIds = anns.map((a) => a.id);

  const { data: receiptRows } = annIds.length
    ? await supabase.from("announcement_receipt").select("announcement_id, student_id, read_at, acknowledged_at").in("announcement_id", annIds)
    : { data: [] as any[] };

  const activeStudents = (students ?? []) as any[];
  const allActiveIds = activeStudents.map((s) => s.id);

  const byClassLevel = new Map<string, string[]>();
  for (const s of activeStudents) {
    if (!s.class_level_id) continue;
    const arr = byClassLevel.get(s.class_level_id) ?? [];
    arr.push(s.id);
    byClassLevel.set(s.class_level_id, arr);
  }
  const byClassGroup = new Map<string, string[]>();
  for (const e of (enrolments ?? []) as any[]) {
    const arr = byClassGroup.get(e.class_group_id) ?? [];
    arr.push(e.student_id);
    byClassGroup.set(e.class_group_id, arr);
  }

  const readByAnn = new Map<string, Set<string>>();
  const ackByAnn = new Map<string, Set<string>>();
  for (const r of (receiptRows ?? []) as any[]) {
    if (r.read_at) {
      const set = readByAnn.get(r.announcement_id) ?? new Set<string>();
      set.add(r.student_id);
      readByAnn.set(r.announcement_id, set);
    }
    if (r.acknowledged_at) {
      const set = ackByAnn.get(r.announcement_id) ?? new Set<string>();
      set.add(r.student_id);
      ackByAnn.set(r.announcement_id, set);
    }
  }

  const rows = anns.map((a) => {
    const target = (a.announcement_target ?? [])[0] ?? null;
    let eligibleIds: string[];
    if (a.scope === "academy") eligibleIds = allActiveIds;
    else if (target?.class_group_id) eligibleIds = byClassGroup.get(target.class_group_id) ?? [];
    else if (target?.class_level_id) eligibleIds = byClassLevel.get(target.class_level_id) ?? [];
    else eligibleIds = [];
    const readSet = readByAnn.get(a.id) ?? new Set<string>();
    const ackSet = ackByAnn.get(a.id) ?? new Set<string>();
    const seen = eligibleIds.filter((id) => readSet.has(id)).length;
    const acked = eligibleIds.filter((id) => ackSet.has(id)).length;
    return { ...a, target, eligibleIds, eligible: eligibleIds.length, seen, acked, readSet };
  });

  const chosen =
    rows.find((r) => r.id === selectedId) ??
    rows.find((r) => r.requires_ack && r.eligible > r.acked) ??
    rows.find((r) => r.urgency === "urgent" && r.eligible > r.seen) ??
    rows[0];
  const notSeenStudents = chosen
    ? activeStudents.filter((s) => chosen.eligibleIds.includes(s.id) && !chosen.readSet.has(s.id))
    : [];

  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Announcement reach &amp; acknowledgment</div>
        <div className="sub">Last {rows.length} published notice{rows.length === 1 ? "" : "s"} — who&apos;s actually seen and acknowledged each one</div>
        <div className="spacer" />
        <ExportCsvButton
          filename="announcement-reach"
          headers={["Title", "Audience", "Urgency", "Published", "Eligible", "Seen", "Seen %", "Requires ack", "Acknowledged"]}
          rows={rows.map((r) => [
            r.title,
            targetLabel(r.target, r.scope),
            r.urgency,
            r.published_at ? String(r.published_at).slice(0, 10) : "",
            r.eligible,
            r.seen,
            r.eligible ? Math.round((r.seen / r.eligible) * 100) : 0,
            r.requires_ack ? "Yes" : "No",
            r.requires_ack ? r.acked : "",
          ])}
        />
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Title</th><th>Audience</th><th>Urgency</th><th>Published</th>
              <th className="n">Eligible</th><th className="n">Seen</th><th className="n">Ack</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={r.id === chosen?.id ? { background: "var(--tint)" } : undefined}>
                <td><b>{r.title}</b></td>
                <td className="sub">{targetLabel(r.target, r.scope)}</td>
                <td>
                  {r.urgency === "urgent" ? (
                    <span className="st over"><span className="dot" />Urgent</span>
                  ) : (
                    <span className="sub">Normal</span>
                  )}
                </td>
                <td className="mono sub">{fmtDate(r.published_at)}</td>
                <td className="n mono">{r.eligible}</td>
                <td className="n mono" style={{ color: r.eligible > 0 && r.seen < r.eligible ? "var(--crit)" : undefined }}>
                  {r.seen} / {r.eligible}
                  {r.eligible > 0 ? ` (${Math.round((r.seen / r.eligible) * 100)}%)` : ""}
                </td>
                <td className="n mono">{r.requires_ack ? `${r.acked} / ${r.eligible}` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="sub">No published announcements yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {chosen && (
        <div style={{ padding: "0 16px 16px" }}>
          <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "6px 0 10px" }}>
            {month && <input type="hidden" name="month" value={month} />}
            {cashDate && <input type="hidden" name="cash_date" value={cashDate} />}
            <label className="lbl" style={{ margin: 0 }}>Follow up on</label>
            <select name="ann_id" defaultValue={chosen.id} style={selectStyle}>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
            <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Show</button>
          </form>
          <div className="sub" style={{ marginBottom: 8 }}>
            {notSeenStudents.length} of {chosen.eligible} eligible student{chosen.eligible === 1 ? "" : "s"} haven&apos;t seen &ldquo;{chosen.title}&rdquo; yet
          </div>
          {notSeenStudents.length > 0 ? (
            <div className="tblwrap">
              <table>
                <thead><tr><th>Student</th><th>Reg. no.</th></tr></thead>
                <tbody>
                  {notSeenStudents.map((s: any) => (
                    <tr key={s.id}>
                      <td><a href={`/students/${s.id}`}>{s.full_name}</a></td>
                      <td className="mono sub">{s.reg_no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            chosen.eligible > 0 && <div className="sub">Everyone eligible has seen this one.</div>
          )}
        </div>
      )}
    </div>
  );
}
