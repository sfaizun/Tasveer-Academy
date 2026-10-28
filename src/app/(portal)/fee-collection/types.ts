// Shared by the Monthly Fees Collection page (server) and its report (client).

/** One payment and one fee item it paid (fn_fee_collection). A payment that covers several
 * items is several rows that add up to the payment exactly. */
export type CollectionRow = {
  payment_id: string;
  receipt_no: string;
  received_on: string;
  received_at: string | null;
  method: string;
  payment_amount: number;
  payment_note: string | null;
  student_id: string;
  reg_no: string;
  student_name: string;
  class_label: string | null;
  section: string | null;
  invoice_id: string | null;
  invoice_no: string | null;
  billing_month: string | null;
  invoice_line_id: string | null;
  /** tuition | mock | admission | other | advance */
  category: string;
  item: string;
  teacher_id: string | null;
  teacher_name: string | null;
  amount: number;
};

export type VoidRow = {
  payment_id: string;
  receipt_no: string;
  received_on: string;
  voided_on: string | null;
  method: string;
  amount: number;
  void_reason: string | null;
  student_id: string;
  reg_no: string;
  student_name: string;
};

/** One refunded item (fn_fee_collection_refunds): money given back in the month, by its refund date. */
export type RefundCollectionRow = {
  refund_id: string;
  refund_no: string;
  refunded_on: string;
  method: string;
  refund_amount: number;
  reason: string;
  student_id: string;
  reg_no: string;
  student_name: string;
  class_label: string | null;
  section: string | null;
  invoice_id: string | null;
  invoice_no: string | null;
  billing_month: string | null;
  invoice_line_id: string;
  category: string;
  item: string;
  teacher_id: string | null;
  teacher_name: string | null;
  amount: number;
};

export const CATEGORY_LABEL: Record<string, string> = {
  tuition: "Tuition",
  mock: "Mock exam",
  admission: "Admission fee (office income)",
  other: "Other (office income)",
  advance: "Advance (not yet applied)",
};

export const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", card: "Card",
};
