import { createClient } from "@/lib/supabase/server";
import { dhakaTodayISO } from "@/lib/format";
import { addDays, holidayDates, kindLabel, loadHolidays } from "@/lib/holidays";

/** Dashboard / schedule panel: holidays happening now or in the next 60 days. Shows nothing when
 * there are none. `manageLink` adds a link to the Holidays page (office). */
export default async function UpcomingHolidays({ manageLink = false }: { manageLink?: boolean }) {
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const list = (await loadHolidays(supabase, today, addDays(today, 60))).slice(0, 5);
  if (!list.length && !manageLink) return null;
  return (
    <div className="panel">
      <div className="phead" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="ptitle">Upcoming holidays</div>
        <div className="sub">No classes on these days</div>
        <div style={{ flex: 1 }} />
        {manageLink && <a href="/holidays" style={{ fontSize: 13 }}>Manage holidays →</a>}
      </div>
      {list.length === 0 ? (
        <div className="sub" style={{ padding: "14px 18px" }}>No holidays in the next 60 days.</div>
      ) : list.map((h) => (
        <div key={h.id} style={{ padding: "10px 18px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <b style={{ color: "var(--ink)", flex: "1 1 180px" }}>{h.name}</b>
          <span className="mono" style={{ fontSize: 12.5 }}>{holidayDates(h)}</span>
          {h.start_date <= today ? <span className="st paid"><span className="dot" />Now</span> : <span className="st due">{kindLabel(h.kind)}</span>}
          {h.note && <div className="sub" style={{ width: "100%" }}>{h.note}</div>}
        </div>
      ))}
    </div>
  );
}
