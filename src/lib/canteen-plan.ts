// Tomorrow's prep plan (PRD section 7). Plain rules rather than a black box, so every number
// can be explained in words on the page. Pure functions: the page loads the data and passes it in.

export type PlanHistoryDay = {
  date: string; // business date, YYYY-MM-DD
  opens: string | null; // "11:00" that weekday's opening time (current hours)
  closes: string | null; // "19:30"
  classes: number; // classes on the schedule that date
  stock: Record<string, {
    stocked: number; // carried in + made + restocked
    sold: number;
    leftover: number;
    soldOutAt: string | null; // "15:42" Dhaka time, if it ran out
  }>;
  askedWhileSoldOut: Record<string, number>; // item_id -> clicks that day
};

export type PlanItem = {
  id: string;
  name: string;
  batchSize: number;
  isPackaged: boolean;
  price: number | null;
  cost: number | null;
  soldLast14: number; // units sold in the last 14 days (any weekday)
  onMenuDays: number; // days since the item was added, so a new item isn't "dropped"
};

export type PlanRequest = { id: string; name: string; asks30: number };

export type PlanFlag = "Make more" | "Make less" | "Keep" | "Consider dropping" | "Not enough history";

export type PlanLine = {
  itemId: string;
  name: string;
  soldByWeek: (number | null)[]; // most recent first; null = not stocked that day
  soldOutCount: number;
  soldOutAround: string | null; // typical sell-out time
  avgLeftover: number | null;
  missed: number; // estimated extra that would have sold, summed over the days used
  suggested: number | null; // null when there isn't enough history
  flag: PlanFlag;
  why: string;
  carryIn: number; // packaged stock expected to carry over into the target day
  expected: number | null; // estimated demand for the day, for "expected sales"
};

export type Plan = {
  lines: PlanLine[];
  tryAdding: { id: string; name: string; asks30: number; why: string }[];
  basis: { days: string[]; usualClasses: number | null; targetClasses: number; factor: number };
};

const WEIGHTS = [0.4, 0.3, 0.2, 0.1];
export const MIN_WEEKS = 3;

