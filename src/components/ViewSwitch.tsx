/** For a teacher whose access role also opens the academy-wide version of a page
 * (Dashboard, Reports): switch between their own view and the academy view. */
export default function ViewSwitch({ path, academy, mineLabel, academyLabel }: { path: string; academy: boolean; mineLabel: string; academyLabel: string }) {
  return (
    <div className="fchips no-print" role="group" aria-label="Choose view">
      <a href={path} className={`fchip${!academy ? " on" : ""}`} aria-current={!academy ? "page" : undefined}>{mineLabel}</a>
      <a href={`${path}?view=academy`} className={`fchip${academy ? " on" : ""}`} aria-current={academy ? "page" : undefined}>{academyLabel}</a>
    </div>
  );
}
