/** Admin access: the portal pages an admin login can open, set per role on Academy > Access.
 * Kept in step with the database (`_access_pages()`, `has_access()`, `can_see_fees()`), which
 * enforces the same rules on the data itself. */

export type PageKey =
  | "dashboard" | "roster" | "test_marks" | "announcements" | "reports"
  | "applications" | "students" | "mock_exams"
  | "billing" | "invoices"
  | "expenses" | "income"
  | "catalogue" | "accounts" | "settings" | "audit_log" | "access"
  | "canteen";

export type PageDef = { key: PageKey; label: string; href: string; group: string };

/** Every admin page, in sidebar order. "access" is Super Admin only and can't be ticked. */
export const PAGES: PageDef[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", group: "Overview" },
  { key: "roster", label: "Class Schedule", href: "/roster", group: "Overview" },
  { key: "test_marks", label: "Test marks", href: "/test-marks", group: "Overview" },
  { key: "announcements", label: "Announcements", href: "/announcements", group: "Overview" },
  { key: "reports", label: "Reports", href: "/reports", group: "Overview" },
  { key: "applications", label: "Applications", href: "/applications", group: "Admissions" },
  { key: "students", label: "Students", href: "/students", group: "Admissions" },
  { key: "mock_exams", label: "Mock exams", href: "/mock-exams", group: "Admissions" },
  { key: "billing", label: "Billing run", href: "/billing", group: "Billing" },
  { key: "invoices", label: "Invoices", href: "/invoices", group: "Billing" },
  { key: "expenses", label: "Expenses", href: "/expenses", group: "Office Accounts" },
  { key: "income", label: "Income", href: "/income", group: "Office Accounts" },
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

export type AdminAccess = { full: boolean; pages: Set<PageKey> };

type Me = {
  role: string;
  is_owner: boolean;
  admin_role?: { name: string; pages: string[] | null; is_super: boolean } | null;
} | null;

/** What an admin login can open. Non-admins get no admin pages (their own pages are role based). */
export function accessOf(me: Me): AdminAccess {
  if (!me || me.role !== "admin") return { full: false, pages: new Set() };
  if (me.is_owner || me.admin_role?.is_super) return { full: true, pages: new Set(PAGES.map((p) => p.key)) };
  return { full: false, pages: new Set((me.admin_role?.pages ?? []) as PageKey[]) };
}

export const canOpen = (a: AdminAccess, key: PageKey) => a.full || a.pages.has(key);
export const canSeeFees = (a: AdminAccess) => a.full || FEE_PAGES.some((k) => a.pages.has(k));

/** Where an admin lands: Dashboard when allowed, otherwise the first page they can open. */
export function homeFor(a: AdminAccess): string {
  if (canOpen(a, "dashboard")) return "/dashboard";
  return PAGES.find((p) => canOpen(a, p.key))?.href ?? "/account";
}
