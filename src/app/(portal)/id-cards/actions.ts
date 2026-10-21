"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type State = { ok?: boolean; error?: string } | null;
const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const tidy = (m: string) => m.charAt(0).toUpperCase() + m.slice(1).replace(/\.$/, "") + ".";

function refresh(studentId: string) {
  revalidatePath("/id-cards");
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/students/${studentId}/id-card`);
}

/** Create a student's ID card, or reissue it (a reason is needed when one exists). */
export async function issueIdCard(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isId(studentId)) return { error: "Missing student." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_issue_id_card", { p_student_id: studentId, p_reason: reason || null });
  if (error) return { error: tidy(error.message) };
  refresh(studentId);
  return { ok: true };
}

/** Counted each time the card is printed (or saved as PDF). */
export async function recordIdCardPrint(cardId: string): Promise<void> {
  if (!isId(cardId)) return;
  const supabase = await createClient();
  await supabase.rpc("fn_record_id_card_print", { p_card_id: cardId });
}
