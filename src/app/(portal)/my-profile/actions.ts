"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkPhone } from "@/lib/phone";

type State = { ok?: boolean; error?: string } | null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDERS = ["male", "female", "other", "undisclosed"];
const RELATIONS = ["father", "mother", "guardian", "other"];
const tidy = (msg: string) => {
  const m = msg.trim().replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1) + ".";
};
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** A student saves their own details (not their Student ID or admission date). */
export async function updateMyProfile(_prev: State, f: FormData): Promise<State> {
  const full_name = s(f, "full_name");
  const gender = s(f, "gender");
  const dob = s(f, "date_of_birth");
  const email = s(f, "email");
  const school = s(f, "school_name");
  const address = s(f, "address");
  if (!full_name) return { error: "Enter your full name." };
  if (!GENDERS.includes(gender)) return { error: "Choose your gender." };
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: "Enter a valid date of birth." };
  const phone = checkPhone(s(f, "phone"), true);
  if ("error" in phone) return { error: phone.error };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!school) return { error: "Enter your school." };
  if (!address) return { error: "Enter your address." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_update_my_profile", {
    p_full_name: full_name, p_gender: gender, p_date_of_birth: dob || null, p_nationality: s(f, "nationality") || null,
    p_phone: phone.value, p_email: email, p_school_name: school, p_address: address,
  });
  if (error) return { error: tidy(error.message) };
  revalidatePath("/my-profile");
  return { ok: true };
}

/** A student saves one of their guardians' details. */
export async function updateMyGuardian(_prev: State, f: FormData): Promise<State> {
  const id = s(f, "id");
  const full_name = s(f, "full_name");
  const relation = s(f, "relation");
  const email = s(f, "email");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Missing guardian." };
  if (!full_name) return { error: "Enter the guardian's name." };
  if (!RELATIONS.includes(relation)) return { error: "Choose the relation." };
  const phone = checkPhone(s(f, "phone"), true);
  if ("error" in phone) return { error: phone.error };
  if (email && !EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_update_my_guardian", {
    p_id: id, p_full_name: full_name, p_relation: relation, p_phone: phone.value, p_email: email || null, p_address: s(f, "address") || null,
  });
  if (error) return { error: tidy(error.message) };
  revalidatePath("/my-profile");
  return { ok: true };
}
