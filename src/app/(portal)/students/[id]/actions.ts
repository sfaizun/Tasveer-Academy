"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type State = { error?: string; ok?: boolean } | null;

export async function recordPayment(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "cash");
  const received_on = String(formData.get("received_on") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const amount = Number(amountRaw);
  if (!studentId) return { error: "Missing student." };
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) return { error: "Enter a valid amount." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_record_payment", {
    p_student_id: studentId,
    p_amount: amount,
    p_method: method,
    p_received_on: received_on || null,
    p_note: note || null,
  });

  if (error) return { error: "Could not record the payment — " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { ok: true };
}

export async function editPayment(_prev: State, formData: FormData): Promise<State> {
  const paymentId = String(formData.get("payment_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "cash");
  const received_on = String(formData.get("received_on") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  const amount = Number(amountRaw);
  if (!paymentId) return { error: "Missing payment." };
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) return { error: "Enter a valid amount." };
  if (!reason) return { error: "A reason is required to correct a payment." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_edit_payment", {
    p_payment_id: paymentId,
    p_amount: amount,
    p_method: method,
    p_received_on: received_on || null,
    p_note: note || null,
    p_reason: reason,
  });

  if (error) return { error: "Could not correct the payment — " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { ok: true };
}

export async function voidPayment(_prev: State, formData: FormData): Promise<State> {
  const paymentId = String(formData.get("payment_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!paymentId) return { error: "Missing payment." };
  if (!reason) return { error: "A reason is required to void a payment." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_void_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
  });

  if (error) return { error: "Could not void the payment — " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { ok: true };
}
