"use client";
import { Fragment, useActionState, useState } from "react";
import { fileSize } from "@/lib/files";
import PaperForm, { type PaperRow, type SubjectOpt } from "./PaperForm";
import { KIND_LABEL, sessionLabel } from "./shared";
import { removePaper } from "./actions";

function Remove({ id, onCancel }: { id: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(removePaper, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={id} />
      <span className="sub">Remove for everyone?</span>
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>{pending ? "Removing…" : "Yes, remove"}</button>
      <button className="btn ghost" type="button" onClick={onCancel} style={{ fontSize: 12, padding: "5px 10px" }}>No</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

/** Past papers, one row per paper with its question paper, mark scheme and examiner report. */
export default function PapersTable({ rows, manageable, subjects, thisYear }: {
  rows: PaperRow[]; manageable: string[]; subjects: SubjectOpt[]; thisYear: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const canManageAny = manageable.length > 0;
  const cols = 5 + (canManageAny ? 1 : 0);

  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th><th>Year</th><th>Session</th><th>Paper</th><th>Files</th>
            {canManageAny && <th className="n"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = manageable.includes(r.subject_id);
            return (
              <Fragment key={r.id}>
                <tr>
                  <td><b style={{ color: "var(--ink)" }}>{r.subject_label}</b></td>
                  <td className="mono">{r.year}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{sessionLabel(r.session)}</td>
                  <td>
                    {r.paper}
                    {r.note && <div className="sub" style={{ marginTop: 2 }}>{r.note}</div>}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {(["qp", "ms", "er"] as const).map((kind) => {
                        const f = r.files.find((x) => x.kind === kind);
                        if (!f) return null;
                        return (
                          <span key={kind} style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                            <a href={`/past-papers/file/${f.id}`} target="_blank" rel="noopener">{KIND_LABEL[kind]}</a>
                            {" "}<span className="sub">{fileSize(f.size)}</span>
                            {" · "}<a href={`/past-papers/file/${f.id}?download=1`} className="sub">Download</a>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  {canManageAny && (
                    <td className="n" style={{ whiteSpace: "nowrap" }}>
                      {!mine ? null : confirming === r.id ? (
                        <Remove id={r.id} onCancel={() => setConfirming(null)} />
                      ) : (
                        <>
                          <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setEditing(editing === r.id ? null : r.id)}>
                            {editing === r.id ? "Close" : "Edit"}
                          </button>{" "}
                          <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "5px 10px", color: "var(--crit)" }} onClick={() => setConfirming(r.id)}>
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
                {mine && editing === r.id && (
                  <tr className="no-print">
                    <td colSpan={cols} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                      <PaperForm subjects={subjects} thisYear={thisYear} paper={r} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={cols} className="sub">No past papers here yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
