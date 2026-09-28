"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { fmtDateTime, taka } from "@/lib/format";
import type { Plan, PlanFlag } from "@/lib/canteen-plan";
import { savePlan } from "../day-actions";

const FLAG_CLS: Record<PlanFlag, string> = {
  "Make more": "due",
  "Make less": "due",
  Keep: "paid",
  "Consider dropping": "past",
  "Not enough history": "",
};

export default function PlanEditor({
  planDate, dayName, weekdayName, plan, items, saved, savedAt, historyLabels,
}: {
  planDate: string;
  dayName: string;
  weekdayName: string;
  plan: Plan;
  items: { id: string; price: number | null; cost: number | null }[];
  saved: Record<string, number>;
  savedAt: string | null;
  historyLabels: string[];
}) {
  const [state, action, pending] = useActionState(savePlan, null);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      plan.lines.map((l) => [l.itemId, saved[l.itemId] != null ? String(saved[l.itemId]) : l.suggested != null ? String(l.suggested) : ""]),
    ),
  );
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  const byId = new Map(items.map((i) => [i.id, i]));
  let cost = 0;
  let sales = 0;
  for (const l of plan.lines) {
    const n = Number(qty[l.itemId] || 0);
    const it = byId.get(l.itemId);
    cost += n * (it?.cost ?? 0);
    const expected = l.expected != null ? Math.min(n + l.carryIn, l.expected) : n;
    sales += expected * (it?.price ?? 0);
  }
  const enough = plan.lines.some((l) => l.suggested != null);
  const hasSaved = Object.keys(saved).length > 0;
  const b = plan.basis;

  return (
    <form action={action} className="panel">
      <input type="hidden" name="plan_date" value={planDate} />
      <div className="phead" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="ptitle">Suggested for {dayName}</div>
        <div className="sub">
          {b.targetClasses} class{b.targetClasses === 1 ? "" : "es"} scheduled
          {b.usualClasses != null ? ` (usually ${Math.round(b.usualClasses)})` : ""}
          {" · "}
          {b.days.length ? `based on the last ${b.days.length} ${weekdayName}${b.days.length === 1 ? "" : "s"}` : `no closed ${weekdayName}s yet`}
        </div>
        <div className="spacer" />
        {hasSaved && savedAt && <span className="st paid"><span className="dot" />Plan saved {fmtDateTime(savedAt)}</span>}
      </div>

      {!enough && (
        <div className="sub" style={{ padding: "12px 16px 0" }}>
          There isn&apos;t enough history for suggestions yet: the plan needs at least 3 closed {weekdayName}s with each item. Until then,
          enter your own numbers here and save them, and the flags below will start appearing as sales build up.
        </div>
      )}

      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Last {historyLabels.length || 4} {weekdayName}s sold</th>
              <th>Sold out</th>
              <th className="n">Left over (avg)</th>
              <th className="n">Suggested</th>
              <th className="n">Plan</th>
              <th>Flag</th>
              <th style={{ minWidth: 220 }}>Why</th>
            </tr>
          </thead>
          <tbody>
            {plan.lines.map((l) => {
              const soldDays = l.soldByWeek.filter((x) => x != null).length;
              return (
                <tr key={l.itemId}>
                  <td>
                    <input type="hidden" name="item_id" value={l.itemId} />
                    <input type="hidden" name={`sug_${l.itemId}`} value={l.suggested ?? ""} />
                    <input type="hidden" name={`flag_${l.itemId}`} value={l.flag} />
                    <input type="hidden" name={`why_${l.itemId}`} value={l.why} />
                    <b style={{ color: "var(--ink)" }}>{l.name}</b>
                    {l.carryIn > 0 && <div className="sub">{l.carryIn} carrying over</div>}
                  </td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>
                    {l.soldByWeek.length ? l.soldByWeek.map((x) => (x == null ? "–" : x)).join(" · ") : "—"}
                  </td>
                  <td className="sub" style={{ whiteSpace: "nowrap" }}>
                    {soldDays === 0 ? "—" : l.soldOutCount ? `${l.soldOutCount} of ${soldDays}${l.soldOutAround ? `, ~${l.soldOutAround}` : ""}` : "Never"}
                  </td>
                  <td className="n mono">{l.avgLeftover == null ? "—" : Math.round(l.avgLeftover)}</td>
                  <td className="n mono">{l.suggested ?? "—"}</td>
                  <td className="n">
                    <input
                      className="qty-in" type="number" min="0" step="1" inputMode="numeric" name={`qty_${l.itemId}`}
                      value={qty[l.itemId] ?? ""} placeholder="0" aria-label={`${l.name} planned quantity`}
                      onChange={(e) => { setQty((s) => ({ ...s, [l.itemId]: e.target.value })); setDirty(true); }}
                    />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.flag === "Not enough history" ? (
                      <span className="sub">Not enough history</span>
                    ) : (
                      <span className={`st ${FLAG_CLS[l.flag]}`}><span className="dot" />{l.flag}</span>
                    )}
                  </td>
                  <td className="sub">{l.why}</td>
                </tr>
              );
            })}
            {plan.tryAdding.map((r) => (
              <tr key={r.id}>
                <td><b style={{ color: "var(--ink)" }}>{r.name}</b><div className="sub">Request, not on the menu</div></td>
                <td className="sub" colSpan={5}>—</td>
                <td style={{ whiteSpace: "nowrap" }}><span className="st paid"><span className="dot" />Try adding</span></td>
                <td className="sub">{r.why} <Link href="/canteen/requests">See requests</Link></td>
              </tr>
            ))}
            {plan.lines.length === 0 && (
              <tr><td colSpan={8} className="sub">No counted items on the menu.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line2)" }}>
        <span className="sub">
          Estimated cost of this plan <b className="mono" style={{ color: "var(--ink)" }}>{taka(cost)}</b>
          {" · "}expected sales <b className="mono" style={{ color: "var(--ink)" }}>{taka(sales)}</b>
        </span>
        <div className="spacer" style={{ flex: 1 }} />
        {dirty && !pending && <span className="sub" style={{ color: "var(--warn)" }}>Unsaved changes</span>}
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && !dirty && <span className="sub" style={{ color: "var(--ok)" }}>Saved. It will fill in Today&apos;s stock that morning.</span>}
        <button className="btn" type="submit" disabled={pending || plan.lines.length === 0}>
          {pending ? "Saving…" : hasSaved ? "Update this plan" : "Use this plan"}
        </button>
      </div>
    </form>
  );
}
