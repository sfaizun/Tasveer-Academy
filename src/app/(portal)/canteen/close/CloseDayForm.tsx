"use client";
import { useActionState, useState } from "react";
import { taka } from "@/lib/format";
import { closeDay } from "../day-actions";

export type LeftLine = {
  stock_id: string;
  name: string;
  is_packaged: boolean;
  left: number;
  unit_cost: number | null;
  wasted: number | null;
  carry: number | null;
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

function Diff({ n }: { n: number | null }) {
  if (n == null) return <span className="sub">Enter the amount</span>;
  if (Math.abs(n) < 0.005) return <span style={{ color: "var(--ok)", fontWeight: 600 }}>Matches</span>;
  return (
    <span style={{ color: "var(--crit)", fontWeight: 600 }}>
      {n < 0 ? `${taka(-n)} short` : `${taka(n)} over`}
    </span>
  );
}

export default function CloseDayForm({
  dayId,
  dayName,
  lines,
  openingFloat,
  cashSales,
  bkashSales,
  showCost,
}: {
  dayId: string;
  dayName: string;
  lines: LeftLine[];
  openingFloat: number;
  cashSales: { count: number; total: number };
  bkashSales: { count: number; total: number };
  showCost: boolean;
}) {
  const [state, action, pending] = useActionState(closeDay, null);
  const [waste, setWaste] = useState<Record<string, string>>({});
  const [counted, setCounted] = useState("");
  const [bkash, setBkash] = useState("");
  const [note, setNote] = useState("");

  const expectedCash = openingFloat + cashSales.total;
  const cashDiff = counted.trim() === "" ? null : Number(counted) - expectedCash;
  const bkashDiff = bkash.trim() === "" ? null : Number(bkash) - bkashSales.total;
  const mismatch = (cashDiff != null && Math.abs(cashDiff) >= 0.005) || (bkashDiff != null && Math.abs(bkashDiff) >= 0.005);

  const wastedOf = (l: LeftLine) => {
    if (!l.is_packaged) return l.left;
    const n = Math.floor(Number(waste[l.stock_id] ?? 0) || 0);
    return Math.min(Math.max(n, 0), l.left);
  };
  const wasteCost = lines.reduce((a, l) => a + wastedOf(l) * (l.unit_cost ?? 0), 0);

  return (
    <form action={action} className="close-grid">
      <input type="hidden" name="day_id" value={dayId} />

      <div className="panel">
        <div className="phead">
          <div className="ptitle">1. Leftovers</div>
          <div className="sub">Fresh food can&apos;t be sold tomorrow, so all of it counts as wasted</div>
        </div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr><th>Item</th><th className="n">Left</th><th className="n">Wasted</th><th className="n">Carry over</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const w = wastedOf(l);
                return (
                  <tr key={l.stock_id}>
                    <td>
                      <b style={{ color: "var(--ink)" }}>{l.name}</b>
                      <div className="sub">{l.is_packaged ? "Packaged: unsold stock carries over" : "Fresh"}</div>
                    </td>
                    <td className="n mono">{l.left}</td>
                    <td className="n">
                      {l.is_packaged && l.left > 0 ? (
                        <input
                          className="qty-in" type="number" min="0" max={l.left} step="1" inputMode="numeric"
                          name={`waste_${l.stock_id}`} value={waste[l.stock_id] ?? ""} placeholder="0"
                          onChange={(e) => setWaste((s) => ({ ...s, [l.stock_id]: e.target.value }))}
                          aria-label={`${l.name} damaged or expired`}
                        />
                      ) : (
                        <span className="mono">{w}</span>
                      )}
                    </td>
                    <td className="n mono">{l.is_packaged ? l.left - w : 0}</td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={4} className="sub">No counted stock today.</td></tr>}
            </tbody>
          </table>
        </div>
        {showCost && lines.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line2)" }} className="sumrow">
            <span>Wastage at cost</span><b className="mono">{taka(wasteCost)}</b>
          </div>
        )}
        <div className="sub" style={{ padding: "0 16px 14px" }}>
          For packaged items, enter only what is damaged or expired; the rest carries over to tomorrow.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="panel">
          <div className="phead"><div className="ptitle">2. Cash drawer</div></div>
          <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="sumrow"><span>Opening cash</span><b className="mono">{taka(openingFloat)}</b></div>
            <div className="sumrow"><span>Cash sales ({cashSales.count})</span><b className="mono">{taka(cashSales.total)}</b></div>
            <div className="sumrow"><span>Should be in the drawer</span><b className="mono">{taka(expectedCash)}</b></div>
            <div className="field" style={{ marginTop: 10 }}>
              <label className="lbl" htmlFor="cl-cash">Counted in the drawer (৳)</label>
              <input
                id="cl-cash" style={{ ...inputStyle, fontSize: 15 }} name="cash_counted" type="number" min="0" step="1"
                inputMode="numeric" required value={counted} onChange={(e) => setCounted(e.target.value)}
              />
            </div>
            <div className="sumrow"><span>Difference</span><Diff n={cashDiff} /></div>
          </div>
        </div>

        <div className="panel">
          <div className="phead"><div className="ptitle">3. bKash</div></div>
          <div style={{ padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="sumrow"><span>bKash sales recorded ({bkashSales.count})</span><b className="mono">{taka(bkashSales.total)}</b></div>
            <div className="field" style={{ marginTop: 10 }}>
              <label className="lbl" htmlFor="cl-bk">Received today, from the bKash app (৳)</label>
              <input
                id="cl-bk" style={{ ...inputStyle, fontSize: 15 }} name="bkash_reported" type="number" min="0" step="1"
                inputMode="numeric" required value={bkash} onChange={(e) => setBkash(e.target.value)}
                placeholder={bkashSales.total ? undefined : "0"}
              />
            </div>
            <div className="sumrow"><span>Difference</span><Diff n={bkashDiff} /></div>
          </div>
        </div>

        <div className="panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field">
            <label className="lbl" htmlFor="cl-note">Note{mismatch ? " (needed: the money doesn't match)" : ""}</label>
            <textarea
              id="cl-note" name="note" value={note} onChange={(e) => setNote(e.target.value)} required={mismatch}
              style={{ ...inputStyle, minHeight: 60, resize: "vertical", borderColor: mismatch && !note.trim() ? "var(--crit)" : undefined }}
              placeholder={mismatch ? "What happened? e.g. change given twice by mistake around 17:00" : "Optional"}
            />
          </div>
          <button className="btn" type="submit" disabled={pending || (mismatch && !note.trim())} style={{ justifyContent: "center" }}>
            {pending ? "Closing…" : `Close ${dayName}`}
          </button>
          <div className="sub">After closing, no more sales can be recorded for this day. Only admin can reopen it.</div>
          {state?.error && <div className="sub" style={{ color: "var(--crit)" }}>{state.error}</div>}
        </div>
      </div>
    </form>
  );
}
