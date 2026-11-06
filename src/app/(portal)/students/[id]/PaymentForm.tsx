"use client";
import { useActionState, useRef, useEffect, useMemo, useState } from "react";
import { recordPayment, setPaidItems } from "./actions";
import { dhakaTodayISO, taka } from "@/lib/format";
import Req from "@/components/Req";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13.5, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

const TYPE_LABEL: Record<string, string> = {
  admission: "Admission fee", tuition: "Tuition", mock: "Mock exam", adjustment: "Other charge",
};

/** One fee on an invoice with what is paid and left on it (fn_invoice_items). */
export type PayItem = {
  line_id: string;
  invoice_id: string;
  invoice_no?: string;
  type: string;
  description: string;
  net: number;
  paid: number;
  balance: number;
  ticked?: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The ticked fees in the order they are paid: the server fills them from the first down, so the
 * fee chosen to keep the shortfall goes last. */
function payOrder(ticked: PayItem[], dueOn: string | null) {
  if (!dueOn || !ticked.some((i) => i.line_id === dueOn)) return ticked;
  return [...ticked.filter((i) => i.line_id !== dueOn), ...ticked.filter((i) => i.line_id === dueOn)];
}

/** What each fee gets when `amount` is spread over `order` from the top, each up to `cap(i)`. */
function spread(order: PayItem[], amount: number, cap: (i: PayItem) => number) {
  let left = amount;
  return order.map((i) => {
    const take = round2(Math.max(0, Math.min(left, cap(i))));
    left = round2(left - take);
    return { item: i, take, due: round2(cap(i) - take) };
  });
}

const feeName = (i: PayItem) => i.description;

/** When the money doesn't cover every ticked fee: choose which fee keeps what is still due. */
function DueOn({ ticked, shortBy, dueOn, setDueOn, rows }: {
  ticked: PayItem[]; shortBy: number; dueOn: string | null; setDueOn: (id: string) => void;
  rows: { item: PayItem; take: number; due: number }[];
}) {
  const current = dueOn && ticked.some((i) => i.line_id === dueOn) ? dueOn : ticked[ticked.length - 1]?.line_id;
  return (
    <div style={{ border: "1px dashed var(--warn)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label className="sub" htmlFor="due-on" style={{ color: "var(--ink)" }}>
          <b className="mono">{taka(shortBy)}</b> is still due. Leave it on:
        </label>
        <select id="due-on" value={current} onChange={(e) => setDueOn(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 200, padding: "6px 10px", fontSize: 13 }}>
          {ticked.map((i) => (
            <option key={i.line_id} value={i.line_id}>{feeName(i)}{i.invoice_no ? ` (${i.invoice_no})` : ""}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {rows.map((r) => (
          <div key={r.item.line_id} className="sub" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span>{feeName(r.item)}</span>
            <span className="mono" style={{ whiteSpace: "nowrap" }}>
              {taka(r.take)} paid{r.due > 0 && <b style={{ color: "var(--crit)" }}> · {taka(r.due)} due</b>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemList({
  items, checked, toggle, showInvoice, mode,
}: {
  items: PayItem[];
  checked: Set<string>;
  toggle: (id: string) => void;
  showInvoice: boolean;
  mode: "pay" | "fix";
}) {
  let lastInv = "";
  return (
    <div className="pay-items">
      {items.map((it) => {
        const head = showInvoice && it.invoice_id !== lastInv ? it.invoice_no ?? "" : null;
        lastInv = it.invoice_id;
        return (
          <div key={it.line_id}>
            {head && <div className="lbl" style={{ margin: "8px 0 4px" }}>{head}</div>}
            <label className="pay-item">
              <input type="checkbox" checked={checked.has(it.line_id)} onChange={() => toggle(it.line_id)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {!it.description.toLowerCase().startsWith((TYPE_LABEL[it.type] ?? it.type).toLowerCase()) && <span className="sub">{TYPE_LABEL[it.type] ?? it.type} </span>}{it.description}
              </span>
              <span className="mono" style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                {mode === "pay" ? taka(it.balance) : taka(it.net)}
                {mode === "pay" && it.paid > 0 && <span className="sub" style={{ display: "block", fontSize: 11.5 }}>left of {taka(it.net)}</span>}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

/** Records a payment against the ticked fees. Ticking fills the amount with what is left on the
 * ticked fees; if the amount is lowered, the office chooses which ticked fee keeps what is still
 * due and the others are paid in full first (the server pays them in the order sent). Anything over
 * goes to the oldest open invoice, then stays as advance credit. */
export default function PaymentForm({
  studentId,
  invoiceId,
  items,
  onDone,
}: {
  studentId: string;
  invoiceId?: string;
  items: PayItem[];
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(recordPayment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const today = dhakaTodayISO();
  const open = useMemo(() => items.filter((i) => i.balance > 0), [items]);
  // On an invoice every fee starts ticked (paying it in full); on the student page nothing is ticked.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(invoiceId ? open.map((i) => i.line_id) : []));
  const tickedTotal = round2(open.filter((i) => checked.has(i.line_id)).reduce((s, i) => s + i.balance, 0));
  const [amount, setAmount] = useState<string>(tickedTotal > 0 ? String(tickedTotal) : "");
  const [dueOn, setDueOn] = useState<string | null>(null);

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
    const t = round2(open.filter((i) => next.has(i.line_id)).reduce((s, i) => s + i.balance, 0));
    setAmount(t > 0 ? String(t) : "");
  };

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setChecked(new Set());
      setAmount("");
      setDueOn(null);
      onDone?.();
    }
  }, [state, onDone]);

  const needTick = open.length > 0 && checked.size === 0;
  const amt = Number(amount) || 0;
  const multiInvoice = new Set(open.map((i) => i.invoice_id)).size > 1;
  const tickedItems = open.filter((i) => checked.has(i.line_id));
  const order = payOrder(tickedItems, dueOn);
  const shortBy = amt > 0 && amt < tickedTotal ? round2(tickedTotal - amt) : 0;
  const rows = shortBy > 0 ? spread(order, amt, (i) => i.balance) : [];

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="student_id" value={studentId} />
      {invoiceId && <input type="hidden" name="invoice_id" value={invoiceId} />}
      {order.map((i) => <input key={i.line_id} type="hidden" name="line_ids" value={i.line_id} />)}

      {open.length > 0 && (
        <div className="field">
          <label className="lbl">Paying for<Req /></label>
          <ItemList items={open} checked={checked} toggle={toggle} showInvoice={!invoiceId || multiInvoice} mode="pay" />
          <div className="sub" style={{ marginTop: 4 }}>
            Ticked: <b className="mono">{taka(tickedTotal)}</b>
            {shortBy > 0 && tickedItems.length === 1 && <> · {taka(shortBy)} stays due on it</>}
            {amt > tickedTotal && tickedTotal > 0 && <> · {taka(round2(amt - tickedTotal))} over goes to the oldest open invoice, then advance credit</>}
          </div>
          {shortBy > 0 && tickedItems.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <DueOn ticked={tickedItems} shortBy={shortBy} dueOn={dueOn} setDueOn={setDueOn} rows={rows} />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Amount (৳)<Req /></label>
          <input style={inputStyle} type="number" name="amount" min="0.01" step="0.01" required
            value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label className="lbl">Method<Req /></label>
          <select style={inputStyle} name="method" defaultValue="cash" required>
            <option value="cash">Cash</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="field">
          <label className="lbl">Date received<Req /></label>
          <input style={inputStyle} type="date" name="received_on" defaultValue={today} max={today} required />
        </div>
        <div className="field">
          <label className="lbl">Note (optional)</label>
          <input style={inputStyle} type="text" name="note" placeholder="e.g. paid by father" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending || needTick}>
          {pending ? "Recording…" : "Record payment"}
        </button>
        {needTick && <span className="sub" style={{ color: "var(--warn)" }}>Tick the fees this payment is for.</span>}
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Payment recorded.</span>}
      </div>
      <div className="sub">
        {open.length > 0
          ? "The payment goes only to the ticked fees. Admission fees go to office income; subject fees go to their teacher."
          : "Nothing is owing, so this payment is kept as advance credit and used on the next invoice."}
      </div>
    </form>
  );
}

/** Partly paid invoice: tick which fees the money already paid was for (top first). */
export function PaidItemsForm({
  studentId, invoiceId, items, paid, onDone,
}: {
  studentId: string;
  invoiceId: string;
  items: PayItem[];
  paid: number;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(setPaidItems, null);
  const list = useMemo(() => items.filter((i) => i.net > 0), [items]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(list.filter((i) => i.ticked).map((i) => i.line_id)));
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };
  const total = round2(list.filter((i) => checked.has(i.line_id)).reduce((s, i) => s + i.net, 0));
  const short = total < paid;
  const [dueOn, setDueOn] = useState<string | null>(null);
  const tickedItems = list.filter((i) => checked.has(i.line_id));
  const order = payOrder(tickedItems, dueOn);
  const dueBy = !short && total > paid ? round2(total - paid) : 0;
  const rows = dueBy > 0 ? spread(order, paid, (i) => i.net) : [];

  useEffect(() => { if (state?.ok) onDone?.(); }, [state, onDone]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      {order.map((i) => <input key={i.line_id} type="hidden" name="line_ids" value={i.line_id} />)}
      <div className="sub">{taka(paid)} has been paid on this invoice. Tick the fees it was for, then choose which fee keeps what is still due.</div>
      <ItemList items={list} checked={checked} toggle={toggle} showInvoice={false} mode="fix" />
      <div className="sub">
        Ticked: <b className="mono">{taka(total)}</b>
        {short && checked.size > 0 && <span style={{ color: "var(--warn)" }}> · less than the {taka(paid)} paid, tick more</span>}
      </div>
      {dueBy > 0 && tickedItems.length > 1 && (
        <DueOn ticked={tickedItems} shortBy={dueBy} dueOn={dueOn} setDueOn={setDueOn} rows={rows} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending || checked.size === 0 || short}>
          {pending ? "Saving…" : "Save paid items"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}
