import { cache } from "react";
import { createClient } from "./server";

export type AppUser = {
  id: string;
  full_name: string;
  role: string;
  is_owner: boolean;
} | null;

export type Viewer = {
  user: { id: string; email: string | null } | null;
  me: AppUser;
};

/**
 * Resolves who's signed in and their own `app_user` row, once per request.
 *
 * Before this, the portal layout called `supabase.auth.getUser()` and queried the caller's
 * own `app_user` row, and then almost every page under it did the exact same two Supabase
 * round trips again on top — 4+ sequential network calls to Supabase for something that's
 * the same answer every time within one request. `cache()` is React's per-request
 * memoization: the first call here pays for the two round trips, and every later call in
 * the same request (layout, then the page, then anything else) gets the same resolved
 * value back immediately, with no extra request. It resets between requests, so it never
 * leaks one visitor's identity into another's.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, me: null };

  const { data: me } = await supabase
    .from("app_user")
    .select("id, full_name, role, is_owner")
    .eq("auth_id", user.id)
    .maybeSingle();

  return { user: { id: user.id, email: user.email ?? null }, me: (me as AppUser) ?? null };
});
