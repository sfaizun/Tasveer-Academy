"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Req from "@/components/Req";
import { createClient } from "@/lib/supabase/client";
import { addIncome, updateIncome } from "./actions";

export type IncomeRow = {
  id: string;
  income_date: string;
  amount: number;
  details: string;
  attachment_name: string | null;
};

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx";
const OK_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf", "doc", "docx", "xls", "xlsx"];
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Add office income, or edit an entry when `income` is given. Admin only. */
export default function IncomeForm({
  today, income, onDone,
}: {
  today: string;
  income?: IncomeRow;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(income ? updateIncome : addIncome, null);
  const [uploading, startUpload] = useTransition();
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  // Edit mode: "Delete file" only marks the current file for deletion. It stays in place until a
  // new file is chosen and the income is saved; Cancel or Undo keeps it.
  const [fileRemoved, setFileRemoved] = useState(false);
  const [fileChosen, setFileChosen] = useState(false);
  const keepsOld = !!income?.attachment_name && !fileRemoved;
  const ref = useRef<HTMLFormElement>(null);
  const id = income?.id ?? "new";

  useEffect(() => {
    if (!state?.ok) return;
    if (income) onDone?.();
    else ref.current?.reset();
  }, [state, income, onDone]);

  /** Uploads the file from the browser first, then sends the form with the file's storage path. */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFileErr(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("attachment");
    fd.delete("attachment");
    const hasFile = file instanceof File && file.size > 0;
    if (!hasFile && !keepsOld) {
      setFileErr(fileRemoved ? "Choose the new file before saving. The old file stays until then." : "Attach the receipt or supporting file.");
      return;
    }
    startUpload(async () => {
      if (hasFile) {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (!OK_EXT.includes(ext)) { setFileErr("Use a photo (JPG, PNG, HEIC), PDF, Word or Excel file."); return; }
        if (file.size > MAX_BYTES) { setFileErr("The file is larger than 10 MB. Please use a smaller one."); return; }
        const type = file.type || MIME_BY_EXT[ext];
        const path = `office/${(fd.get("income_date") as string || today).slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
        setSendingFile(true);
        const { error } = await createClient().storage
          .from("income-attachments")
          .upload(path, file, { contentType: type, upsert: false });
        setSendingFile(false);
        if (error) { setFileErr("Could not upload the file: " + error.message); return; }
        fd.set("attachment_path", path);
        fd.set("attachment_name", file.name);
        fd.set("attachment_type", type);
        fd.set("attachment_size", String(file.size));
      }
      if (fileRemoved) fd.set("attachment_removed", "1");
      startUpload(() => action(fd));
    });
  }
  const busy = pending || uploading;

  return (
    <form ref={ref} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {income && <input type="hidden" name="id" value={income.id} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <div className="field">
          <label className="lbl" htmlFor={`in-d-${id}`}>Date<Req /></label>
          <input id={`in-d-${id}`} style={inputStyle} type="date" name="income_date" required defaultValue={income?.income_date ?? today} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`in-a-${id}`}>Amount (৳)<Req /></label>
          <input id={`in-a-${id}`} style={inputStyle} type="number" name="amount" min="0.01" step="0.01" inputMode="decimal" required defaultValue={income?.amount ?? ""} placeholder="e.g. 5000" />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`in-x-${id}`}>Details<Req /></label>
          <textarea
            id={`in-x-${id}`} name="details" required defaultValue={income?.details ?? ""} rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="e.g. Room rent received, book sales, sponsorship"
          />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          {income?.attachment_name && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6, fontSize: 13 }}>
              <span className="lbl" style={{ margin: 0 }}>Current file</span>
              {fileRemoved ? (
                <>
                  <s className="sub">{income.attachment_name}</s>
                  <span className="sub" style={{ color: "var(--crit)" }}>Will be deleted when you save with a new file</span>
                  <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => { setFileRemoved(false); setFileErr(null); }}>
                    Undo
                  </button>
                </>
              ) : (
                <>
                  <a href={`/income/file/${income.id}`} target="_blank" rel="noopener">{income.attachment_name}</a>
                  <button type="button" className="btn ghost" style={{ fontSize: 12, padding: "4px 10px", color: "var(--crit)" }} onClick={() => setFileRemoved(true)}>
                    Delete file
                  </button>
                </>
              )}
            </div>
          )}
          <label className="lbl" htmlFor={`in-f-${id}`}>
            {!income?.attachment_name ? "Attachment" : fileRemoved ? "New attachment" : "Replace attachment"}
            {!keepsOld && <Req />}
          </label>
          <input
            id={`in-f-${id}`} name="attachment" type="file" accept={ACCEPT} required={!keepsOld}
            style={{ ...inputStyle, padding: "7px 9px" }}
            onChange={(e) => { setFileErr(null); setFileChosen(!!e.currentTarget.files?.length); }}
          />
          <span className="sub">
            {fileRemoved
              ? "Choose the new file to save. Until then the old file stays attached."
              : keepsOld
                ? "Leave empty to keep the current file."
                : "Receipt, money receipt or voucher. Photo, PDF, Word or Excel, up to 10 MB."}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn" type="submit" disabled={busy || (fileRemoved && !fileChosen)}
          style={fileRemoved && !fileChosen ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        >{sendingFile ? "Uploading…" : busy ? "Saving…" : income ? "Save changes" : "+ Add income"}</button>
        {income && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
        {fileErr && <span className="sub" style={{ color: "var(--crit)" }}>{fileErr}</span>}
        {!fileErr && state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && !income && <span className="sub" style={{ color: "var(--ok)" }}>Added.</span>}
        {!state && !fileErr && !income && <span className="sub">Office income is visible to admin only.</span>}
      </div>
    </form>
  );
}
