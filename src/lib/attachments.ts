/** Shared rules for files uploaded straight from the browser to a private storage bucket. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx";
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Checks a chosen file. Returns its extension and content type, or an error message. */
export function checkAttachment(file: File): { ext: string; type: string } | { error: string } {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!MIME_BY_EXT[ext]) return { error: "Use a photo (JPG, PNG, HEIC), PDF, Word or Excel file." };
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: "The file is larger than 10 MB. Please use a smaller one." };
  return { ext, type: file.type || MIME_BY_EXT[ext] };
}
