"use client";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { taka } from "@/lib/format";
import { dhakaTime, photoUrl, type CanteenCategory } from "@/lib/canteen";
import { logRequest, logSoldOutAsk, plusOneRequest, recordSale } from "../day-actions";
import { newRef, QUEUE_EVENT, readQueue, writeQueue, type QueuedSale } from "./offlineQueue";

export type SellItem = {
  id: string;
  category_id: string;
  name: string;
  photo_path: string | null;
  price: number | null;
  out_of_stock: boolean;
  track_stock: boolean;
  available: number;
  stocked: boolean;
  sold_out_at: string | null;
};

type Line = { id: string; qty: number };

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

const NOTES = [50, 100, 200, 500, 1000];

/** Why an item can't be added right now, or null if it can. */
function blocked(i: SellItem, inCart: number): string | null {
  if (i.price == null) return "No price";
  if (i.out_of_stock) return "Out of stock";
  if (!i.track_stock) return null;
  if (!i.stocked) return "Not in today's stock";
  if (i.available - inCart <= 0) return i.available <= 0 ? `Sold out${i.sold_out_at ? " " + dhakaTime(i.sold_out_at) : ""}` : "All in this sale";
  return null;
}

function RequestPanel({ requests, onClose }: { requests: { id: string; name: string }[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(logRequest, null);
  const ref = useRef<HTMLFormElement>(null);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (state?.ok) {
      setDone("Request logged.");
      ref.current?.reset();
    }
  }, [state]);

  return (
    <div className="panel" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <b style={{ color: "var(--ink)" }}>Someone asked for something we don&apos;t have</b>
        <div className="spacer" style={{ flex: 1 }} />
        <button type="button" className="linkbtn" onClick={onClose}>Close</button>
      </div>
      {requests.length > 0 && (
        <div>
          <div className="lbl" style={{ marginBottom: 6 }}>Already asked for: click to add one more ask</div>
          <div className="fchips">
            {requests.map((r) => (
              <form key={r.id} action={async (fd) => { await plusOneRequest(fd); setDone(`+1 for ${r.name}.`); }}>
                <input type="hidden" name="request_id" value={r.id} />
                <button className="fchip" type="submit">+1 {r.name}</button>
              </form>
            ))}
          </div>
        </div>
      )}
      <form ref={ref} action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label className="lbl" htmlFor="rq-name">Something new</label>
          <input id="rq-name" style={inputStyle} name="name" placeholder="e.g. Cold coffee" required />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="rq-who">Who asked</label>
          <select id="rq-who" style={inputStyle} name="who" defaultValue="student">
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="other">Someone else</option>
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label className="lbl" htmlFor="rq-note">Note</label>
          <input id="rq-note" style={inputStyle} name="note" placeholder="Optional" />
        </div>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Log request"}</button>
      </form>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {done && !state?.error && <span className="sub" style={{ color: "var(--ok)" }}>{done}</span>}
    </div>
  );
}

