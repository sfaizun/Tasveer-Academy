// Public Supabase project reference. The anon/publishable key is safe to ship client-side —
// access is enforced entirely by row level security, not by keeping this key secret.
// Values can be overridden by env vars (see .env.example) without a code change.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://veefdqanxypwauimbxho.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_YZcwp7UWJ23yPcDDjdJyCw_Dl49jiBL";
