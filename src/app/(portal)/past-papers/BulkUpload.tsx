"use client";
import { useMemo, useState } from "react";
import { fileSize, uploadStudyFiles } from "@/lib/files";
import type { SubjectOpt } from "./PaperForm";
import { SESSIONS, KIND_LABEL } from "./shared";
import { refreshPapers, saveBulkPaper } from "./actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};
const OK_EXT = ["pdf", "jpg", "jpeg", "png", "webp"];
const MAX = 20 * 1024 * 1024;
const KINDS = ["qp", "ms", "er"] as const;
type Kind = (typeof KINDS)[number];

type Row = {
  key: string;
  subjectId: string;
  paper: string;
  files: Partial<Record<Kind, File>>;
  status: "ready" | "uploading" | "done" | "failed";
  note?: string;
};

const words = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
// Other names the files may use for a subject.
const ALIASES: Record<string, string[]> = {
  "business studies": ["business"],
  "english": ["english language", "english"],
  "ial english": ["english language", "english"],
  "ial mathematics": ["mathematics", "maths"],
  "law paper 1 2": ["law"],
};

/** Best subject for a file name: the subject (or one of its other names) whose words all appear
 * in the name, preferring the longest; null when nothing matches. */
function matchSubject(name: string, subjects: SubjectOpt[]): SubjectOpt | null {
  const w = new Set(words(name));
  let best: { s: SubjectOpt; len: number } | null = null;
  for (const s of subjects) {
    const base = words(s.name ?? s.label).join(" ");
    for (const cand of [base, ...(ALIASES[base] ?? [])]) {
      const cw = cand.split(" ");
      if (cw.every((x) => w.has(x)) && (!best || cw.length > best.len)) best = { s, len: cw.length };
    }
  }
  return best?.s ?? null;
}

