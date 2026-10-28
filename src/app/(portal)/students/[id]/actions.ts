"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkPhone } from "@/lib/phone";

type State = { error?: string; ok?: boolean; message?: string } | null;

/** A JSON list of billing months from a form ("YYYY-MM-01" each). null when the field is absent. */
function readMonths(formData: FormData, field: string): string[] | null | { error: string } {
  const raw = formData.get(field);
  if (raw === null) return null;
  try {
    const v = JSON.parse(String(raw));
    if (!Array.isArray(v) || !v.every((m) => typeof m === "string" && /^\d{4}-\d{2}-01$/.test(m))) throw new Error();
    return [...new Set(v as string[])].sort();
  } catch {
    return { error: "Could not read the months. Please try again." };
  }
}
const fmtTk = (n: number) => "৳" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export async function recordPayment(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "cash");
  const received_on = String(formData.get("received_on") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const amount = Number(amountRaw);
  if (!studentId) return { error: "Missing student." };
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) return { error: "Enter a valid amount." };

  const lineIds = formData.getAll("line_ids").map(String).filter(Boolean);

  const supabase = await createClient();
  // The ticked items are paid in the order shown, each up to what is left on it. Anything over
  // goes to the oldest open invoice, then stays as advance credit.
  const { error } = await supabase.rpc("fn_record_payment_items", {
    p_student_id: studentId,
    p_amount: amount,
    p_method: method,
    p_received_on: received_on || null,
    p_note: note || null,
    p_line_ids: lineIds,
  });

  if (error) return { error: "Could not record the payment: " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { ok: true };
}

