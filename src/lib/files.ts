import { createClient } from "@/lib/supabase/client";

/** Course materials and homework: files uploaded from the browser straight to a private bucket. */
export const MAX_STUDY_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_STUDY_FILES = 10;
export const STUDY_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
};

export type UploadedFile = { path: string; name: string; type: string; size: number };

/** Checks the chosen files before uploading. Returns an error message, or null when they're fine. */
export function checkStudyFiles(files: File[]): string | null {
  if (files.length > MAX_STUDY_FILES) return `Attach up to ${MAX_STUDY_FILES} files at a time.`;
  for (const f of files) {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!MIME_BY_EXT[ext]) return `${f.name}: use a PDF, Word, PowerPoint or a photo (JPG, PNG, HEIC).`;
    if (f.size > MAX_STUDY_FILE_BYTES) return `${f.name} is larger than 20 MB. Please use a smaller file.`;
  }
  return null;
}

/** Uploads files to `bucket` under `folder/`. On any failure, removes what was uploaded and throws. */
export async function uploadStudyFiles(bucket: string, folder: string, files: File[]): Promise<UploadedFile[]> {
  const storage = createClient().storage.from(bucket);
  const done: UploadedFile[] = [];
  for (const f of files) {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const type = f.type || MIME_BY_EXT[ext] || "application/octet-stream";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await storage.upload(path, f, { contentType: type, upsert: false });
    if (error) {
      if (done.length) await storage.remove(done.map((d) => d.path));
      throw new Error(`Could not upload ${f.name}: ${error.message}`);
    }
    done.push({ path, name: f.name.slice(0, 200), type, size: f.size });
  }
  return done;
}

export function fileSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
