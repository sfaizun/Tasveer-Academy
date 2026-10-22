import type { SupabaseClient } from "@supabase/supabase-js";

/** Academy name, address and phone for the report card header (Fees & settings). */
export async function loadAcademy(supabase: SupabaseClient) {
  const { data } = await supabase.from("app_setting").select("key, value").in("key", ["academy_name", "academy_address", "academy_phone"]);
  const set = new Map(((data ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value ?? ""]));
  return {
    name: set.get("academy_name") || "Tasveer Academy",
    address: set.get("academy_address") || "105/A (2nd & 3rd Floor), Kakrail, Dhaka-1000, Bangladesh",
    phone: set.get("academy_phone") || "",
  };
}
