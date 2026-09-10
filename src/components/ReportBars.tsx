import { taka } from "@/lib/format";

export type ReportBarRow = { key: string; label: string; sublabel?: string; received: number; due: number };

/** A simple dependency-free horizontal bar chart: one proportional received/due bar per row,
 * scaled against the largest (received + due) total in the set. Green = received, red = due. */
export default function ReportBars({ rows, emptyLabel }: { rows: ReportBarRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <div className="sub" style={{ padding: "14px 0" }}>{emptyLabel}</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.received + r.due));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map((r) => {
        const receivedPct = (r.received / max) * 100;
        const duePct = (r.due / max) * 100;
        return (
          <div key={r.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.label}</span>
                {r.sublabel && <span className="sub" style={{ marginLeft: 6 }}>{r.sublabel}</span>}
              </div>
              <div className="mono sub" style={{ flex: "0 0 auto", fontSize: 12.5, whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--ok)" }}>{taka(r.received)}</span>
                {" / "}
                <span style={{ color: r.due > 0 ? "var(--crit)" : undefined }}>{taka(r.due)} due</span>
              </div>
            </div>
            <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", background: "var(--tint2)" }}>
              {receivedPct > 0 && <div style={{ width: `${receivedPct}%`, background: "var(--ok)" }} />}
              {duePct > 0 && <div style={{ width: `${duePct}%`, background: "var(--crit)" }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
