/** Switch between the Office Accounts pages. */
type Tab = "expenses" | "income" | "cash";
export default function OfficeTabs({ active }: { active: Tab }) {
  const tab = (href: string, key: Tab, label: string) => (
    <a href={href} className={`fchip${active === key ? " on" : ""}`} aria-current={active === key ? "page" : undefined}>
      {label}
    </a>
  );
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className="lbl" style={{ margin: "0 4px 0 0" }}>Office Accounts</span>
      {tab("/expenses", "expenses", "Expenses")}
      {tab("/income", "income", "Income")}
      {tab("/cash-balance", "cash", "Cash balance")}
    </div>
  );
}
