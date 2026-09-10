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
  const discount_invoice_id = String(formData.get("discount_invoice_id") ?? "").trim() || null;
  const discountRaw = String(formData.get("discount_amount") ?? "").trim();
  const discount_note = String(formData.get("discount_note") ?? "").trim();

  const amount = Number(amountRaw);
  if (!studentId) return { error: "Missing student." };
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) return { error: "Enter a valid amount." };

  const discount_amount = discountRaw ? Number(discountRaw) : null;
  if (discountRaw && (Number.isNaN(discount_amount) || (discount_amount as number) <= 0)) {
    return { error: "Enter a valid discount amount." };
  }
  if (discount_amount && !discount_invoice_id) return { error: "Choose which invoice the discount applies to." };
  if (discount_amount && !discount_note) return { error: "Add a short note for the discount." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_record_payment", {
    p_student_id: studentId,
    p_amount: amount,
    p_method: method,
    p_received_on: received_on || null,
    p_note: note || null,
    p_discount_invoice_id: discount_invoice_id,
    p_discount_amount: discount_amount,
    p_discount_note: discount_note || null,
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

const STUDENT_STATUSES = ["applicant", "active", "on_hold", "dropped", "alumni"] as const;

export async function setStudentStatus(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!studentId) return { error: "Missing student." };
  if (!(STUDENT_STATUSES as readonly string[]).includes(status)) return { error: "Choose a valid status." };

  const supabase = await createClient();
  const { error } = await supabase.from("student").update({ status }).eq("id", studentId);
  if (error) return { error: "Could not update the status — " + error.message };

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
