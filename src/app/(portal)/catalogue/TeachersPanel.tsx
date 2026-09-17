"use client";
import { useMemo, useState } from "react";
import AddTeacherForm from "./AddTeacherForm";
import AddMappingForm from "./AddMappingForm";
import { setTeacherActive, setMappingActive } from "./actions";

type Subject = {
  id: string;
  name: string;
  level: string | null;
  active: boolean;
  programme?: { code: string; name: string } | null;
};
type Teacher = { id: string; full_name: string; phone: string | null; email: string | null; active: boolean };
type Mapping = { teacher_id: string; subject_id: string; active: boolean };

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 12px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", minWidth: 220,
};

function subjectLabel(s: { name: string; level: string | null }) {
  return s.level ? `${s.name} (${s.level.toUpperCase()})` : s.name;
}

// Fixed display order for grouped subject dropdowns — O Level, then A Level, then Junior.
const PROGRAMME_ORDER = ["O Level", "A Level", "Junior"];
function programmeRank(name: string | undefined) {
  const i = PROGRAMME_ORDER.indexOf(name ?? "");
  return i === -1 ? PROGRAMME_ORDER.length : i;
}

export default function TeachersPanel({
  teachers,
  subjects,
  mappings,
}: {
  teachers: Teacher[];
  subjects: Subject[];
  mappings: Mapping[];
}) {
  const [subjectFilter, setSubjectFilter] = useState("");

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const mappingsByTeacher = useMemo(() => {
    const m = new Map<string, Mapping[]>();
    for (const row of mappings) {
      const list = m.get(row.teacher_id) ?? [];
      list.push(row);
      m.set(row.teacher_id, list);
    }
    return m;
  }, [mappings]);

  const filterOptions = useMemo(
    () =>
      subjects
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, label: `${s.programme?.name ?? ""} — ${subjectLabel(s)}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [subjects]
  );

  const visibleTeachers = useMemo(() => {
    if (!subjectFilter) return teachers;
    return teachers.filter((t) =>
      (mappingsByTeacher.get(t.id) ?? []).some((m) => m.active && m.subject_id === subjectFilter)
    );
  }, [teachers, mappingsByTeacher, subjectFilter]);

  return (
    <div className="panel">
      <div className="phead" style={{ flexWrap: "wrap" }}>
        <div className="ptitle">Teachers</div>
        <div className="sub">
          {visibleTeachers.length}
          {subjectFilter ? ` of ${teachers.length}` : ""} on staff
        </div>
        <div className="spacer" />
        <select
          style={selStyle}
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Filter teachers by subject"
        >
          <option value="">Filter by subject — all</option>
          {filterOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Subjects taught</th>
              <th className="n">Status</th>
              <th className="n"></th>
            </tr>
          </thead>
          <tbody>
            {visibleTeachers.map((t) => {
              const mine = mappingsByTeacher.get(t.id) ?? [];
              const activeMine = mine.filter((m) => m.active);
              const mappedIds = new Set(activeMine.map((m) => m.subject_id));
              const options = subjects
                .filter((s) => s.active && !mappedIds.has(s.id))
                .map((s) => ({
                  id: s.id,
                  label: subjectLabel(s),
                  group: s.programme?.name ?? "Other",
                }))
                .sort((a, b) => {
                  const g = programmeRank(a.group) - programmeRank(b.group);
                  return g !== 0 ? g : a.label.localeCompare(b.label);
                });

              return (
                <tr key={t.id}>
                  <td style={{ verticalAlign: "top" }}>
                    <b>{t.full_name}</b>
                    <div className="sub">{[t.phone, t.email].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td style={{ verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {activeMine.length === 0 && <span className="sub">not mapped yet</span>}
                      {activeMine.map((m) => {
                        const s = subjectById.get(m.subject_id);
                        if (!s) return null;
                        return (
                          <span key={m.subject_id} className="chip">
                            {s.programme?.name}: {subjectLabel(s)}
                            <form action={setMappingActive} style={{ display: "inline" }}>
                              <input type="hidden" name="teacher_id" value={t.id} />
                              <input type="hidden" name="subject_id" value={m.subject_id} />
                              <input type="hidden" name="active" value="false" />
                              <button
                                type="submit"
                                title="Unmap"
                                style={{
                                  border: 0, background: "transparent", color: "var(--muted)",
                                  cursor: "pointer", marginLeft: 4, fontSize: 12, padding: 0,
                                }}
                              >
                                ×
                              </button>
                            </form>
                          </span>
                        );
                      })}
                    </div>
                    <AddMappingForm teacherId={t.id} options={options} />
                  </td>
                  <td className="n">
                    {t.active ? (
                      <span className="st paid"><span className="dot" />Active</span>
                    ) : (
                      <span className="st past"><span className="dot" />Retired</span>
                    )}
                  </td>
                  <td className="n">
                    <form action={setTeacherActive}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="active" value={String(!t.active)} />
                      <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>
                        {t.active ? "Retire" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {visibleTeachers.length === 0 && (
              <tr>
                <td colSpan={4} className="sub">No teachers match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ padding: 16, borderTop: "1px solid var(--line2)" }}>
        <AddTeacherForm />
      </div>
    </div>
  );
}
