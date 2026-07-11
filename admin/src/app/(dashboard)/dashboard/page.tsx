const KPIS = [
  { label: "Revenue (this week)", value: "₹0" },
  { label: "Orders (this week)", value: "0" },
  { label: "Products", value: "0" },
  { label: "Avg. order value", value: "₹0" },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Analytics will populate once orders start coming in.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-black/10 p-4 dark:border-white/10"
          >
            <p className="text-xs font-medium text-black/60 dark:text-white/60">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
