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

export function dhakaToday() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

export function currentBillingMonth() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
