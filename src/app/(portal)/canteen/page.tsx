import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { taka, fmtDate } from "@/lib/format";
import { requireCanteenAccess } from "./guard";
import { loadDays, loadSales } from "./data";
import { StaleDaysBanner } from "./DayBits";
import { setItemStock } from "./menu/actions";
import {
  canteenStatus, dayLabel, dhakaNow, hhmm, photoUrl, statusLabel, STOCK_COLS, WEEKDAYS, WEEK_ORDER,
  type CanteenCategory, type CanteenClosureRow, type CanteenHoursRow, type CanteenItem, type StockRow,
} from "@/lib/canteen";

export const dynamic = "force-dynamic";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="panel" style={{ padding: "14px 16px" }}>
      <div className="lbl">{label}</div>
      <div style={{ fontSize: 19, fontWeight: 600, color: tone ?? "var(--ink)", marginTop: 4 }}>{value}</div>
      {sub && <div className="sub" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function CanteenHomePage() {
  const { isAdmin } = await requireCanteenAccess();
  const supabase = await createClient();
  const now = dhakaNow();

  const [{ data: categories }, { data: items }, { data: hours }, { data: closures }, { data: logins }] = await Promise.all([
    supabase.from("canteen_category").select("id, name, sort, active").order("sort").order("name"),
    supabase
      .from("canteen_item_current")
      .select("id, category_id, name, photo_path, out_of_stock, archived, sell_price, tags, is_packaged")
      .eq("archived", false)
      .order("name"),
    supabase.from("canteen_hours").select("weekday, is_open, opens_at, closes_at").order("weekday"),
    supabase.from("canteen_closure").select("id, date_from, date_to, reason").gte("date_to", now.date).order("date_from"),
    isAdmin
      ? supabase.from("app_user").select("id, full_name, email, active").eq("role", "canteen_manager")
      : Promise.resolve({ data: null }),
  ]);

  const { day, staleOpen } = await loadDays(supabase);
  const [sales, { data: stock }, { count: openRequests }] = await Promise.all([
    day ? loadSales(supabase, day.id) : Promise.resolve([]),
    day ? supabase.from("canteen_stock_view").select(STOCK_COLS).eq("day_id", day.id) : Promise.resolve({ data: [] }),
    supabase.from("canteen_request").select("id", { count: "exact", head: true }).in("status", ["new", "considering"]),
  ]);
  const live = sales.filter((s) => s.status === "confirmed");
  const salesTotal = live.reduce((a, s) => a + s.total, 0);
  const cashTotal = live.filter((s) => s.payment_method === "cash").reduce((a, s) => a + s.total, 0);
  const soldOutToday = ((stock ?? []) as StockRow[]).filter((s) => s.carried_in + s.prepared_qty + s.restock_qty > 0 && s.available <= 0).length;

  const cats = (categories ?? []) as CanteenCategory[];
  const list = (items ?? []) as CanteenItem[];
  const h = (hours ?? []) as CanteenHoursRow[];
  const c = (closures ?? []) as CanteenClosureRow[];
  const status = statusLabel(canteenStatus(h, c));
  const out = list.filter((i) => i.out_of_stock);
  const noPhoto = list.filter((i) => !i.photo_path).length;
  const noPrice = list.filter((i) => i.sell_price == null).length;
  const nextClosure = c.find((x) => x.date_to >= now.date);
  const openDays = WEEK_ORDER.filter((d) => h.find((x) => x.weekday === d)?.is_open);

  return (
    <>
      <header className="top">
        <h1>{isAdmin ? "Canteen overview" : "Canteen"}</h1>
        <span className={`st ${status.cls}`}><span className="dot" />{status.text}</span>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <StaleDaysBanner days={staleOpen} />

        <div className="panel" style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div className="lbl">{dayLabel(now.date)}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>
              {!day ? "Not opened yet" : day.status === "open" ? "Day open" : "Day closed"}
            </div>
            <div className="sub">
              {!day
                ? "Open the day with the cash in the drawer, then enter today's stock."
                : day.status === "open"
                  ? "Sell, restock during the day, then count the cash at closing."
                  : "Today's cash has been counted. See you tomorrow."}
            </div>
          </div>
          {(!day || day.status === "open") && <Link className="btn" href="/canteen/sell">{day ? "Go to Sell" : "Open today"}</Link>}
          {day?.status === "open" && <Link className="btn ghost" href="/canteen/stock">Today&apos;s stock</Link>}
          {day?.status === "open" && <Link className="btn ghost" href="/canteen/close">Close day</Link>}
        </div>

        {day && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
            <Tile label="Sales today" value={taka(salesTotal)} sub={`${live.length} sale${live.length === 1 ? "" : "s"}`} />
            <Tile label="Cash · bKash" value={`${taka(cashTotal)} · ${taka(salesTotal - cashTotal)}`} sub={`Opening cash ${taka(day.opening_float)}`} />
            <Tile
              label="Sold out today"
              value={String(soldOutToday)}
              tone={soldOutToday ? "var(--warn)" : undefined}
              sub={soldOutToday ? "restock from Today's stock" : "nothing has run out"}
            />
            <Tile label="Open requests" value={String(openRequests ?? 0)} sub="things customers asked for" />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          <Tile
            label={`Today · ${WEEKDAYS[now.weekday]}`}
            value={status.text}
            sub={openDays.length ? `Open ${openDays.length} days a week` : "No opening hours set"}
          />
          <Tile label="On the menu" value={String(list.length)} sub={`${cats.filter((x) => x.active).length} categories`} />
          <Tile
            label="Out of stock"
            value={String(out.length)}
            tone={out.length ? "var(--warn)" : undefined}
            sub={out.length ? "shown greyed on the sell screen" : "everything available"}
          />
          <Tile
            label="Next closure"
            value={nextClosure ? fmtDate(nextClosure.date_from) : "None planned"}
            sub={nextClosure?.reason}
          />
        </div>

        {isAdmin && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Canteen login</div>
              <div className="spacer" />
              <Link className="btn ghost" href="/accounts" style={{ fontSize: 12, padding: "6px 10px" }}>Manage in Accounts</Link>
            </div>
            <div style={{ padding: 16 }}>
              {(logins ?? []).length === 0 ? (
                <div className="sub">
                  No canteen manager login yet. Create one in <Link href="/accounts">Accounts</Link> under
                  &ldquo;Give the canteen manager a login&rdquo;.
                </div>
              ) : (
                (logins ?? []).map((l: any) => (
                  <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ color: "var(--ink)" }}>{l.full_name}</b>
                    <span className="sub">{l.email}</span>
                    <span className={`st ${l.active ? "paid" : "due"}`}><span className="dot" />{l.active ? "Active" : "Deactivated"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {(out.length > 0 || noPhoto > 0 || noPrice > 0) && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Needs attention</div></div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {out.map((i) => (
                <div key={i.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="st past"><span className="dot" />Out of stock</span>
                  <b style={{ color: "var(--ink)" }}>{i.name}</b>
                  <form action={setItemStock}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="out_of_stock" value="false" />
                    <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "5px 10px" }}>Back in stock</button>
                  </form>
                </div>
              ))}
              {noPhoto > 0 && (
                <div className="sub">
                  {noPhoto} item{noPhoto === 1 ? " has" : "s have"} no photo yet. Photos make the sell screen much faster to use.{" "}
                  <Link href="/canteen/menu">Add photos</Link>
                </div>
              )}
              {noPrice > 0 && <div className="sub" style={{ color: "var(--crit)" }}>{noPrice} item(s) have no price.</div>}
            </div>
          </div>
        )}

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Menu at a glance</div>
            <div className="spacer" />
            <Link className="btn ghost" href="/canteen/menu" style={{ fontSize: 12, padding: "6px 10px" }}>Edit menu</Link>
          </div>
          {list.length === 0 ? (
            <div style={{ padding: 16 }} className="sub">
              Nothing on the menu yet. <Link href="/canteen/menu">Add the first item</Link> with its price and a photo.
            </div>
          ) : (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
              {cats
                .filter((cat) => list.some((i) => i.category_id === cat.id))
                .map((cat) => (
                  <div key={cat.id}>
                    <div className="lbl" style={{ marginBottom: 8 }}>{cat.name}</div>
                    <div className="cgrid">
                      {list
                        .filter((i) => i.category_id === cat.id)
                        .map((i) => {
                          const url = photoUrl(i.photo_path);
                          return (
                            <div key={i.id} className={i.out_of_stock ? "ccard out" : "ccard"}>
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt={i.name} />
                              ) : (
                                <span className="ccard-ph">No photo</span>
                              )}
                              <div className="ccard-name">{i.name}</div>
                              <div className="ccard-row">
                                <span className="mono">{i.sell_price != null ? taka(i.sell_price) : "No price"}</span>
                                {i.out_of_stock && <span className="st past" style={{ fontSize: 10.5 }}>Out</span>}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="phead">
            <div className="ptitle">This week&apos;s hours</div>
            <div className="spacer" />
            <Link className="btn ghost" href="/canteen/hours" style={{ fontSize: 12, padding: "6px 10px" }}>Change hours</Link>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {WEEK_ORDER.map((d) => {
              const row = h.find((x) => x.weekday === d);
              const today = d === now.weekday;
              return (
                <span key={d} className="chip" style={today ? { borderColor: "var(--coral)", color: "var(--ink)" } : undefined}>
                  <b style={{ fontWeight: 600 }}>{WEEKDAYS[d].slice(0, 3)}</b>{" "}
                  {row?.is_open ? `${hhmm(row.opens_at)} to ${hhmm(row.closes_at)}` : "Closed"}
                </span>
              );
            })}
          </div>
        </div>

        <div className="sub">
          Sales, best sellers, busy hours and wastage are on <Link href="/canteen/reports">Reports</Link>. The{" "}
          <Link href="/canteen/plan">Prep plan</Link> suggests how much to make each day once there are 3 weeks of sales.
        </div>
      </div>
    </>
  );
}
