"use client";
import { useMemo, useState } from "react";
import { taka, fmtDate } from "@/lib/format";

export type StudentRow = {
  id: string;
  reg_no: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  admitted_on: string | null;
  created_at: string;
  programme?: { name: string } | null;
  class_level?: { name: string } | null;
  invoice?: { balance: number; status: string }[] | null;
};

function duesOf(s: StudentRow) {
  const invoices = s.invoice ?? [];
  const outstanding = invoices
    .filter((i) => i.status !== "void" && i.status !== "waived")
    .reduce((sum, i) => sum + Number(i.balance || 0), 0);
  return outstanding;
}

const STATUS_OPTIONS = [
  { value: "applicant", label: "Applicant" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "alumni", label: "Alumni" },
];

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 12px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", minWidth: 180,
};

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    applicant: { cls: "due", label: "Applicant" },
    active: { cls: "paid", label: "Active" },
    on_hold: { cls: "part", label: "On hold" },
    dropped: { cls: "over", label: "Dropped" },
    alumni: { cls: "past", label: "Alumni" },
  };
  const m = map[status] ?? { cls: "due", label: status };
  return (
    <span className={`st ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

export default function StudentsTable({ students }: { students: StudentRow[] }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        const haystack = `${s.full_name} ${s.reg_no} ${s.phone ?? ""} ${s.email ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [students, statusFilter, q]);

  return (
    <div className="panel">
      <div className="phead" style={{ flexWrap: "wrap" }}>
        <div className="ptitle">Students</div>
        <div className="sub">
          {filtered.length}
          {statusFilter || q ? ` of ${students.length}` : ""} total
        </div>
        <div className="spacer" />
        <input
          type="text"
          placeholder="Search name, reg. no, phone…"
          style={inputStyle}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Filter by status — all</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Reg. no.</th>
              <th>Name</th>
              <th>Programme / class</th>
              <th>Contact</th>
              <th>Admitted</th>
              <th className="n">Dues</th>
              <th className="n">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const dues = duesOf(s);
              return (
                <tr key={s.id}>
                  <td className="mono"><a href={`/students/${s.id}`}><b>{s.reg_no}</b></a></td>
                  <td><a href={`/students/${s.id}`}><b>{s.full_name}</b></a></td>
                  <td>{[s.programme?.name, s.class_level?.name].filter(Boolean).join(" — ") || "—"}</td>
                  <td className="sub">{[s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="mono sub">{fmtDate(s.admitted_on)}</td>
                  <td className="n mono">
                    {dues > 0 ? (
                      <span className="st due"><span className="dot" />{taka(dues)}</span>
                    ) : (
                      <span className="sub">—</span>
                    )}
                  </td>
                  <td className="n"><StatusChip status={s.status} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && students.length > 0 && (
              <tr>
                <td colSpan={7} className="sub">No students match this filter.</td>
              </tr>
            )}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="sub">
                  No students yet — approve a submitted form on the <a href="/applications">Applications</a> page
                  to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