function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function fromMinutes(n: number): string {
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Rule 2: if it sold out, estimate what would have sold in the hours still open, capped at half
 * of what actually sold, plus every "asked while sold out" click that day. */
export function missedSales(day: PlanHistoryDay, itemId: string): number {
  const s = day.stock[itemId];
  if (!s || !s.soldOutAt) return 0;
  const asks = day.askedWhileSoldOut[itemId] ?? 0;
  const open = toMinutes(day.opens);
  const close = toMinutes(day.closes);
  const out = toMinutes(s.soldOutAt);
  if (open == null || close == null || out == null) return asks;
  const hoursSelling = Math.max((out - open) / 60, 0.5);
  const hoursLeft = Math.max((close - out) / 60, 0);
  const rate = s.sold / hoursSelling;
  return Math.min(rate * hoursLeft, s.sold * 0.5) + asks;
}

export function buildPlan(opts: {
  targetClasses: number;
  history: PlanHistoryDay[]; // same weekday, most recent first, closed days only
  items: PlanItem[];
  carryIn: Record<string, number>; // packaged items: expected stock left over into the target day
  requests: PlanRequest[];
  weekdayName: string; // "Monday"
}): Plan {
  const history = opts.history.slice(0, 4);
  const withClasses = history.filter((d) => d.classes > 0);
  const usualClasses = withClasses.length ? withClasses.reduce((a, d) => a + d.classes, 0) / withClasses.length : null;
  // Rule 4: scale by the class schedule, within sensible bounds.
  const factor = usualClasses && usualClasses > 0 ? Math.min(Math.max(opts.targetClasses / usualClasses, 0.5), 1.5) : 1;
  const plural = `${opts.weekdayName}s`;

  const lines: PlanLine[] = opts.items.map((item) => {
    const days = history.filter((d) => d.stock[item.id] && d.stock[item.id].stocked > 0);
    const soldByWeek = history.map((d) => (d.stock[item.id] && d.stock[item.id].stocked > 0 ? d.stock[item.id].sold : null));
    const soldOutDays = days.filter((d) => d.stock[item.id].soldOutAt);
    const outTimes = soldOutDays.map((d) => toMinutes(d.stock[item.id].soldOutAt)).filter((x): x is number => x != null).sort((a, b) => a - b);
    const soldOutAround = outTimes.length ? fromMinutes(outTimes[Math.floor(outTimes.length / 2)]) : null;
    const leftRatios = days.map((d) => (d.stock[item.id].stocked ? d.stock[item.id].leftover / d.stock[item.id].stocked : 0));
    const avgLeftover = days.length ? days.reduce((a, d) => a + d.stock[item.id].leftover, 0) / days.length : null;
    const avgLeftRatio = leftRatios.length ? leftRatios.reduce((a, b) => a + b, 0) / leftRatios.length : 0;
    const missedPerDay = days.map((d) => missedSales(d, item.id));
    const missed = missedPerDay.reduce((a, b) => a + b, 0);
    const carryIn = item.isPackaged ? Math.max(opts.carryIn[item.id] ?? 0, 0) : 0;

    // Rule 6 (drop): no sales for 14 days on an item that's been around that long, or a thin margin.
    const margin = item.price && item.cost != null && item.price > 0 ? (item.price - item.cost) / item.price : null;
    const dropReason =
      item.onMenuDays >= 14 && item.soldLast14 === 0
        ? "Nothing sold in the last 14 days."
        : margin != null && margin < 0.1
          ? `Margin is only ${Math.round(margin * 100)}% (price ${item.price}, cost ${item.cost}).`
          : null;

    if (days.length < MIN_WEEKS) {
      return {
        itemId: item.id, name: item.name, soldByWeek, soldOutCount: soldOutDays.length, soldOutAround, avgLeftover, missed,
        suggested: null, flag: dropReason ? "Consider dropping" : "Not enough history",
        why:
          dropReason ??
          `${days.length === 0 ? `No closed ${plural} with this item yet` : `Only ${days.length} ${days.length === 1 ? opts.weekdayName : plural} with this item so far`}; use your own numbers until there are ${MIN_WEEKS}.`,
        carryIn,
        expected: days.length ? (days.reduce((a, d) => a + d.stock[item.id].sold, 0) / days.length) * factor : null,
      };
    }

    // Rules 1 to 3: same weekday, missed sales added back, recent weeks weighted more.
    let wSum = 0;
    let demand = 0;
    history.forEach((d, i) => {
      const s = d.stock[item.id];
      if (!s || s.stocked <= 0) return;
      const w = WEIGHTS[i] ?? 0;
      wSum += w;
      demand += w * (s.sold + missedSales(d, item.id));
    });
    const weighted = wSum ? demand / wSum : 0;
    const scaled = weighted * factor;
    const need = Math.max(scaled - carryIn, 0);
    // Rule 5: round up to how it's made.
    const batch = Math.max(item.batchSize || 1, 1);
    const suggested = need <= 0 ? 0 : Math.ceil(need / batch) * batch;

    let flag: PlanFlag = "Keep";
    const parts: string[] = [];
    if (dropReason) {
      flag = "Consider dropping";
      parts.push(dropReason);
    } else if (soldOutDays.length >= 2) {
      flag = "Make more";
      parts.push(
        `Sold out on ${soldOutDays.length} of the last ${days.length} ${plural}${soldOutAround ? `, around ${soldOutAround}` : ""}` +
          (missed >= 1 ? `; about ${Math.round(missed / days.length)} more a day would have sold.` : "."),
      );
    } else if (avgLeftRatio >= 0.25) {
      flag = "Make less";
      parts.push(`About ${Math.round(avgLeftRatio * 100)}% left over on an average ${opts.weekdayName}.`);
    } else {
      parts.push(soldOutDays.length === 1 ? "Steady; a small top-up for the one sell-out." : "Steady.");
    }
    if (Math.abs(factor - 1) >= 0.1 && usualClasses != null) {
      parts.push(`${opts.targetClasses} classes scheduled against the usual ${Math.round(usualClasses)}, so scaled ${factor > 1 ? "up" : "down"}.`);
    }
    if (carryIn > 0) parts.push(`${carryIn} carried over already counted.`);
    if (batch > 1) parts.push(`Rounded up to batches of ${batch}.`);

    return {
      itemId: item.id, name: item.name, soldByWeek, soldOutCount: soldOutDays.length, soldOutAround, avgLeftover, missed,
      suggested, flag, why: parts.join(" "), carryIn, expected: scaled,
    };
  });

  // Rule 6 (try adding): requests asked for 10+ times in 30 days.
  const tryAdding = opts.requests
    .filter((r) => r.asks30 >= 10)
    .sort((a, b) => b.asks30 - a.asks30)
    .map((r) => ({ id: r.id, name: r.name, asks30: r.asks30, why: `Asked for ${r.asks30} times in the last 30 days.` }));

  return {
    lines,
    tryAdding,
    basis: { days: history.map((d) => d.date), usualClasses, targetClasses: opts.targetClasses, factor },
  };
}
