import { cleanPhone } from "@/lib/phone";

/** Finding students (and other open applications) that look like the same person as an
 * application, so admin is warned before approving a duplicate. Used by the Applications
 * page for the warning and by the approve action as a server-side check. */

export type DupCandidate = {
  kind: "student" | "application";
  id: string;
  ref: string | null; // reg no. or application ref no.
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  application_id?: string | null; // for a student: the application it was created from
};

export type DupMatch = DupCandidate & { reasons: string[] };

// Honorifics and short prefixes that are often written one way on one form and another way on the next.
const IGNORE = new Set(["md", "mohd", "mst", "most", "mrs", "mr", "ms", "miss", "sk", "sheikh"]);

/** Name as a sorted set of words: case, dots, extra spaces, prefixes like "Md." and word order are ignored. */
export function nameKey(name: string | null | undefined): string {
  const words = String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !IGNORE.has(w));
  return [...new Set(words)].sort().join(" ");
}

const emailKey = (e: string | null | undefined) => String(e ?? "").trim().toLowerCase() || null;

export function findDuplicates(
  app: { id: string; payload: any },
  candidates: DupCandidate[],
): DupMatch[] {
  const s = app.payload?.student ?? {};
  const nk = nameKey(s.full_name);
  const ph = cleanPhone(s.phone);
  const em = emailKey(s.email);
  const out: DupMatch[] = [];
  for (const c of candidates) {
    if (c.kind === "application" && c.id === app.id) continue;
    if (c.kind === "student" && c.application_id === app.id) continue;
    const reasons: string[] = [];
    if (nk && nameKey(c.full_name) === nk) reasons.push("same name");
    if (ph && cleanPhone(c.phone) === ph) reasons.push("same phone");
    if (em && emailKey(c.email) === em) reasons.push("same email");
    if (reasons.length) out.push({ ...c, reasons });
  }
  // Students first, then the strongest matches.
  return out.sort((a, b) => (a.kind === b.kind ? b.reasons.length - a.reasons.length : a.kind === "student" ? -1 : 1));
}

export const OPEN_APPLICATION = ["submitted", "under_review", "changes_requested"];

/** All students plus open applications, as one list to match against. */
export function toCandidates(
  students: { id: string; reg_no: string | null; full_name: string | null; phone: string | null; email: string | null; status: string | null; application_id: string | null }[],
  applications: { id: string; ref_no: string; status: string; payload: any }[],
): DupCandidate[] {
  return [
    ...students.map((st) => ({ kind: "student" as const, id: st.id, ref: st.reg_no, full_name: st.full_name, phone: st.phone, email: st.email, status: st.status, application_id: st.application_id })),
    ...applications
      .filter((a) => OPEN_APPLICATION.includes(a.status))
      .map((a) => ({ kind: "application" as const, id: a.id, ref: a.ref_no, full_name: a.payload?.student?.full_name ?? null, phone: a.payload?.student?.phone ?? null, email: a.payload?.student?.email ?? null, status: a.status })),
  ];
}

export function describeMatches(m: DupMatch[]): string {
  return m
    .map((x) => `${x.kind === "student" ? "student" : "application"} ${x.ref ?? ""} ${x.full_name ?? ""} (${x.reasons.join(", ")})`.replace(/\s+/g, " ").trim())
    .join("; ");
}
