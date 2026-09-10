/** Shared O Level / A Level (AS/A2) grouping for subject pickers (roster, announcements). */
export type SubjectForGrouping = {
  id: string;
  name: string;
  level: string | null;
  programme?: { code: string; name: string } | null;
};

export function groupSubjects<T extends SubjectForGrouping>(subjects: T[]) {
  const groups: { label: string; subjects: T[] }[] = [
    { label: "O Level", subjects: [] },
    { label: "A Level — AS", subjects: [] },
    { label: "A Level — A2", subjects: [] },
  ];
  for (const s of subjects) {
    const code = s.programme?.code;
    if (code === "o_level") groups[0].subjects.push(s);
    else if (code === "a_level" && s.level === "as") groups[1].subjects.push(s);
    else if (code === "a_level" && s.level === "a2") groups[2].subjects.push(s);
    // Junior subjects are excluded here — Junior scheduling/targeting is done by
    // class_level (e.g. "STD II"), not by subject, since Junior has no per-subject teacher.
  }
  return groups.filter((g) => g.subjects.length > 0);
}
