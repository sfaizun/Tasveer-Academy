import { dhakaTodayISO } from "@/lib/format";

/** First day of the current month in Dhaka, e.g. "2026-10-01". */
export function thisMonthISO() {
  return dhakaTodayISO().slice(0, 7) + "-01";
}

type EnrolmentLike = { status?: string | null; from_month?: string | null; to_month?: string | null };

/** Studying the subject this month: active, started, and not yet ended. Mirrors the
 * database's is_current(enrolment). Use for routines, rosters and "students now" counts. */
export function isCurrentEnrolment(e: EnrolmentLike, month = thisMonthISO()) {
  return (
    e.status === "active" &&
    (!e.from_month || e.from_month.slice(0, 10) <= month) &&
    (!e.to_month || e.to_month.slice(0, 10) >= month)
  );
}

/** Not ended yet: studying now or starting in a later month. Mirrors is_ongoing(enrolment). */
export function isOngoingEnrolment(e: EnrolmentLike, month = thisMonthISO()) {
  return e.status === "active" && (!e.to_month || e.to_month.slice(0, 10) >= month);
}
