"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { logRequest, plusOneRequest, setRequestStatus } from "../day-actions";

export type RequestRow = {
  id: string;
  name: string;
  status: "new" | "considering" | "added" | "declined";
  note: string | null;
  item_id: string | null;
  item_name: string | null;
  item_sold30: number | null;
  total: number;
  d7: number;
  d30: number;
  first: string | null;
  last: string | null;
  student: number;
  teacher: number;
};

const STATUS: Record<RequestRow["status"], { text: string; cls: string }> = {
  new: { text: "New", cls: "due" },
  considering: { text: "Considering", cls: "due" },
  added: { text: "Added to menu", cls: "paid" },
  declined: { text: "Declined", cls: "past" },
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

function NewRequest() {
  const [state, action, pending] = useActionState(logRequest, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field" style={{ flex: "2 1 200px" }}>
        <label className="lbl" htmlFor="nr-name">Asked for</label>
        <input id="nr-name" style={inputStyle} name="name" required placeholder="e.g. Lassi" />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="nr-who">Who asked</label>
        <select id="nr-who" style={inputStyle} name="who" defaultValue="student">
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="other">Someone else</option>
        </select>
      </div>
      <div className="field" style={{ flex: "2 1 200px" }}>
        <label className="lbl" htmlFor="nr-note">Note</label>
        <input id="nr-note" style={inputStyle} name="note" placeholder="Optional, e.g. mostly A Level students after 17:00" />
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)", width: "100%" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)", width: "100%" }}>Logged. If it was already on the list, it counts as another ask.</span>}
    </form>
  );
}

function StatusEditor({ row, items, onDone }: { row: RequestRow; items: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(setRequestStatus, null);
  const [status, setStatus] = useState(row.status);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <input type="hidden" name="id" value={row.id} />
      <select style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} name="status" value={status} onChange={(e) => setStatus(e.target.value as RequestRow["status"])}>
        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
      </select>
      {status === "added" && (
        <select style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} name="item_id" defaultValue={row.item_id ?? ""}>
          <option value="">Link to menu item (optional)</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      )}
      <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} name="note" defaultValue={row.note ?? ""} placeholder="Note" />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "5px 10px" }}>{pending ? "Saving…" : "Save"}</button>
        <button className="linkbtn" type="button" onClick={onDone}>Cancel</button>
      </div>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

export default function RequestsManager({
  rows,
  items,
  soldOut,
}: {
  rows: RequestRow[];
  items: { id: string; name: string }[];
  soldOut: { name: string; n: number }[];
}) {
  const [filter, setFilter] = useState<"open" | "all" | "added" | "declined">("open");
  const [editing, setEditing] = useState<string | null>(null);
  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "open" ? r.status === "new" || r.status === "considering" : r.status === filter
  );
  const counts = {
    open: rows.filter((r) => r.status === "new" || r.status === "considering").length,
    all: rows.length,
    added: rows.filter((r) => r.status === "added").length,
    declined: rows.filter((r) => r.status === "declined").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel">
        <div className="phead">
          <div className="ptitle">Log a request</div>
          <div className="sub">Same name again counts as another ask</div>
        </div>
        <NewRequest />
      </div>

      <div className="panel">
        <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="ptitle">Requests</div>
          <div className="spacer" />
          <div className="fchips">
            {(["open", "all", "added", "declined"] as const).map((f) => (
              <button key={f} type="button" className={filter === f ? "fchip on" : "fchip"} onClick={() => setFilter(f)}>
                {f === "open" ? "Open" : f === "all" ? "All" : f === "added" ? "Added" : "Declined"} ({counts[f]})
              </button>
            ))}
          </div>
        </div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Asked for</th>
                <th className="n">Total</th>
                <th className="n">Last 7 days</th>
                <th className="n">Last 30 days</th>
                <th>Last asked</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b style={{ color: "var(--ink)" }}>{r.name}</b>
                    {r.note && <div className="sub">&ldquo;{r.note}&rdquo;</div>}
                    {(r.student > 0 || r.teacher > 0) && (
                      <div className="sub">
                        {[r.student ? `${r.student} student${r.student === 1 ? "" : "s"}` : null, r.teacher ? `${r.teacher} teacher${r.teacher === 1 ? "" : "s"}` : null]
                          .filter(Boolean).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="n mono">{r.total}</td>
                  <td className="n mono">{r.d7}</td>
                  <td className="n mono">{r.d30}</td>
                  <td className="sub" style={{ whiteSpace: "nowrap" }}>{r.last ? fmtDateTime(r.last) : "—"}</td>
                  <td>
                    {editing === r.id ? (
                      <StatusEditor row={r} items={items} onDone={() => setEditing(null)} />
                    ) : (
                      <>
                        <span className={`st ${STATUS[r.status].cls}`}><span className="dot" />{STATUS[r.status].text}</span>
                        {r.status === "added" && r.item_name && (
                          <div className="sub">as {r.item_name}{r.item_sold30 != null ? `, ${r.item_sold30} sold in 30 days` : ""}</div>
                        )}
                        <div><button className="linkbtn" type="button" onClick={() => setEditing(r.id)}>Change</button></div>
                      </>
                    )}
                  </td>
                  <td className="n">
                    <form action={plusOneRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "5px 10px" }} title="Someone asked again">+1</button>
                    </form>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={7} className="sub">{rows.length === 0 ? "No requests yet. Log one above, or from the sell screen." : "Nothing in this list."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Asked while sold out</div>
          <div className="sub">Last 7 days · missed sales, logged from the sell screen</div>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {soldOut.length === 0 ? (
            <span className="sub">None logged this week.</span>
          ) : (
            soldOut.map((s) => <span key={s.name} className="chip"><b style={{ fontWeight: 600 }}>{s.name}</b> · {s.n}</span>)
          )}
        </div>
      </div>
    </div>
  );
}