/** Partly paid invoice: put the money already paid on it against the ticked items, top first. */
export async function setPaidItems(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const lineIds = formData.getAll("line_ids").map(String).filter(Boolean);
  if (!invoiceId) return { error: "Missing invoice." };
  if (lineIds.length === 0) return { error: "Tick the items that have been paid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_paid_items", { p_invoice_id: invoiceId, p_line_ids: lineIds });
  if (error) return { error: "Could not save: " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/reports");
  return { ok: true };
}

export async function editInvoice(
  _prev: (State & { message?: string }) | null,
  formData: FormData
): Promise<(State & { message?: string }) | null> {
  const studentId = String(formData.get("student_id") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!invoiceId) return { error: "Missing invoice." };
  if (!reason) return { error: "Add a reason for this change." };

  let lines: unknown;
  let add: unknown;
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
    add = JSON.parse(String(formData.get("add") ?? "[]"));
  } catch {
    return { error: "Could not read the changes. Please try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_edit_invoice", {
    p_invoice_id: invoiceId,
    p_lines: lines,
    p_add: add,
    p_reason: reason,
  });
  if (error) return { error: "Could not save: " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/billing");
  const r = (data ?? {}) as { changes?: number; moved?: number; credit?: number };
  if (!r.changes) return { ok: true, message: "Nothing changed." };
  const fmt = (n: number) => "৳" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  let message = "Invoice updated.";
  if (r.moved && r.moved > 0) {
    message += r.credit && r.credit > 0
      ? ` ${fmt(r.moved)} already paid is now more than this invoice; ${fmt(r.credit)} is kept as advance credit.`
      : ` ${fmt(r.moved)} already paid moved to the next open invoice.`;
  }
  return { ok: true, message };
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

const STUDENT_GENDERS = ["male", "female", "other", "undisclosed"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Edits the student's own profile fields — everything on the "Student" info panel except
// reg_no (permanent, never editable here) and status (its own "Change status" control).
export async function updateStudentDetails(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const previous_reg_no = String(formData.get("previous_reg_no") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const nationality = String(formData.get("nationality") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const school_name = String(formData.get("school_name") ?? "").trim();
  const admitted_on = String(formData.get("admitted_on") ?? "").trim();
  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim();

  if (!studentId) return { error: "Missing student." };
  if (!full_name) return { error: "Name is required." };
  if (!(STUDENT_GENDERS as readonly string[]).includes(genderRaw)) {
    return { error: "Gender is required." };
  }
  const phoneCheck = checkPhone(phone, true);
  if ("error" in phoneCheck) return { error: phoneCheck.error };
  if (!email) return { error: "Email is required. It is used for the student's portal login." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  // Everything printed on the student ID card is required.
  if (!school_name) return { error: "School is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(admitted_on)) return { error: "Admitted on is required." };
  if (!address) return { error: "Address is required." };
  if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) return { error: "Enter a valid date of birth." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("student")
    .update({
      full_name,
      previous_reg_no: previous_reg_no || null,
      gender: genderRaw || null,
      nationality: nationality || null,
      phone: phoneCheck.value,
      email: email || null,
      address: address || null,
      school_name: school_name || null,
      admitted_on: admitted_on || null,
      date_of_birth: date_of_birth || null,
    })
    .eq("id", studentId);

  if (error) return { error: "Could not save the student's details — " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { ok: true };
}

const GUARDIAN_RELATIONS = ["father", "mother", "guardian", "other"] as const;

// Adds a new guardian for this student. The schema allows more than one guardian per
// student (used for e.g. separated parents both needing contact/notification access),
// though most students currently have exactly one.
export async function addGuardian(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const relationRaw = String(formData.get("relation") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const is_primary = formData.get("is_primary") === "on";

  if (!studentId) return { error: "Missing student." };
  if (!full_name) return { error: "Name is required." };
  if (!(GUARDIAN_RELATIONS as readonly string[]).includes(relationRaw)) {
    return { error: "Choose the relation to the student." };
  }
  const phoneCheck = checkPhone(phone, true);
  if ("error" in phoneCheck) return { error: phoneCheck.error };
  if (email && !EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();

  // Only one guardian can be "primary" at a time — clear it on the others first.
  if (is_primary) {
    const { error: unsetError } = await supabase
      .from("guardian")
      .update({ is_primary: false })
      .eq("student_id", studentId);
    if (unsetError) return { error: "Could not add the guardian — " + unsetError.message };
  }

  const { error } = await supabase.from("guardian").insert({
    student_id: studentId,
    full_name,
    relation: relationRaw || null,
    phone: phoneCheck.value,
    email: email || null,
    address: address || null,
    is_primary,
  });

  if (error) return { error: "Could not add the guardian — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function updateGuardian(_prev: State, formData: FormData): Promise<State> {
  const guardianId = String(formData.get("guardian_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const relationRaw = String(formData.get("relation") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const is_primary = formData.get("is_primary") === "on";

  if (!guardianId) return { error: "Missing guardian." };
  if (!studentId) return { error: "Missing student." };
  if (!full_name) return { error: "Name is required." };
  if (!(GUARDIAN_RELATIONS as readonly string[]).includes(relationRaw)) {
    return { error: "Choose the relation to the student." };
  }
  const phoneCheck = checkPhone(phone, true);
  if ("error" in phoneCheck) return { error: phoneCheck.error };
  if (email && !EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();

  if (is_primary) {
    const { error: unsetError } = await supabase
      .from("guardian")
      .update({ is_primary: false })
      .eq("student_id", studentId)
      .neq("id", guardianId);
    if (unsetError) return { error: "Could not save the guardian — " + unsetError.message };
  }

  const { error } = await supabase
    .from("guardian")
    .update({
      full_name,
      relation: relationRaw || null,
      phone: phoneCheck.value,
      email: email || null,
      address: address || null,
      is_primary,
    })
    .eq("id", guardianId);

  if (error) return { error: "Could not save the guardian — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

// Safe to delete directly — the only table referencing guardian.id
// (notification_preference.guardian_id) cascades on delete.
export async function removeGuardian(_prev: State, formData: FormData): Promise<State> {
  const guardianId = String(formData.get("guardian_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");

  if (!guardianId) return { error: "Missing guardian." };

  const supabase = await createClient();
  const { error } = await supabase.from("guardian").delete().eq("id", guardianId);

  if (error) return { error: "Could not remove the guardian — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function addEnrolment(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const subjectId = String(formData.get("subject_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  const fromMonth = String(formData.get("from_month") ?? "").trim();
  const batch = String(formData.get("batch") ?? "").trim() || "1";
  // Months the admin ticked when the start month already has invoices. Absent means the
  // start is this month with no invoice yet, so nothing earlier needs a decision.
  const billMonths = readMonths(formData, "bill_months");
  if (billMonths && "error" in billMonths) return billMonths;

  if (!studentId) return { error: "Missing student." };
  if (!subjectId) return { error: "Choose a subject." };
  if (!teacherId) return { error: "Choose a teacher." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_add_enrolment", {
    p_student_id: studentId,
    p_subject_id: subjectId,
    p_teacher_id: teacherId,
    p_from_month: fromMonth ? `${fromMonth}-01` : null,
    p_batch: batch,
    ...(billMonths ? { p_bill_months: billMonths } : {}),
  });

  if (error) return { error: "Could not add the subject — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

// Moves a subject enrolment to a different teacher and/or batch — the "edit" on a
// subject that's already been added, without needing to remove and re-add it (removal
// is blocked once the subject has appeared on an invoice; this isn't).
export async function setEnrolmentClassGroup(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  const batch = String(formData.get("batch") ?? "").trim() || "1";

  if (!enrolmentId) return { error: "Missing subject." };
  if (!teacherId) return { error: "Choose a teacher." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_enrolment_class_group", {
    p_enrolment_id: enrolmentId,
    p_teacher_id: teacherId,
    p_batch: batch,
  });

  if (error) return { error: "Could not change the class — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

// Sets (or clears, when both value fields are left blank) a recurring discount on one
// subject enrolment — a percentage or a fixed monthly amount, never both at once.
export async function setEnrolmentDiscount(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const kind = String(formData.get("discount_kind") ?? "");
  const valueRaw = String(formData.get("discount_value") ?? "").trim();
  const reason = String(formData.get("discount_reason") ?? "").trim();

  if (!enrolmentId) return { error: "Missing subject." };

  let discount_pct: number | null = null;
  let discount_amt: number | null = null;

  if (valueRaw) {
    const value = Number(valueRaw);
    if (Number.isNaN(value) || value <= 0) return { error: "Enter a valid discount value." };
    if (kind === "pct") discount_pct = value;
    else discount_amt = value;
    if (!reason) return { error: "Add a short reason for the discount." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_enrolment_discount", {
    p_enrolment_id: enrolmentId,
    p_discount_pct: discount_pct,
    p_discount_amt: discount_amt,
    p_reason: reason || null,
  });

  if (error) return { error: "Could not save the discount — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

// Sets (or clears) a one-time discount against the student's admission fee.
export async function applyAdmissionDiscount(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!studentId) return { error: "Missing student." };

  let amount: number | null = null;
  if (amountRaw) {
    amount = Number(amountRaw);
    if (Number.isNaN(amount) || amount <= 0) return { error: "Enter a valid discount amount." };
    if (!reason) return { error: "Add a short reason for the discount." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_apply_admission_discount", {
    p_student_id: studentId,
    p_amount: amount,
    p_reason: reason || null,
  });

  if (error) return { error: "Could not save the discount — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

// Moves a subject's own start month, blocked once this subject has already been billed
// for a month before the requested one — the database function raises a specific error
// naming the earliest month that's already gone out, since letting the record disagree
// with an invoice already sent would just create confusion later.
export async function setEnrolmentStart(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const fromMonth = String(formData.get("from_month") ?? "").trim();

  const billMonths = readMonths(formData, "bill_months");
  if (billMonths && "error" in billMonths) return billMonths;

  if (!enrolmentId) return { error: "Missing subject." };
  if (!fromMonth) return { error: "Choose a start month." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_set_enrolment_start", {
    p_enrolment_id: enrolmentId,
    p_from_month: `${fromMonth}-01`,
    p_bill_months: billMonths ?? null,
  });

  if (error) return { error: "Could not update the start month — " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  const billed = Number((data as { billed?: number } | null)?.billed ?? 0);
  return { ok: true, message: billed ? `Saved. Added to ${billed} ${billed === 1 ? "invoice" : "invoices"}.` : "Saved." };
}

// Adds a subject to, or takes it off, chosen months' invoices.
export async function setEnrolmentMonths(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const add = readMonths(formData, "add");
  const remove = readMonths(formData, "remove");
  if (add && "error" in add) return add;
  if (remove && "error" in remove) return remove;

  if (!enrolmentId) return { error: "Missing subject." };
  if (!add?.length && !remove?.length) return { error: "Tick or untick a month first." };
  if (remove?.length && !reason) return { error: "Add a reason for taking the subject off an invoice." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_bill_enrolment_months", {
    p_enrolment_id: enrolmentId,
    p_add: add ?? [],
    p_remove: remove ?? [],
    p_reason: reason || null,
  });
  if (error) return { error: "Could not update the invoices: " + error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/billing");
  const r = (data ?? {}) as { added?: number; created?: number; removed?: number; moved?: number; credit?: number };
  const parts: string[] = [];
  const addedN = (r.added ?? 0) + (r.created ?? 0);
  if (addedN) parts.push(`Added to ${addedN} ${addedN === 1 ? "invoice" : "invoices"}${r.created ? ` (${r.created} new)` : ""}.`);
  if (r.removed) parts.push(`Taken off ${r.removed} ${r.removed === 1 ? "invoice" : "invoices"}.`);
  if (r.moved && Number(r.moved) > 0) {
    parts.push(Number(r.credit) > 0
      ? `${fmtTk(Number(r.moved))} already paid was freed; ${fmtTk(Number(r.credit))} is kept as advance credit.`
      : `${fmtTk(Number(r.moved))} already paid moved to the next open invoice.`);
  }
  return { ok: true, message: parts.join(" ") || "Saved." };
}

export async function setEnrolmentEnd(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const enrolmentId = String(formData.get("enrolment_id") ?? "");
  const toMonth = String(formData.get("to_month") ?? "").trim();

  if (!enrolmentId) return { error: "Missing subject." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_set_enrolment_end", {
    p_enrolment_id: enrolmentId,
    p_to_month: toMonth ? `${toMonth}-01` : null,
  });

  if (error) return { error: "Could not update the end month — " + error.message };

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function removeEnrolment(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const enrolmentId = String(formData.get("enrolment_id") ?? "");

  if (!enrolmentId) return { error: "Missing subject." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_remove_enrolment", { p_enrolment_id: enrolmentId });

  if (error) return { error: "Could not remove the subject — " + error.message };

  revalidatePath(`/students/${studentId}`);
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

/** Office: promote a student to the next class or level from a chosen month. */
export async function promoteStudent(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const target = String(formData.get("target") ?? "");
  const month = String(formData.get("effective_month") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!studentId) return { error: "Missing student." };
  if (!target) return { error: "Choose the new class or level." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose the month the new class starts." };
  // "junior:<class id>" for a junior class, otherwise the programme code.
  const [programme, classId] = target.startsWith("junior:") ? ["junior", target.slice(7)] : [target, null];
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_promote_student", {
    p_student_id: studentId, p_to_programme: programme, p_to_class_level_id: classId,
    p_effective_month: `${month}-01`, p_note: note || null,
  });
  if (error) return { error: error.message.charAt(0).toUpperCase() + error.message.slice(1) };
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/id-cards");
  return { ok: true };
}

export async function undoPromotion(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const id = String(formData.get("promotion_id") ?? "");
  if (!id) return { error: "Missing promotion." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_undo_promotion", { p_promotion_id: id });
  if (error) return { error: error.message.charAt(0).toUpperCase() + error.message.slice(1) };
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/id-cards");
  return { ok: true };
}

/** Office: give back money received on an invoice, for the ticked items (admission fee or a
 * subject). The refunded fee is cancelled on the invoice, and the amount comes off the teacher's
 * collection or office income in the month of the refund. */
export async function recordRefund(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const method = String(formData.get("method") ?? "cash");
  const refundedOn = String(formData.get("refunded_on") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const lineIds = formData.getAll("line_ids").map(String).filter(Boolean);
  if (!invoiceId) return { error: "Missing invoice." };
  if (lineIds.length === 0) return { error: "Tick the items to refund." };
  if (!reason) return { error: "Enter the reason for the refund." };
  const items: { line_id: string; amount: number }[] = [];
  for (const id of lineIds) {
    const amount = Number(String(formData.get(`amount_${id}`) ?? "").trim());
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount above zero for each ticked item." };
    items.push({ line_id: id, amount: Math.round(amount * 100) / 100 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_record_refund", {
    p_invoice_id: invoiceId,
    p_items: items,
    p_method: method,
    p_refunded_on: refundedOn || null,
    p_reason: reason,
  });
  if (error) return { error: "Could not record the refund: " + error.message };
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/fee-collection");
  return { ok: true, message: `Refund of ${fmtTk(items.reduce((n, i) => n + i.amount, 0))} recorded.` };
}

/** Owner: cancel a refund recorded by mistake. The record stays, marked cancelled. */
export async function voidRefund(_prev: State, formData: FormData): Promise<State> {
  const studentId = String(formData.get("student_id") ?? "");
  const refundId = String(formData.get("refund_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!refundId) return { error: "Missing refund." };
  if (!reason) return { error: "A reason is required to cancel a refund." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_void_refund", { p_refund_id: refundId, p_reason: reason });
  if (error) return { error: "Could not cancel the refund: " + error.message };
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/fee-collection");
  return { ok: true, message: "Refund cancelled." };
}
