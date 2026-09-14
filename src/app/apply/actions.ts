"use server";
import { createClient } from "@/lib/supabase/server";

export type ApplicationPayload = {
  visit_date: string;
  previous_reg_no: string | null;
  programme_code: "junior" | "o_level" | "a_level";
  class_level_code: string | null;
  start_month: string;
  mock_only: boolean;
  student: {
    full_name: string;
    gender: string;
    nationality: string;
    phone: string;
    email: string;
    address: string;
    school_name: string;
  };
  guardian: {
    full_name: string;
    relation: string;
    father_name: string;
    mother_name: string;
    phone: string;
    email: string;
    address: string;
  };
  siblings: { full_name: string; class_name: string; school_name: string }[];
  subjects: {
    subject_id: string;
    subject_name: string;
    level: string | null;
    teacher_id: string;
    teacher_name: string;
    from_month: string;
    monthly_fee: number;
  }[];
  fee_summary: {
    admission_fee: number;
    monthly_total: number;
    first_month_estimate: number;
    mock_fee?: number;
    note: string;
  };
  declaration_accepted: boolean;
};

type Result = { ok: true; ref: string } | { ok: false; error: string };

export async function submitApplication(payload: ApplicationPayload): Promise<Result> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Malformed application." };
  }
  if (!payload.student?.full_name?.trim()) {
    return { ok: false, error: "Student name is required." };
  }
  if (!payload.student?.phone?.trim()) {
    return { ok: false, error: "Student WhatsApp/mobile number is required." };
  }
  if (!payload.guardian?.full_name?.trim()) {
    return { ok: false, error: "Guardian name is required." };
  }
  if (!payload.guardian?.phone?.trim()) {
    return { ok: false, error: "Guardian WhatsApp/mobile number is required." };
  }
  if (!["junior", "o_level", "a_level"].includes(payload.programme_code)) {
    return { ok: false, error: "Choose a programme." };
  }
  if (payload.programme_code === "junior" && !payload.class_level_code) {
    return { ok: false, error: "Choose a class level." };
  }
  if (payload.programme_code !== "junior" && payload.subjects.length === 0) {
    return { ok: false, error: "Add at least one subject." };
  }
  if (payload.programme_code !== "junior" && payload.subjects.length > 10) {
    return { ok: false, error: "A maximum of 10 subjects can be added." };
  }
  if (payload.programme_code !== "junior") {
    const subjectIds = payload.subjects.map((s) => s.subject_id);
    if (new Set(subjectIds).size !== subjectIds.length) {
      return { ok: false, error: "Each subject can only be selected once." };
    }
  }
  if (!payload.declaration_accepted) {
    return { ok: false, error: "Please accept the declaration to submit." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_submit_application", {
    p_payload: payload,
  });

  if (error) {
    return { ok: false, error: "Could not submit the application. Please try again in a moment." };
  }

  return { ok: true, ref: data as string };
}
