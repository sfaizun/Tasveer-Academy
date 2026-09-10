/** Bangladeshi lakh grouping: 684500 -> "6,84,500". */
export function taka(n: number | string | null | undefined, opts?: { decimals?: boolean }) {
  const v = Number(n ?? 0);
  return (
    "৳" +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: opts?.decimals ? 2 : 0,
      maximumFractionDigits: opts?.decimals ? 2 : 0,
    })
  );
}

export function monthName(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** House date format: 10-SEP-2026. Accepts a plain "YYYY-MM-DD" (or the date part of an
 * ISO timestamp) and formats it directly from the string — no Date object, so there's no
 * timezone shift risk for a date-only value like a due date or billing month. */
export function fmtDate(input: string | null | undefined): string {
  if (!input) return "—";
  const m = input.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return input;
  const [, y, mo, d] = m;
  const mi = Number(mo) - 1;
  if (mi < 0 || mi > 11) return input;
  return `${d}-${MONTH_ABBR[mi]}-${y}`;
}

/** House date+time format in Asia/Dhaka wall-clock time: 10-SEP-2026, 3:45 PM. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const datePart = fmtDate(`${get("year")}-${get("month")}-${get("day")}`);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });
  return `${datePart}, ${time}`;
}

export function dhakaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Dhaka" });
  return `${weekday}, ${fmtDate(`${get("year")}-${get("month")}-${get("day")}`)}`;
}

/** Today's date in Asia/Dhaka as YYYY-MM-DD, for date-input max attributes and server checks. */
export function dhakaTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function currentBillingMonth() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
