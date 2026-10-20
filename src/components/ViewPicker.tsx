"use client";

/** "Viewing as" menu for a login with more than one view (its own portal and its access roles).
 * Picking one opens that view's home page. */
export default function ViewPicker({ views, current, compact }: { views: { key: string; label: string }[]; current: string | null; compact?: boolean }) {
  if (views.length < 2) return null;
  return (
    <label className={`viewpick${compact ? " compact" : ""}`}>
      <span className="viewpick-lbl">Viewing as</span>
      <select
        value={current ?? ""}
        aria-label="Viewing as"
        onChange={(e) => { window.location.href = `/view?to=${encodeURIComponent(e.target.value)}`; }}
      >
        {views.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
      </select>
    </label>
  );
}
