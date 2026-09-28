import { taka } from "@/lib/format";
import { dayLabel, WEEKDAYS, WEEK_ORDER } from "@/lib/canteen";

// Dependency-free charts for canteen reports, rendered on the server. One series each, one hue
// (coral); hover shows the exact figure via the native tooltip, and every chart sits above a table
// with the same numbers, so nothing depends on colour or hover alone.

export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="panel" style={{ padding: "14px 16px" }}>
      <div className="lbl">{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 600, color: tone ?? "var(--ink)", marginTop: 4 }}>{value}</div>
      {sub && <div className="sub" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Section({
  title, sub, actions, children, adminOnly,
}: {
  title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; adminOnly?: boolean;
}) {
  return (
    <details className="panel collapsible" open>
      <summary className="phead" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="ptitle">{title}</div>
        {sub && <div className="sub">{sub}</div>}
        {adminOnly && <span className="chip" style={{ fontSize: 10.5 }}>Admin only</span>}
        <div className="spacer" />
        {actions}
      </summary>
      {children}
    </details>
  );
}

/** Horizontal bars: one row per item, scaled to the largest value. */
export function HBars({
  rows, fmt, empty,
}: {
  rows: { key: string; label: string; value: number; note?: string }[];
  fmt: (n: number) => string;
  empty: string;
}) {
  if (rows.length === 0) return <div className="sub" style={{ padding: "12px 0" }}>{empty}</div>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.key} className="hbar" title={`${r.label}: ${fmt(r.value)}${r.note ? ` (${r.note})` : ""}`}>
          <div className="hbar-top">
            <span className="hbar-label">{r.label}</span>
            <span className="mono hbar-val">{fmt(r.value)}{r.note && <span className="sub"> · {r.note}</span>}</span>
          </div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Sales per day as columns. Days with no row (never opened) are simply absent. */
export function DailyColumns({ days }: { days: { date: string; sales: number; count: number }[] }) {
  if (days.length === 0) return <div className="sub" style={{ padding: 16 }}>No canteen days in this range.</div>;
  const max = Math.max(1, ...days.map((d) => d.sales));
  const every = Math.ceil(days.length / 12);
  return (
    <div className="dcols" role="img" aria-label="Sales per day; the table below has the same figures">
      {days.map((d, i) => (
        <div key={d.date} className="dcol" title={`${dayLabel(d.date)}: ${taka(d.sales)} from ${d.count} sale${d.count === 1 ? "" : "s"}`}>
          <div className="dcol-bar-wrap">
            <div className="dcol-bar" style={{ height: `${Math.max((d.sales / max) * 100, d.sales > 0 ? 2 : 0)}%` }} />
          </div>
          <div className="dcol-lbl">{i % every === 0 ? dayLabel(d.date).slice(4) : ""}</div>
        </div>
      ))}
    </div>
  );
}

/** Average sales per hour for each weekday. A dot marks hours in which classes finish. */
export function Heatmap({
  heat, weekdayDays, changeovers, hourFrom, hourTo,
}: {
  heat: { wd: number; hr: number; count: number; revenue: number }[];
  weekdayDays: Record<string, number>;
  changeovers: { wd: number; hr: number; classes: number }[];
  hourFrom: number;
  hourTo: number;
}) {
  const hours = Array.from({ length: Math.max(hourTo - hourFrom + 1, 1) }, (_, i) => hourFrom + i);
  const avg = (wd: number, hr: number) => {
    const days = weekdayDays[String(wd)] ?? 0;
    const cell = heat.find((h) => h.wd === wd && h.hr === hr);
    return days && cell ? cell.count / days : 0;
  };
  const max = Math.max(0.0001, ...WEEK_ORDER.flatMap((wd) => hours.map((hr) => avg(wd, hr))));
  const days = WEEK_ORDER.filter((wd) => (weekdayDays[String(wd)] ?? 0) > 0);
  if (days.length === 0) return <div className="sub" style={{ padding: 16 }}>No sales in this range yet.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="heat">
        <thead>
          <tr>
            <th />
            {hours.map((h) => <th key={h}>{String(h).padStart(2, "0")}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((wd) => (
            <tr key={wd}>
              <th>{WEEKDAYS[wd].slice(0, 3)}</th>
              {hours.map((hr) => {
                const v = avg(wd, hr);
                const pct = v > 0 ? 12 + (v / max) * 88 : 0;
                const ends = changeovers.find((c) => c.wd === wd && c.hr === hr)?.classes ?? 0;
                return (
                  <td
                    key={hr}
                    title={`${WEEKDAYS[wd]} ${String(hr).padStart(2, "0")}:00: ${v.toFixed(1)} sales on average${ends ? ` · ${ends} class${ends === 1 ? "" : "es"} end` : ""}`}
                    style={{ background: pct ? `color-mix(in oklab, var(--coral) ${pct}%, var(--paper))` : undefined }}
                  >
                    {ends > 0 && <span className="heat-dot" aria-hidden="true" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heat-key sub">
        <span>Quiet</span>
        <span className="heat-ramp" aria-hidden="true" />
        <span>Busy</span>
        <span style={{ marginLeft: 14 }}><span className="heat-dot inline" aria-hidden="true" /> classes finish in that hour</span>
      </div>
    </div>
  );
}

export function pct(n: number, of: number) {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "—";
}

export function diffText(n: number | null) {
  if (n == null) return "Not counted";
  if (Math.abs(n) < 0.005) return "Matches";
  return n < 0 ? `${taka(-n)} short` : `${taka(n)} over`;
}
