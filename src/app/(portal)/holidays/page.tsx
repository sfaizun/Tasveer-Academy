import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import { viewReadOnly } from "@/lib/access";
import { type Holiday, holidayDates, kindLabel } from "@/lib/holidays";
import { HolidayForm, HolidayRowActions } from "./HolidayForm";

export const dynamic = "force-dynamic";

/** Academy holidays (government holidays, Eid, summer and winter vacations and any other day off).
 * No classes run and no attendance is taken on these days; attendance already taken on a day that
 * becomes a holiday stays on record but is left out of every percentage. */
export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePage("holidays");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const readOnly = viewReadOnly(me);
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const sp = await searchParams;
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : Number(today.slice(0, 4));
  const { data } = await supabase.from("holiday").select("id, name, kind, start_date, end_date, note")
    .lte("start_date", `${year}-12-31`).gte("end_date", `${year}-01-01`).order("start_date");
  const list = (data ?? []) as Holiday[];
  const upcoming = list.filter((h) => h.end_date >= today);
  const past = list.filter((h) => h.end_date < today).reverse();

  const Row = ({ h }: { h: Holiday }) => {
    const now = h.start_date <= today && today <= h.end_date;
    return (
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <b style={{ color: "var(--ink)" }}>{h.name}</b>
          <span className="st due">{kindLabel(h.kind)}</span>
          {now && <span className="st paid"><span className="dot" />Today</span>}
        </div>
        <div className="mono" style={{ fontSize: 13 }}>{holidayDates(h)}</div>
        {h.note && <div className="sub">{h.note}</div>}
        {!readOnly && <div style={{ marginTop: 4 }}><HolidayRowActions holiday={h} /></div>}
      </div>
    );
  };

  return (
    <>
      <header className="top">
        <h1>Holidays</h1>
        <div className="sub">No classes or attendance on these days</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {!readOnly && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Add a holiday</div></div>
            <div style={{ padding: "14px 18px" }}><HolidayForm /></div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a className="btn ghost" href={`/holidays?year=${year - 1}`} style={{ fontSize: 12, padding: "6px 10px" }}>← {year - 1}</a>
          <b style={{ fontSize: 15 }}>{year}</b>
          <a className="btn ghost" href={`/holidays?year=${year + 1}`} style={{ fontSize: 12, padding: "6px 10px" }}>{year + 1} →</a>
        </div>

        <div className="panel">
          <div className="phead"><div className="ptitle">Upcoming ({upcoming.length})</div></div>
          {upcoming.length ? upcoming.map((h) => <Row key={h.id} h={h} />) : <div className="sub" style={{ padding: "14px 18px" }}>No upcoming holidays in {year}.</div>}
        </div>
        {past.length > 0 && (
          <details className="panel">
            <summary className="phead" style={{ cursor: "pointer" }}><div className="ptitle">Past ({past.length})</div></summary>
            {past.map((h) => <Row key={h.id} h={h} />)}
          </details>
        )}
      </div>
    </>
  );
}