function kindOf(name: string): Kind {
  const n = name.toLowerCase();
  if (/mark\s*scheme|\bms\b/.test(n)) return "ms";
  if (/examiner'?s?\s*report|\ber\b/.test(n)) return "er";
  return "qp";
}

/** "paper 1H" gives "Paper 1H", "unit 2" gives "Unit 2", "P3" gives "P3". */
function paperOf(name: string): string {
  const n = name.replace(/\.[a-z0-9]+$/i, "");
  let m = n.match(/paper\s*(\d+\s*[a-z]?)\b/i);
  if (m) return `Paper ${m[1].replace(/\s+/g, "").toUpperCase()}`;
  m = n.match(/unit\s*(\d+)/i);
  if (m) return `Unit ${m[1]}`;
  m = n.match(/\b([PSM][1-4])\b/);
  if (m) return m[1];
  return "";
}

/** Upload a whole exam session at once: choose all the question papers, mark schemes and examiner
 * reports; each file is matched to a subject, a paper and a kind from its name. Check the list,
 * fix anything that didn't match, then upload. A paper already on the portal gets the new files. */
export default function BulkUpload({ subjects, thisYear }: { subjects: SubjectOpt[]; thisYear: number }) {
  const [level, setLevel] = useState<"o_level" | "a_level">(subjects.some((s) => s.programme === "o_level") ? "o_level" : "a_level");
  const [year, setYear] = useState(String(thisYear - 1));
  const [session, setSession] = useState("jun");
  const [rows, setRows] = useState<Row[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const levelSubjects = useMemo(() => subjects.filter((s) => s.programme === level), [subjects, level]);

  function pick(list: FileList | null) {
    setMsg(null);
    const files = Array.from(list ?? []);
    const groups = new Map<string, Row>();
    const bad: string[] = [];
    for (const f of files) {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (!OK_EXT.includes(ext)) { bad.push(`${f.name} (not a PDF or photo)`); continue; }
      if (f.size > MAX) { bad.push(`${f.name} (over 20 MB)`); continue; }
      const s = matchSubject(f.name, levelSubjects);
      const paper = paperOf(f.name);
      const kind = kindOf(f.name);
      const key = `${s?.id ?? "?" + f.name}|${paper.toLowerCase()}`;
      const row = groups.get(key) ?? { key, subjectId: s?.id ?? "", paper, files: {}, status: "ready" as const };
      if (row.files[kind]) { bad.push(`${f.name} (a second ${KIND_LABEL[kind].toLowerCase()} for the same paper)`); continue; }
      row.files[kind] = f;
      groups.set(key, row);
    }
    const label = (r: Row) => levelSubjects.find((s) => s.id === r.subjectId)?.label ?? "~";
    setRows([...groups.values()].sort((a, b) => label(a).localeCompare(label(b)) || a.paper.localeCompare(b.paper, undefined, { numeric: true })));
    setSkipped(bad);
  }

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const problem = (r: Row) => (!r.subjectId ? "Choose the subject" : !r.paper.trim() ? "Enter the paper" : null);
  const readyRows = rows.filter((r) => r.status !== "done" && !problem(r));

  async function uploadAll() {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1990 || y > thisYear + 1) { setMsg("Enter a valid year."); return; }
    setBusy(true);
    setMsg(null);
    let ok = 0;
    let failed = 0;
    for (const r of readyRows) {
      update(r.key, { status: "uploading", note: undefined });
      try {
        const up: { kind: string; path: string; name: string; type: string; size: number }[] = [];
        for (const k of KINDS) {
          const f = r.files[k];
          if (!f) continue;
          const [u] = await uploadStudyFiles("past-papers", r.subjectId, [f]);
          up.push({ ...u, kind: k });
        }
        const res = await saveBulkPaper({ subject_id: r.subjectId, year: y, session, paper: r.paper, files: up });
        if (res.error) throw new Error(res.error);
        update(r.key, { status: "done", note: res.updated ? "Added to the existing paper" : undefined });
        ok++;
      } catch (x) {
        update(r.key, { status: "failed", note: (x as Error).message });
        failed++;
      }
    }
    await refreshPapers();
    setBusy(false);
    setMsg(`${ok} ${ok === 1 ? "paper" : "papers"} uploaded${failed ? `, ${failed} failed (see the list)` : ""}.`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        <div className="field">
          <label className="lbl" htmlFor="bu-level">Level</label>
          <select id="bu-level" value={level} onChange={(e) => { setLevel(e.target.value as "o_level" | "a_level"); setRows([]); setSkipped([]); }} style={input} disabled={busy}>
            {subjects.some((s) => s.programme === "o_level") && <option value="o_level">O Level</option>}
            {subjects.some((s) => s.programme === "a_level") && <option value="a_level">A Level</option>}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="bu-year">Year</label>
          <input id="bu-year" type="number" min={1990} max={thisYear + 1} value={year} onChange={(e) => setYear(e.target.value)} style={input} disabled={busy} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="bu-ses">Session</label>
          <select id="bu-ses" value={session} onChange={(e) => setSession(e.target.value)} style={input} disabled={busy}>
            {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor="bu-files">Files</label>
          <input id="bu-files" type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files)} style={{ ...input, padding: 8 }} disabled={busy} />
          <span className="sub">
            Select all the files together (unzip them first). Mark schemes or examiner reports on their own are added to papers already uploaded. Names like &ldquo;Physics may 2025 question paper 1&rdquo; and
            &ldquo;Physics may 2025 Mark Scheme paper 1&rdquo; are matched automatically.
          </span>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="tblwrap" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
          <table>
            <thead>
              <tr><th>Subject</th><th>Paper / unit</th><th>Files</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = problem(r);
                return (
                  <tr key={r.key}>
                    <td style={{ minWidth: 190 }}>
                      <select value={r.subjectId} onChange={(e) => update(r.key, { subjectId: e.target.value })} style={input} disabled={busy || r.status === "done"} aria-label="Subject">
                        <option value="">Choose…</option>
                        {levelSubjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <input value={r.paper} onChange={(e) => update(r.key, { paper: e.target.value })} style={input} disabled={busy || r.status === "done"} aria-label="Paper" placeholder="e.g. Paper 1" />
                    </td>
                    <td>
                      {KINDS.map((k) => r.files[k] && (
                        <div key={k} style={{ fontSize: 12.5 }}>
                          <b style={{ color: "var(--ink)" }}>{KIND_LABEL[k]}:</b> {r.files[k]!.name} <span className="sub">{fileSize(r.files[k]!.size)}</span>
                        </div>
                      ))}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.status === "done" ? <span className="st paid"><span className="dot" />Uploaded</span>
                        : r.status === "uploading" ? <span className="st part"><span className="dot" />Uploading…</span>
                        : r.status === "failed" ? <span className="st over"><span className="dot" />Failed</span>
                        : p ? <span className="st over"><span className="dot" />{p}</span>
                        : <span className="st due"><span className="dot" />Ready</span>}
                      {r.status === "ready" && !p && !r.files.qp && <div className="sub" style={{ whiteSpace: "normal", maxWidth: 260 }}>No question paper: adds to the paper already on the portal</div>}
                      {r.note && <div className="sub" style={{ whiteSpace: "normal", maxWidth: 260 }}>{r.note}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {skipped.length > 0 && (
        <div className="sub" style={{ color: "var(--warn)" }}>Left out: {skipped.join("; ")}</div>
      )}

      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={uploadAll} disabled={busy || readyRows.length === 0}>
            {busy ? "Uploading…" : `Upload ${readyRows.length} ${readyRows.length === 1 ? "paper" : "papers"}`}
          </button>
          <span className="sub">
            {SESSIONS.find((s) => s.value === session)?.label} {year}, {level === "o_level" ? "O Level" : "A Level"}.
            {rows.some((r) => problem(r) && r.status !== "done") ? " Rows marked in red are skipped until fixed." : ""}
          </span>
          {msg && <span className="sub" style={{ color: "var(--ok)" }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}
