/** Shared by the Past papers page (server) and its forms (client). Kept out of the "use client"
 * files: values exported from those are not usable on the server. */
export const SESSIONS: { value: string; label: string }[] = [
  { value: "jan", label: "January" },
  { value: "jun", label: "May/June" },
  { value: "nov", label: "October/November" },
];
export const sessionLabel = (s: string) => SESSIONS.find((x) => x.value === s)?.label ?? s;
export const KIND_LABEL: Record<string, string> = { qp: "Question paper", ms: "Mark scheme", er: "Examiner report" };
