"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { dhakaTime } from "@/lib/canteen";
import { restock, saveStock } from "../day-actions";

export type StockLine = {
  item_id: string;
  name: string;
  is_packaged: boolean;
  out_of_stock: boolean;
  carried_in: number;
  prepared_qty: number;
  restock_qty: number;
  unit_cost: number | null;
  sold_qty: number;
  sold_out_at: string | null;
  prev: { made: number; sold: number } | null;
  planQty: number | null; // from the saved prep plan for this day
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

function RestockForm({ lines }: { lines: StockLine[] }) {
  const [state, action, pending] = useActionState(restock, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field" style={{ flex: "1 1 200px" }}>
        <label className="lbl" htmlFor="rs-item">Item</label>
        <select id="rs-item" style={inputStyle} name="item_id" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {lines.map((l) => <option key={l.item_id} value={l.item_id}>{l.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="rs-qty">How many more</label>
        <input id="rs-qty" className="qty-in" name="qty" type="number" min="1" step="1" required />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="rs-cost">Cost each (৳)</label>
        <input id="rs-cost" className="qty-in" name="unit_cost" type="number" min="0" step="0.01" inputMode="decimal" placeholder="same" />
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "+ Add stock"}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)", width: "100%" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)", width: "100%" }}>Added. Morning figure kept as it was.</span>}
    </form>
  );
}

export default function StockEditor({
  lines,
  madeToOrder,
  readOnly,
  prevLabel,
}: {
  lines: StockLine[];
  madeToOrder: { name: string; sold: number }[];
  readOnly: boolean;
  prevLabel: string | null;
}) {
  const [state, action, pending] = useActionState(saveStock, null);
  // Morning figures start from the saved prep plan until something has been saved here.
  const fromPlan = !readOnly && lines.every((l) => l.prepared_qty === 0) && lines.some((l) => (l.planQty ?? 0) > 0);
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(
      lines.map((l) => [l.item_id, l.prepared_qty ? String(l.prepared_qty) : fromPlan && l.planQty ? String(l.planQty) : ""]),
    )
  );
  const [dirty, setDirty] = useState(fromPlan);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  const nothingYet = lines.every((l) => l.prepared_qty + l.restock_qty + l.carried_in === 0);

  return (
    <>
      {fromPlan && (
        <div className="panel" style={{ padding: "12px 16px", borderColor: "var(--ok)", background: "var(--ok-soft)" }}>
          <b style={{ color: "var(--ink)" }}>Filled in from today&apos;s prep plan.</b>{" "}
          <span className="sub">Change anything that was made differently, then press Save stock.</span>
        </div>
      )}
      {!readOnly && nothingYet && !fromPlan && lines.length > 0 && (
        <div className="panel" style={{ padding: "12px 16px", borderColor: "var(--coral)", background: "var(--coral-soft)" }}>
          <b style={{ color: "var(--ink)" }}>Enter how many of each item were made or bought today.</b>{" "}
          <span className="sub">Items with nothing entered can&apos;t be sold. Leave an item empty if you don&apos;t have it today.</span>
        </div>
      )}

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Counted items</div>
          <div className="sub">
            {readOnly ? "This day is closed; figures are locked." : "Sold and left update with every sale. Save after changing the morning figures."}
          </div>
        </div>
        <form action={action}>
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="n">Carried over</th>
                  <th className="n">Made / bought</th>
                  <th className="n">Cost each</th>
                  <th className="n">Added later</th>
                  <th className="n">Sold</th>
                  <th className="n">Left</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const q = qty[l.item_id] ?? "";
                  const prep = q === "" ? 0 : Math.max(0, Math.floor(Number(q) || 0));
                  const total = l.carried_in + prep + l.restock_qty;
                  const left = total - l.sold_qty;
                  const tooLow = left < 0;
                  let status: { text: string; cls: string };
                  if (l.out_of_stock) status = { text: "Marked out of stock", cls: "past" };
                  else if (total === 0) status = { text: "Not stocked", cls: "due" };
                  else if (left <= 0) status = { text: `Sold out${l.sold_out_at ? " " + dhakaTime(l.sold_out_at) : ""}`, cls: "past" };
                  else if (left < 5) status = { text: "Low", cls: "due" };
                  else status = { text: "Selling", cls: "paid" };
                  return (
                    <tr key={l.item_id}>
                      <td>
                        <input type="hidden" name="item_id" value={l.item_id} />
                        <b style={{ color: "var(--ink)" }}>{l.name}</b>
                        {l.is_packaged && <span className="sub"> · Packaged</span>}
                        {l.prev && prevLabel && (
                          <div className="sub">{prevLabel}: made {l.prev.made}, sold {l.prev.sold}</div>
                        )}
                        {l.planQty != null && <div className="sub">Plan: {l.planQty}</div>}
                      </td>
                      <td className="n mono">{l.carried_in || "—"}</td>
                      <td className="n">
                        <input
                          className="qty-in" name={`qty_${l.item_id}`} type="number" min="0" step="1" inputMode="numeric"
                          value={q} disabled={readOnly} placeholder="0" aria-label={`${l.name} made or bought`}
                          style={tooLow ? { borderColor: "var(--crit)" } : undefined}
                          onChange={(e) => { setQty((s) => ({ ...s, [l.item_id]: e.target.value })); setDirty(true); }}
                        />
                      </td>
                      <td className="n">
                        <input
                          className="qty-in" name={`cost_${l.item_id}`} type="number" min="0" step="0.01" inputMode="decimal"
                          defaultValue={l.unit_cost ?? ""} disabled={readOnly} aria-label={`${l.name} cost each`}
                          onChange={() => setDirty(true)}
                        />
                      </td>
                      <td className="n mono">{l.restock_qty || "—"}</td>
                      <td className="n mono">{l.sold_qty}</td>
                      <td className="n mono" style={{ color: tooLow ? "var(--crit)" : "var(--ink)", fontWeight: 600 }}>{left}</td>
                      <td style={{ whiteSpace: "nowrap" }}><span className={`st ${status.cls}`}><span className="dot" />{status.text}</span></td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr><td colSpan={8} className="sub">No counted items on the menu. Tick &ldquo;Count stock daily&rdquo; on an item to track it here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!readOnly && lines.length > 0 && (
            <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line2)" }}>
              <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save stock"}</button>
              {dirty && !pending && <span className="sub" style={{ color: "var(--warn)" }}>Unsaved changes</span>}
              {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
              {state?.ok && !dirty && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
            </div>
          )}
        </form>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", alignItems: "start" }}>
        {!readOnly && lines.length > 0 && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Restock during the day</div>
              <div className="sub">Only for a second batch or another crate; the morning quantity goes in &ldquo;Made / bought&rdquo; above</div>
            </div>
            <RestockForm lines={lines} />
          </div>
        )}
        {madeToOrder.length > 0 && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Made to order</div>
              <div className="sub">Not counted; never runs out</div>
            </div>
            <div style={{ padding: "8px 16px 14px" }}>
              {madeToOrder.map((m) => (
                <div key={m.name} className="sumrow"><span>{m.name}</span><b className="mono">{m.sold} sold</b></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
