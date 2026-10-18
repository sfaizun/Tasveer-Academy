/** Switch between the two Office Accounts pages. */
export default function OfficeTabs({ active }: { active: "expenses" | "income" }) {
  const tab = (href: string, key: "expenses" | "income", label: string) => (
    <a href={href} className={`fchip${active === key ? " on" : ""}`} aria-current={active === key ? "page" : undefined}>
      {label}
    </a>
  );
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className="lbl" style={{ margin: "0 4px 0 0" }}>Office Accounts</span>
      {tab("/expenses", "expenses", "Expenses")}
      {tab("/income", "income", "Income")}
    </div>
  );
}
