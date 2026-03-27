import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import VarianceBadge from "@/components/features/VarianceBadge";
import { useSales } from "@/hooks/useSales";
import { useInventory } from "@/hooks/useInventory";
import { useRecipes } from "@/hooks/useRecipes";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useVariance } from "@/hooks/useVariance";
import { formatCurrency, formatDate, formatPercent, daysAgo, cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, FileText, BarChart3, Activity } from "lucide-react";
import { Settings } from "@/lib/storage";

type ReportTab = "daily" | "variance" | "inventory" | "highRisk";

const COLORS = ["hsl(210 100% 56%)", "hsl(38 92% 50%)", "hsl(142 70% 45%)", "hsl(270 60% 60%)", "hsl(0 84% 60%)"];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" && p.value > 100 ? `ETB ${p.value.toLocaleString()}` : `${p.value}`}</p>)}
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [period, setPeriod] = useState(7);

  const { sales, dailyTrend, topItems, revenueByCategory } = useSales();
  const { ingredients } = useInventory();
  const { recipes } = useRecipes();
  const { movements, flagged } = useStockMovements();
  const { varianceItems, criticalCount, warningCount, totalPotentialLoss } = useVariance(sales, movements, recipes, ingredients, period);
  const settings = Settings.get();

  const chartData = dailyTrend.map(d => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Revenue: Math.round(d.revenue),
    Cost: Math.round(d.cost),
    Profit: Math.round(d.profit),
  }));

  const foodCostTrend = dailyTrend.map(d => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    "Food Cost %": d.revenue > 0 ? Math.round((d.cost / d.revenue) * 1000) / 10 : 0,
    Target: settings.targetFoodCostPercent,
  }));

  const pieData = revenueByCategory.map(c => ({ name: c.category, value: Math.round(c.amount) }));

  const adjMovements = movements.filter(m => m.type === "ADJUSTMENT");
  const highRiskIngredients = (() => {
    const map: Record<string, { name: string; adjustments: number; issues: number; totalLoss: number }> = {};
    movements.filter(m => m.type === "ADJUSTMENT" || m.isFlagged).forEach(m => {
      if (!map[m.ingredientId]) map[m.ingredientId] = { name: m.ingredientName, adjustments: 0, issues: 0, totalLoss: 0 };
      if (m.type === "ADJUSTMENT") map[m.ingredientId].adjustments++;
      if (m.isFlagged) map[m.ingredientId].issues++;
      map[m.ingredientId].totalLoss += m.totalCost;
    });
    return Object.values(map).sort((a, b) => b.totalLoss - a.totalLoss);
  })();

  const tabs = [
    { id: "daily" as ReportTab, label: "Daily Report", icon: BarChart3 },
    { id: "variance" as ReportTab, label: "Variance Report", icon: Activity },
    { id: "inventory" as ReportTab, label: "Inventory Report", icon: FileText },
    { id: "highRisk" as ReportTab, label: "High Risk Report", icon: AlertTriangle },
  ];

  return (
    <AppLayout>
      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary mb-6 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              activeTab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === "variance" && criticalCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground alert-pulse">{criticalCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-muted-foreground">Period:</span>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setPeriod(d)} className={cn("px-3 py-1 text-xs rounded-full transition-colors", period === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>{d} days</button>
        ))}
      </div>

      {/* DAILY REPORT */}
      {activeTab === "daily" && (
        <div className="space-y-5 fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-4">Revenue vs Cost (7 Days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 30% 18%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Revenue" fill="hsl(210 100% 56%)" radius={[4,4,0,0]} />
                  <Bar dataKey="Cost" fill="hsl(0 84% 60% / 0.7)" radius={[4,4,0,0]} />
                  <Bar dataKey="Profit" fill="hsl(142 70% 45% / 0.8)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-4">Food Cost % Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={foodCostTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 30% 18%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Food Cost %" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ fill: "hsl(38 92% 50%)", r: 3 }} />
                  <Line type="monotone" dataKey="Target" stroke="hsl(142 70% 45%)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Category</h3>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <PieChart width={160} height={160}>
                    <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                  <div className="space-y-2">
                    {pieData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-muted-foreground">{entry.name}</span>
                        <span className="text-xs font-semibold text-foreground ml-auto">{formatCurrency(entry.value, "ETB")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground">No sales data</p>}
            </div>

            <div className="stat-card">
              <h3 className="text-sm font-semibold text-foreground mb-4">Top Performing Items</h3>
              <div className="space-y-3">
                {topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-primary/20 text-primary shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                      <div className="flex-1 h-1 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(item.revenue / topItems[0].revenue) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-accent">{formatCurrency(item.revenue, "ETB")}</p>
                      <p className="text-[10px] text-muted-foreground">{item.qty} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VARIANCE REPORT */}
      {activeTab === "variance" && (
        <div className="space-y-5 fade-in">
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div className="stat-card border-red-500/30 text-center">
              <p className="text-2xl font-bold text-red-400 font-mono">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical Variances</p>
            </div>
            <div className="stat-card border-amber-500/30 text-center">
              <p className="text-2xl font-bold text-amber-400 font-mono">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Warning Variances</p>
            </div>
            <div className="stat-card border-red-500/30 text-center">
              <p className="text-2xl font-bold text-red-400 font-mono">{formatCurrency(totalPotentialLoss, "ETB")}</p>
              <p className="text-xs text-muted-foreground">Potential Loss</p>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Item-by-Item Variance Analysis ({period} Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Ingredient", "Expected", "Actual Issued", "Variance", "Variance %", "Potential Loss", "Status"].map(h => (
                      <th key={h} className="text-left pb-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {varianceItems.map(v => (
                    <tr key={v.ingredientId} className={cn("border-b border-border/50 last:border-0", v.status === "critical" && "bg-red-500/5")}>
                      <td className="py-3 pr-4">
                        <p className="text-xs font-medium text-foreground">{v.ingredientName}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs font-mono text-muted-foreground">{v.expectedConsumption} {v.unit}</td>
                      <td className="py-3 pr-4 text-xs font-mono text-foreground">{v.actualConsumption} {v.unit}</td>
                      <td className="py-3 pr-4">
                        <span className={cn("text-xs font-mono font-semibold", v.variance > 0 ? "text-red-400" : "text-green-400")}>
                          {v.variance > 0 ? "+" : ""}{v.variance} {v.unit}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <VarianceBadge status={v.status} percent={v.variancePercent} />
                      </td>
                      <td className="py-3 pr-4 text-xs font-mono text-red-400">
                        {v.potentialLoss > 0 ? formatCurrency(v.potentialLoss, "ETB") : "—"}
                      </td>
                      <td className="py-3">
                        <VarianceBadge status={v.status} showIcon={false} />
                      </td>
                    </tr>
                  ))}
                  {varianceItems.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">No variance data for this period. Record sales and stock movements first.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY REPORT */}
      {activeTab === "inventory" && (
        <div className="space-y-5 fade-in">
          <div className="stat-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Current Stock Levels</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Ingredient", "Category", "Unit", "Current Stock", "Min Threshold", "Value", "Status"].map(h => (
                      <th key={h} className="text-left pb-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(i => (
                    <tr key={i.id} className="border-b border-border/50 last:border-0 table-row-hover">
                      <td className="py-2.5 pr-4 text-xs font-medium text-foreground">{i.name}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{i.category}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{i.unit}</td>
                      <td className="py-2.5 pr-4 text-xs font-mono font-semibold text-foreground">{i.currentQuantity}</td>
                      <td className="py-2.5 pr-4 text-xs font-mono text-muted-foreground">{i.minQuantity}</td>
                      <td className="py-2.5 pr-4 text-xs font-mono text-accent">{formatCurrency(i.currentQuantity * i.costPerUnit, "ETB")}</td>
                      <td className="py-2.5">
                        {i.currentQuantity === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">OUT</span> :
                         i.currentQuantity <= i.minQuantity ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">LOW</span> :
                         <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* HIGH RISK REPORT */}
      {activeTab === "highRisk" && (
        <div className="space-y-5 fade-in">
          {flagged.length > 0 && (
            <div className="stat-card border-red-500/30">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-red-400">Flagged Suspicious Movements ({flagged.length})</h3>
              </div>
              <div className="space-y-3">
                {flagged.map(m => (
                  <div key={m.id} className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs font-semibold text-red-400">SUSPICIOUS MOVEMENT</span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{m.ingredientName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.quantity} {m.ingredientUnit} issued by <span className="text-foreground font-medium">{m.userName}</span></p>
                        <p className="text-xs text-muted-foreground">{m.fromLocation} → {m.toLocation}</p>
                        {m.flagReason && <p className="text-xs text-red-400 mt-1.5 bg-red-500/10 px-2 py-1 rounded">⚠ {m.flagReason}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-400 font-mono">{formatCurrency(m.totalCost, "ETB")}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(m.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {highRiskIngredients.length > 0 && (
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">Frequent Adjustment Items</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Ingredient", "Adjustments", "Flagged Issues", "Total Loss Value", "Risk Level"].map(h => (
                      <th key={h} className="text-left pb-3 text-[10px] font-semibold text-muted-foreground uppercase pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {highRiskIngredients.map(item => (
                    <tr key={item.name} className="border-b border-border/50 last:border-0 table-row-hover">
                      <td className="py-2.5 pr-4 text-xs font-medium text-foreground">{item.name}</td>
                      <td className="py-2.5 pr-4 text-xs font-mono text-foreground">{item.adjustments}</td>
                      <td className="py-2.5 pr-4">
                        {item.issues > 0 ? <span className="text-xs font-bold text-red-400">{item.issues} 🚨</span> : <span className="text-xs text-muted-foreground">0</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-xs font-mono text-amber-400">{formatCurrency(item.totalLoss, "ETB")}</td>
                      <td className="py-2.5">
                        {item.issues > 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">HIGH RISK</span> :
                         item.adjustments >= 3 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">MEDIUM</span> :
                         <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">LOW</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {flagged.length === 0 && highRiskIngredients.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No high-risk activities detected</p>
              <p className="text-sm mt-1">All stock movements appear normal</p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
