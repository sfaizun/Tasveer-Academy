"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { taka } from "@/lib/format";
import { dayLabel, dhakaTime } from "@/lib/canteen";
import { openDay, voidSale } from "./day-actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** Shown on the sell and stock pages until today's business day has been opened. */
export function OpenDayBox({ today, lastFloat }: { today: string; lastFloat?: number | null }) {
  const [state, action, pending] = useActionState(openDay, null);
  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <div className="phead"><div className="ptitle">Open {dayLabel(today)}</div></div>
      <form action={action} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="sub">
          Count the cash already in the drawer before the first sale (the change float). It&apos;s added to the
          cash you should have at closing. Then enter today&apos;s stock.
        </div>
        <div className="field" style={{ maxWidth: 220 }}>
          <label className="lbl" htmlFor="od-float">Cash in the drawer now (৳)</label>
          <input
            id="od-float" style={inputStyle} name="opening_float" type="number" min="0" step="1" inputMode="numeric"
            defaultValue={lastFloat ?? ""} placeholder="0" autoFocus
          />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" type="submit" disabled={pending}>{pending ? "Opening…" : "Open today"}</button>
          {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        </div>
      </form>
    </div>
  );
}

/** Warns when an earlier day was opened but never closed: its leftovers won't carry over until it is. */
export function StaleDaysBanner({ days }: { days: { id: string; business_date: string }[] }) {
  if (days.length === 0) return null;
  return (
    <div className="panel" style={{ padding: "12px 16px", borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
      <b style={{ color: "var(--ink)" }}>
        {days.map((d) => dayLabel(d.business_date)).join(", ")} {days.length === 1 ? "was" : "were"} never closed.
      </b>{" "}
      <span className="sub">
        Close {days.length === 1 ? "it" : "them"} so the cash is counted and packaged leftovers carry over.{" "}
        <Link href={`/canteen/close?day=${days[0].id}`}>Close now</Link>
      </span>
    </div>
  );
}

export type SaleRow = {
  id: string;
  receipt_no: string;
  sold_at: string;
  payment_method: "cash" | "bkash";
  bkash_ref: string | null;
  total: number;
  status: "confirmed" | "void";
  void_reason: string | null;
  lines: { name: string; qty: number }[];
};

function VoidForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(voidSale, null);
  return (
    <form action={action} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <input type="hidden" name="sale_id" value={id} />
      <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, width: 190 }} name="reason" placeholder="Why? e.g. rang up twice" autoFocus required />
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>
        {pending ? "Voiding…" : "Void"}
      </button>
      <button className="linkbtn" type="button" onClick={onDone}>Cancel</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)", width: "100%", textAlign: "right" }}>{state.error}</span>}
    </form>
  );
}

/** A day's sales with a Void button on each (the database decides who may void which day). */
export function SalesList({ sales, canVoid }: { sales: SaleRow[]; canVoid: boolean }) {
  const [voiding, setVoiding] = useState<string | null>(null);
  if (sales.length === 0) return <div className="sub" style={{ padding: 16 }}>No sales yet.</div>;
  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr><th>Receipt</th><th>Time</th><th>Items</th><th>Paid by</th><th className="n">Total</th><th></th></tr>
        </thead>
        <tbody>
          {sales.map((s) => {
            const isVoid = s.status === "void";
            return (
              <tr key={s.id} style={isVoid ? { opacity: 0.6 } : undefined}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{s.receipt_no}</td>
                <td className="mono">{dhakaTime(s.sold_at)}</td>
                <td style={{ minWidth: 160 }}>
                  {s.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}
                  {isVoid && <div className="sub" style={{ color: "var(--crit)" }}>Void: {s.void_reason}</div>}
                </td>
                <td>
                  {s.payment_method === "cash" ? "Cash" : "bKash"}
                  {s.bkash_ref && <div className="sub mono">{s.bkash_ref}</div>}
                </td>
                <td className="n mono" style={isVoid ? { textDecoration: "line-through" } : undefined}>{taka(s.total)}</td>
                <td className="n" style={{ whiteSpace: "nowrap" }}>
                  {isVoid ? (
                    <span className="st past"><span className="dot" />Void</span>
                  ) : !canVoid ? null : voiding === s.id ? (
                    <VoidForm id={s.id} onDone={() => setVoiding(null)} />
                  ) : (
                    <button className="linkbtn" type="button" onClick={() => setVoiding(s.id)}>Void</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
