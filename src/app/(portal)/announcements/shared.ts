export function targetLabel(target: any | null | undefined, scope: string) {
  if (scope === "academy" || !target) return "Whole academy";
  if (target.class_group) {
    const s = target.class_group.subject;
    const level = s?.level ? ` (${String(s.level).toUpperCase()})` : "";
    return `${s?.name ?? "Subject"}${level} — Batch ${target.class_group.batch_name}`;
  }
  if (target.class_level) {
    const prog = target.class_level.programme?.name ?? "";
    return `${target.class_level.name}${prog ? ` (${prog})` : ""}`;
  }
  return "—";
}

export function fmtDhaka(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
}

/** For a <input type="datetime-local"> defaultValue, in Asia/Dhaka wall-clock time. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function isCurrentlyVisible(publish_at: string | null, expires_at: string | null) {
  const now = Date.now();
  if (publish_at && new Date(publish_at).getTime() > now) return false;
  if (expires_at && new Date(expires_at).getTime() < now) return false;
  return true;
}
