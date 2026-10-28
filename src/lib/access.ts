/** Admin access: the portal pages an admin login can open, set per role on Academy > Access.
 * Kept in step with the database (`_access_pages()`, `has_access()`, `can_see_fees()`), which
 * enforces the same rules on the data itself. */

export type PageKey =
  | "dashboard" | "roster" | "attendance" | "holidays" | "test_marks" | "report_cards" | "course_materials" | "past_papers" | "homework" | "announcements" | "appointments" | "reports"
  | "applications" | "students" | "id_cards" | "mock_exams"
  | "billing" | "invoices" | "fee_collection"
  | "expenses" | "income" | "cash_balance"
  | "catalogue" | "accounts" | "settings" | "audit_log" | "access"
  | "canteen"
  | "my_profile";

export type PageDef = { key: PageKey; label: string; href: string; group: string };

/** Every admin page, in sidebar order. "access" is Super Admin only and can't be ticked. */
export const PAGES: PageDef[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", group: "Overview" },
  { key: "roster", label: "Class Schedule", href: "/roster", group: "Overview" },
  { key: "attendance", label: "Attendance", href: "/attendance", group: "Overview" },
  { key: "holidays", label: "Holidays", href: "/holidays", group: "Overview" },
  { key: "test_marks", label: "Test marks", href: "/test-marks", group: "Overview" },
  { key: "report_cards", label: "Report cards", href: "/report-cards", group: "Overview" },
  { key: "course_materials", label: "Course materials", href: "/course-materials", group: "Overview" },
  { key: "past_papers", label: "Past papers", href: "/past-papers", group: "Overview" },
  { key: "homework", label: "Homework", href: "/homework", group: "Overview" },
  { key: "announcements", label: "Announcements", href: "/announcements", group: "Overview" },
  { key: "appointments", label: "Appointments", href: "/appointments", group: "Overview" },
  { key: "reports", label: "Reports", href: "/reports", group: "Overview" },
  { key: "applications", label: "Applications", href: "/applications", group: "Admissions" },
  { key: "students", label: "Students", href: "/students", group: "Admissions" },
  { key: "id_cards", label: "Student ID cards", href: "/id-cards", group: "Admissions" },
  { key: "mock_exams", label: "Mock exams", href: "/mock-exams", group: "Admissions" },
  { key: "billing", label: "Billing run", href: "/billing", group: "Billing" },
  { key: "invoices", label: "Invoices", href: "/invoices", group: "Billing" },
  { key: "fee_collection", label: "Monthly Fees Collection", href: "/fee-collection", group: "Billing" },
  { key: "expenses", label: "Expenses", href: "/expenses", group: "Office Accounts" },
  { key: "income", label: "Income", href: "/income", group: "Office Accounts" },
  { key: "cash_balance", label: "Cash balance", href: "/cash-balance", group: "Office Accounts" },
  { key: "catalogue", label: "Subjects & teachers", href: "/catalogue", group: "Academy" },
  { key: "accounts", label: "Accounts", href: "/accounts", group: "Academy" },
  { key: "settings", label: "Fees & settings", href: "/settings", group: "Academy" },
  { key: "audit_log", label: "Audit log", href: "/audit-log", group: "Academy" },
  { key: "access", label: "Access", href: "/access", group: "Academy" },
  { key: "canteen", label: "Canteen", href: "/canteen", group: "Canteen" },
];

/** Pages that can be ticked for a role (everything except Access itself). */
export const ASSIGNABLE_PAGES = PAGES.filter((p) => p.key !== "access");

/** Pages that show fees and payments. Having any of them lets the admin see money on a student's page. */
export const FEE_PAGES: PageKey[] = ["billing", "invoices", "reports", "dashboard"];

export type AdminAccess = { full: boolean; pages: Set<PageKey>; readOnly: boolean };

type ViewLike = { key: string; kind: "own" | "role"; role: { pages: string[] | null; is_super: boolean; read_only: boolean } | null } | null;
type Me = { role: string; is_owner: boolean; view: ViewLike; views?: { key: string }[] } | null;

/** Logins that can carry access roles on top of their own portal. */
export const STAFF_ROLES = ["admin", "teacher", "canteen_manager"];

/** Each login's own portal: the pages of its "own" view. */
export const BASE_PAGES: Record<string, PageKey[]> = {
  teacher: ["dashboard", "roster", "attendance", "test_marks", "report_cards", "course_materials", "past_papers", "homework", "announcements", "appointments", "mock_exams", "reports", "fee_collection"],
  // Students and guardians read announcements on their dashboard and can open one to print it.
  student: ["dashboard", "my_profile", "roster", "test_marks", "report_cards", "course_materials", "past_papers", "homework", "reports", "announcements", "appointments"],
  guardian: ["dashboard", "roster", "test_marks", "report_cards", "course_materials", "homework", "reports", "announcements"],
  canteen_manager: ["canteen"],
  admin: [],
};

const NONE: AdminAccess = { full: false, pages: new Set(), readOnly: false };

/** The admin pages of one view (Academy > Access). Super Admin gets every page; a login's own
 * portal view has none. */
export function accessOfView(v: ViewLike, role?: string): AdminAccess {
  if (!v || v.kind !== "role" || !v.role || (role && !STAFF_ROLES.includes(role))) return NONE;
  if (v.role.is_super) return { full: true, pages: new Set(PAGES.map((p) => p.key)), readOnly: v.role.read_only };
  return { full: false, pages: new Set((v.role.pages ?? []) as PageKey[]), readOnly: v.role.read_only };
}

/** The admin pages of the view in use now. */
export const accessOf = (me: Me): AdminAccess => (me ? accessOfView(me.view, me.role) : NONE);

export const canOpen = (a: AdminAccess, key: PageKey) => a.full || a.pages.has(key);
export const canSeeFees = (a: AdminAccess) => a.full || FEE_PAGES.some((k) => a.pages.has(k));

/** True when the view in use works on the page with admin rights. */
export const actsAsAdmin = (me: Me, key: PageKey) => canOpen(accessOf(me), key);

/** True when the view in use is view only: pages open, but nothing can be changed. */
export const viewReadOnly = (me: Me) => accessOf(me).readOnly;

/** True when the view in use is the login's own portal and the page is part of it. */
export const inOwnPortal = (me: Me, key: PageKey) =>
  !!me && me.view?.kind === "own" && (BASE_PAGES[me.role] ?? []).includes(key);

/** True when the view lets the login open the page. */
export function viewAllows(me: NonNullable<Me>, v: ViewLike, key: PageKey) {
  if (!v) return false;
  if (v.kind === "own") return (BASE_PAGES[me.role] ?? []).includes(key);
  return canOpen(accessOfView(v, me.role), key);
}

/** Where a view lands: the canteen manager's canteen, a portal's dashboard, or for an access
 * role its Dashboard when allowed, otherwise the first page it can open. */
export function homeFor(a: AdminAccess, me?: Me): string {
  if (me?.view?.kind === "own") return me.role === "canteen_manager" ? "/canteen" : "/dashboard";
  if (canOpen(a, "dashboard")) return "/dashboard";
  return PAGES.find((p) => canOpen(a, p.key))?.href ?? "/account";
}

/** The page key for a path, for the pages listed in PAGES. */
export function pageKeyForPath(path: string): PageKey | null {
  const hit = PAGES.filter((p) => path === p.href || path.startsWith(p.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.key ?? null;
}
