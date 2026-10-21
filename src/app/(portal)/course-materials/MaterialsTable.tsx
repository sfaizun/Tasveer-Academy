"use client";
import { Fragment, useActionState, useState } from "react";
import { fmtDate } from "@/lib/format";
import { fileSize } from "@/lib/files";
import MaterialForm, { type BatchOpt, type MaterialRow } from "./MaterialForm";
import { removeMaterial } from "./actions";

function Remove({ id, onCancel }: { id: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(removeMaterial, null);
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

/** Course materials list. Teachers and admins who can edit get Edit and Remove on each row. */
export default function MaterialsTable({ rows, canManage, showTeacher, batches, today }: {
  rows: MaterialRow[]; canManage: boolean; showTeacher: boolean; batches: BatchOpt[]; today: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const cols = 4 + (showTeacher ? 1 : 0) + (canManage ? 1 : 0);
  return (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th>Topic</th><th>Date</th><th>Subject and batch</th>{showTeacher && <th>Teacher</th>}<th>Files</th>
            {canManage && <th className="n"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td>
                  <b style={{ color: "var(--ink)" }}>{r.title}</b>
                  {r.note && <div className="sub" style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{r.note}</div>}
                </td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.material_date)}</td>
                <td>{r.batch_label}</td>
                {showTeacher && <td>{r.teacher_name ?? <span className="sub">-</span>}</td>}
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {r.files.map((f) => (
                      <span key={f.id} style={{ fontSize: 12.5 }}>
                        <a href={`/course-materials/file/${f.id}`} target="_blank" rel="noopener">{f.name}</a>
                        {" "}<span className="sub">{fileSize(f.size)}</span>
                        {" · "}<a href={`/course-materials/file/${f.id}?download=1`} className="sub">Download</a>
                      </span>
                    ))}
                  </div>
                </td>
                {canManage && (
                  <td className="n" style={{ whiteSpace: "nowrap" }}>
                    {confirming === r.id ? (
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
              {canManage && editing === r.id && (
                <tr className="no-print">
                  <td colSpan={cols} style={{ background: "var(--tint)", padding: "14px 18px" }}>
                    <MaterialForm batches={batches} today={today} material={r} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols} className="sub">No course materials yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