export default function SellScreen({
  items: itemsProp,
  categories,
  requests,
}: {
  items: SellItem[];
  categories: CanteenCategory[];
  requests: { id: string; name: string }[];
}) {
  const [cart, setCart] = useState<Line[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [hi, setHi] = useState(0);
  const [method, setMethod] = useState<"cash" | "bkash">("cash");
  const [received, setReceived] = useState("");
  const [bkashRef, setBkashRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{ receipt: string; total: number; change: number; method: string; offline?: boolean } | null>(null);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const syncing = useRef(false);

  // Sales waiting on this laptop reduce what's shown as left, until they reach the database.
  const items = useMemo(() => {
    const pending = new Map<string, number>();
    for (const q of queue) for (const l of q.lines) pending.set(l.item_id, (pending.get(l.item_id) ?? 0) + l.qty);
    return pending.size ? itemsProp.map((i) => ({ ...i, available: i.available - (pending.get(i.id) ?? 0) })) : itemsProp;
  }, [itemsProp, queue]);

  // Keep the offline queue in view and send it whenever the connection is back.
  useEffect(() => {
    const load = () => setQueue(readQueue());
    load();
    async function syncNow() {
      if (syncing.current) return;
      syncing.current = true;
      try {
        for (const q of readQueue()) {
          if (q.error) continue;
          let res;
          try {
            res = await recordSale({
              lines: q.lines.map((l) => ({ item_id: l.item_id, qty: l.qty })),
              method: q.method, cashReceived: q.cashReceived, bkashRef: q.bkashRef, soldAt: q.soldAt, clientRef: q.clientRef,
            });
          } catch {
            break; // still offline; try again later
          }
          const now = readQueue();
          writeQueue(res.ok ? now.filter((x) => x.clientRef !== q.clientRef) : now.map((x) => (x.clientRef === q.clientRef ? { ...x, error: res.error } : x)));
        }
      } finally {
        syncing.current = false;
      }
    }
    syncNowRef.current = syncNow;
    const t = window.setInterval(syncNow, 15000);
    window.addEventListener("online", syncNow);
    window.addEventListener(QUEUE_EVENT, load);
    window.addEventListener("storage", load);
    syncNow();
    return () => {
      window.clearInterval(t);
      window.removeEventListener("online", syncNow);
      window.removeEventListener(QUEUE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  const syncNowRef = useRef<() => void>(() => {});
  const [askedMsg, setAskedMsg] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const qtyOf = (id: string) => cart.find((l) => l.id === id)?.qty ?? 0;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => (cat === "all" || i.category_id === cat) && (!q || i.name.toLowerCase().includes(q)));
  }, [items, cat, search]);
  const addable = visible.filter((i) => !blocked(i, qtyOf(i.id)));
  const highlighted = search.trim() ? addable[Math.min(hi, Math.max(addable.length - 1, 0))] : undefined;

  const total = cart.reduce((a, l) => a + (byId.get(l.id)?.price ?? 0) * l.qty, 0);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const receivedNum = received.trim() === "" ? null : Number(received);
  const change = receivedNum != null && Number.isFinite(receivedNum) ? receivedNum - total : null;

  function add(id: string, by = 1) {
    const item = byId.get(id);
    if (!item) return;
    setError(null);
    setLastSale(null);
    setCart((c) => {
      const cur = c.find((l) => l.id === id)?.qty ?? 0;
      let next = cur + by;
      if (item.track_stock) next = Math.min(next, item.available);
      if (next <= 0) return c.filter((l) => l.id !== id);
      return c.some((l) => l.id === id) ? c.map((l) => (l.id === id ? { ...l, qty: next } : l)) : [...c, { id, qty: next }];
    });
    setLastId(id);
  }

  function clearAll() {
    setCart([]);
    setReceived("");
    setBkashRef("");
    setError(null);
    setLastId(null);
  }

  function complete() {
    if (cart.length === 0 || pending) return;
    if (method === "cash" && change != null && change < 0) {
      setError("The cash received is less than the total.");
      return;
    }
    setError(null);
    const clientRef = newRef();
    const soldAt = new Date().toISOString();
    const payload = {
      lines: cart.map((l) => ({ item_id: l.id, qty: l.qty })),
      method,
      cashReceived: method === "cash" ? receivedNum : null,
      bkashRef: method === "bkash" ? bkashRef : null,
    };
    start(async () => {
      let res;
      try {
        res = await recordSale({ ...payload, clientRef });
      } catch {
        // No answer: the internet is down. Keep the sale on this laptop and send it later.
        writeQueue([
          ...readQueue(),
          {
            clientRef, soldAt, method, cashReceived: payload.cashReceived, bkashRef: payload.bkashRef, total,
            lines: cart.map((l) => ({ item_id: l.id, qty: l.qty, name: byId.get(l.id)?.name ?? "Item" })),
          },
        ]);
        res = { ok: true as const, receipt: "", total, change: method === "cash" && receivedNum != null ? receivedNum - total : 0, offline: true };
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLastSale({ receipt: res.receipt, total: res.total, change: res.change, method, offline: "offline" in res });
      setCart([]);
      setReceived("");
      setBkashRef("");
      setMethod("cash");
      setLastId(null);
      setSearch("");
      searchRef.current?.focus();
    });
  }

  function askedWhileSoldOut(item: SellItem) {
    start(async () => {
      const res = await logSoldOutAsk(item.id);
      setAskedMsg(res.error ?? `Noted: someone asked for ${item.name} while it was sold out.`);
    });
  }

  // Keyboard: typing anywhere goes to the search box; Ctrl+Enter completes; Esc clears.
  const keyRef = useRef({ complete, add, clearAll, lastId });
  keyRef.current = { complete, add, clearAll, lastId };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = keyRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        k.complete();
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === "+" || e.key === "=") && k.lastId) {
        e.preventDefault();
        k.add(k.lastId, 1);
      } else if (e.key === "-" && k.lastId) {
        e.preventDefault();
        k.add(k.lastId, -1);
      } else if (e.key === "Escape") {
        k.clearAll();
      } else if (e.key.length === 1 && /[\p{L}\p{N}]/u.test(e.key)) {
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const target = highlighted ?? (addable.length === 1 ? addable[0] : undefined);
      if (target) {
        add(target.id);
        setSearch("");
        setHi(0);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, Math.max(addable.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (search) setSearch("");
      else clearAll();
    } else if ((e.key === "+" || e.key === "=") && !search && lastId) {
      e.preventDefault();
      add(lastId, 1);
    } else if (e.key === "-" && !search && lastId) {
      e.preventDefault();
      add(lastId, -1);
    }
  }

  const catsWithItems = categories.filter((c) => items.some((i) => i.category_id === c.id));

  const queueTotal = queue.reduce((a, q) => a + q.total, 0);

  return (
    <>
    {queue.length > 0 && (
      <div className="panel" style={{ padding: "12px 16px", borderColor: "var(--warn)", background: "var(--warn-soft)", marginBottom: 16 }}>
        <b style={{ color: "var(--ink)" }}>
          {queue.length} sale{queue.length === 1 ? "" : "s"} ({taka(queueTotal)}) saved on this laptop, not sent yet.
        </b>{" "}
        <span className="sub">
          They are sent automatically when the internet is back. Keep this page open, and don&apos;t close the day until they&apos;re sent.
        </span>
        {queue.some((q) => q.error) && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {queue.filter((q) => q.error).map((q) => (
              <div key={q.clientRef} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="sub" style={{ color: "var(--crit)" }}>
                  {q.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")} ({taka(q.total)}, {dhakaTime(q.soldAt)}): {q.error}
                </span>
                <button
                  type="button" className="linkbtn"
                  onClick={() => { writeQueue(readQueue().map((x) => (x.clientRef === q.clientRef ? { ...x, error: null } : x))); syncNowRef.current(); }}
                >Try again</button>
                <button
                  type="button" className="linkbtn"
                  onClick={() => writeQueue(readQueue().filter((x) => x.clientRef !== q.clientRef))}
                >Remove (I&apos;ll record it again)</button>
              </div>
            ))}
            <span className="sub">Add stock on Today&apos;s stock if it ran out, then Try again.</span>
          </div>
        )}
      </div>
    )}
    <div className="sell-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div className="panel" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            ref={searchRef}
            style={{ ...inputStyle, fontSize: 14, padding: "10px 12px" }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setHi(0); }}
            onKeyDown={onSearchKey}
            placeholder="Type to search, Enter to add"
            aria-label="Search items"
            autoFocus
          />
          <div className="fchips">
            <button type="button" className={cat === "all" ? "fchip on" : "fchip"} onClick={() => setCat("all")}>All</button>
            {catsWithItems.map((c) => (
              <button key={c.id} type="button" className={cat === c.id ? "fchip on" : "fchip"} onClick={() => setCat(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="panel sub" style={{ padding: 16 }}>
            Nothing on the menu yet. <Link href="/canteen/menu">Add items</Link> first.
          </div>
        ) : (
          <div className="pgrid">
            {visible.map((i) => {
              const inCart = qtyOf(i.id);
              const why = blocked(i, inCart);
              const url = photoUrl(i.photo_path);
              const left = i.available - inCart;
              const soldOut = i.track_stock && i.stocked && i.available <= 0 && !i.out_of_stock;
              return (
                <div key={i.id} className={"pcard" + (why ? " off" : "") + (highlighted?.id === i.id ? " hi" : "") + (inCart ? " incart" : "")}>
                  <button type="button" className="pcard-btn" onClick={() => add(i.id)} disabled={!!why || pending}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" />
                    ) : (
                      <span className="pcard-ph">{i.name.slice(0, 1)}</span>
                    )}
                    <span className="pcard-name">{i.name}</span>
                    <span className="pcard-row">
                      <b className="mono">{i.price != null ? taka(i.price) : "—"}</b>
                      <span
                        className="pcard-left"
                        style={{ color: why ? "var(--crit)" : i.track_stock && left < 5 ? "var(--warn)" : undefined }}
                      >
                        {why ?? (i.track_stock ? `${left} left` : "Made to order")}
                      </span>
                    </span>
                    {inCart > 0 && <span className="pcard-badge">{inCart}</span>}
                  </button>
                  {soldOut && (
                    <button type="button" className="pcard-ask" onClick={() => askedWhileSoldOut(i)} disabled={pending}>
                      Someone asked for it
                    </button>
                  )}
                  {i.track_stock && !i.stocked && !i.out_of_stock && (
                    <Link className="pcard-ask" href="/canteen/stock">Add to today&apos;s stock</Link>
                  )}
                </div>
              );
            })}
            {visible.length === 0 && <div className="sub" style={{ padding: 8 }}>No items match &ldquo;{search}&rdquo;.</div>}
          </div>
        )}

        <div className="kbd-hints sub">
          <span><kbd>type</kbd> search</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> pick</span>
          <span><kbd>Enter</kbd> add</span>
          <span><kbd>+</kbd> / <kbd>−</kbd> last item</span>
          <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> complete sale</span>
          <span><kbd>Esc</kbd> clear</span>
        </div>

        {askedMsg && <div className="sub" style={{ color: "var(--ok)" }}>{askedMsg}</div>}
        {showRequest ? (
          <RequestPanel requests={requests} onClose={() => setShowRequest(false)} />
        ) : (
          <div>
            <button type="button" className="btn ghost" onClick={() => setShowRequest(true)}>+ Log a request</button>{" "}
            <span className="sub">when someone asks for something we don&apos;t sell</span>
          </div>
        )}
      </div>

      <div className="panel cart">
        <div className="phead">
          <div className="ptitle">Current sale</div>
          <div className="spacer" />
          <span className="sub">{count} item{count === 1 ? "" : "s"}</span>
        </div>
        <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 2, minHeight: 90 }}>
          {cart.length === 0 && (
            <div className="sub" style={{ padding: "18px 0", textAlign: "center" }}>
              Click an item or type its name to start a sale.
            </div>
          )}
          {cart.map((l) => {
            const item = byId.get(l.id)!;
            return (
              <div key={l.id} className={"cline" + (l.id === lastId ? " last" : "")}>
                <div style={{ minWidth: 0 }}>
                  <div className="cline-name">{item.name}</div>
                  <div className="sub mono">{taka(item.price ?? 0)} each</div>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => add(l.id, -1)} aria-label={`One less ${item.name}`}>−</button>
                  <span className="mono">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => add(l.id, 1)}
                    disabled={item.track_stock && l.qty >= item.available}
                    aria-label={`One more ${item.name}`}
                  >+</button>
                </div>
                <div className="mono" style={{ width: 62, textAlign: "right", color: "var(--ink)" }}>{taka((item.price ?? 0) * l.qty)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: "1px solid var(--line2)", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="lbl">Total</span>
            <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{taka(total)}</span>
          </div>

          <div className="paytabs" role="radiogroup" aria-label="Payment method">
            {(["cash", "bkash"] as const).map((m) => (
              <button
                key={m} type="button" role="radio" aria-checked={method === m}
                className={method === m ? "on" : ""} onClick={() => setMethod(m)}
              >
                {m === "cash" ? "Cash" : "bKash"}
              </button>
            ))}
          </div>

          {method === "cash" ? (
            <>
              <div className="field">
                <label className="lbl" htmlFor="sell-recv">Cash received</label>
                <input
                  id="sell-recv" style={{ ...inputStyle, fontSize: 15 }} type="number" min="0" step="1" inputMode="numeric"
                  value={received} onChange={(e) => setReceived(e.target.value)} placeholder={total ? `${total} (exact)` : "0"}
                />
              </div>
              <div className="fchips">
                {NOTES.filter((n) => n >= total && total > 0).slice(0, 4).map((n) => (
                  <button key={n} type="button" className="fchip" onClick={() => setReceived(String(n))}>৳{n}</button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="lbl">Change to give</span>
                <span
                  className="mono"
                  style={{ fontSize: 18, fontWeight: 600, color: change != null && change < 0 ? "var(--crit)" : "var(--ok)" }}
                >
                  {change == null ? taka(0) : change < 0 ? `${taka(-change)} short` : taka(change)}
                </span>
              </div>
            </>
          ) : (
            <div className="field">
              <label className="lbl" htmlFor="sell-ref">bKash transaction ID or sender&apos;s last 4 digits</label>
              <input
                id="sell-ref" style={inputStyle} value={bkashRef} onChange={(e) => setBkashRef(e.target.value)}
                placeholder="Optional, helps match the app at closing" maxLength={40}
              />
            </div>
          )}

          <button
            type="button" className="btn" onClick={complete}
            disabled={cart.length === 0 || pending}
            style={{ justifyContent: "center", fontSize: 15, padding: "11px 14px" }}
          >
            {pending ? "Saving…" : cart.length ? `Complete sale · ${taka(total)}` : "Complete sale"}
          </button>
          {cart.length > 0 && (
            <button type="button" className="linkbtn" onClick={clearAll} style={{ alignSelf: "center" }}>Clear sale</button>
          )}
          {error && <div className="sub" style={{ color: "var(--crit)" }}>{error}</div>}
          {lastSale && (
            <div className="sale-done">
              <div>
                {lastSale.offline ? (
                  <><b>Saved on this laptop</b> <span className="sub">(offline; it will be sent automatically)</span></>
                ) : (
                  <><b>Sale saved</b> <span className="mono">{lastSale.receipt}</span></>
                )}
              </div>
              <div className="mono">
                {taka(lastSale.total)} {lastSale.method === "cash" ? `· change ${taka(lastSale.change)}` : "· bKash"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
