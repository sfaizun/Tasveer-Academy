import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "./server";

/** An access role (Academy > Access) held by a login. */
export type RoleDef = {
  id: string;
  name: string;
  pages: string[] | null;
  is_super: boolean;
  read_only: boolean;
  sort_order: number;
};

/** One way of using the portal, picked from the "Viewing as" menu: the login's own portal
 * (teacher, student, guardian, canteen manager) or one of its access roles. */
export type PortalView = {
  key: string;
  label: string;
  kind: "own" | "role";
  role: RoleDef | null;
};

export type AppUser = {
  id: string;
  full_name: string;
  role: string;
  is_owner: boolean;
  /** Every access role this login holds. */
  roles: RoleDef[];
  /** The views it can switch between, in menu order. */
  views: PortalView[];
  /** The view in use now (null: an admin login with no access role yet). */
  view: PortalView | null;
} | null;

export type Viewer = {
  user: { id: string; email: string | null } | null;
  me: AppUser;
};

/** Cookie that remembers the chosen view between visits. */
export const VIEW_COOKIE = "ta-view";

const OWN_LABEL: Record<string, string> = {
  teacher: "Teacher",
  student: "Student",
  guardian: "Guardian",
  canteen_manager: "Canteen manager",
};

const byRank = (a: RoleDef, b: RoleDef) =>
  Number(b.is_super) - Number(a.is_super) || Number(a.read_only) - Number(b.read_only) || a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/** The views a login can use: its own portal first (if it has one), then each access role.
 * The owner always has Super Admin. */
export function viewsFor(role: string, isOwner: boolean, roles: RoleDef[]): PortalView[] {
  const views: PortalView[] = [];
  if (OWN_LABEL[role]) views.push({ key: "own", label: OWN_LABEL[role], kind: "own", role: null });
  const sorted = [...roles].sort(byRank);
  if (isOwner && !sorted.some((r) => r.is_super && !r.read_only)) {
    sorted.unshift({ id: "owner", name: "Super Admin", pages: null, is_super: true, read_only: false, sort_order: -1 });
  }
  for (const r of sorted) views.push({ key: r.id, label: r.name, kind: "role", role: r });
  return views;
}

type Raw = { id: string; full_name: string; role: string; is_owner: boolean; app_user_role: { admin_role: RoleDef | null }[] | null };

/** Reads the signed-in login with its access roles. Not cached: also used by the /view route. */
export async function loadMe(supabase: Awaited<ReturnType<typeof createClient>>, authId: string) {
  const { data } = await supabase
    .from("app_user")
    .select("id, full_name, role, is_owner, app_user_role(admin_role(id, name, pages, is_super, read_only, sort_order))")
    .eq("auth_id", authId)
    .maybeSingle();
  const raw = data as Raw | null;
  if (!raw) return null;
  const roles = (raw.app_user_role ?? []).map((x) => x.admin_role).filter((r): r is RoleDef => !!r);
  return { id: raw.id, full_name: raw.full_name, role: raw.role, is_owner: raw.is_owner, roles, views: viewsFor(raw.role, raw.is_owner, roles) };
}

/**
 * Resolves who's signed in, their own `app_user` row and the view they're using, once per
 * request. `cache()` is React's per-request memoization: the layout and the page share one
 * lookup, and it resets between requests, so it never leaks one visitor's identity into another's.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, me: null };

  const me = await loadMe(supabase, user.id);
  if (!me) return { user: { id: user.id, email: user.email ?? null }, me: null };

  const wanted = (await cookies()).get(VIEW_COOKIE)?.value;
  const view = me.views.find((v) => v.key === wanted) ?? me.views[0] ?? null;
  return { user: { id: user.id, email: user.email ?? null }, me: { ...me, view } };
});
