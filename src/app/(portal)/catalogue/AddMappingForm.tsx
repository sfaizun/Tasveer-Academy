"use client";
import { useActionState, useRef, useEffect } from "react";
import { addMapping } from "./actions";

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%", maxWidth: 240,
};

export default function AddMappingForm({
  teacherId,
  options,
}: {
  teacherId: string;
  options: { id: string; label: string; group?: string }[];
}) {
  const [state, action, pending] = useActionState(addMapping, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (options.length === 0) return null;

  // Group options under their programme (O Level / A Level / Junior) when a group is
  // supplied; options without a group render as plain top-level entries.
  const groups: { group: string; items: typeof options }[] = [];
  for (const o of options) {
    if (!o.group) continue;
    let g = groups.find((g) => g.group === o.group);
    if (!g) {
      g = { group: o.group, items: [] };
      groups.push(g);
    }
    g.items.push(o);
  }
  const ungrouped = options.filter((o) => !o.group);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
      <input type="hidden" name="teacher_id" value={teacherId} />
      <select style={selStyle} name="subject_id" required defaultValue="">
        <option value="" disabled>
          + Map a subject…
        </option>
        {ungrouped.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        {groups.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button className="btn ghost" type="submit" disabled={pending} style={{ padding: "6px 10px", fontSize: 12 }}>
        {pending ? "…" : "Add"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}
