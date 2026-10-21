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

export { fmtDateTime as fmtDhaka } from "@/lib/format";

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

const postedAt = (a: any) => new Date(a.published_at ?? a.publish_at ?? a.created_at ?? 0).getTime();

/** The announcement feed for students, guardians and teachers: newest first, ended ones kept
 * (marked not live). Scheduled ones are left out before their publish time. With `pastLimit`,
 * only that many ended ones are kept (the dashboard). */
export function feedOf<T extends { publish_at: string | null; expires_at: string | null; status?: string }>(announcements: T[], pastLimit?: number) {
  const all = announcements
    .filter((a) => !a.publish_at || new Date(a.publish_at).getTime() <= Date.now())
    .map((a) => ({ ...a, live: (a.status ?? "published") === "published" && isCurrentlyVisible(a.publish_at, a.expires_at) }))
    .sort((x, y) => postedAt(y) - postedAt(x));
  let past = 0;
  const list = pastLimit === undefined ? all : all.filter((a) => a.live || past++ < pastLimit);
  return { list, total: all.length };
}
