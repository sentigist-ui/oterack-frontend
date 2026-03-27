import {
  TrendingUp, Package, AlertTriangle,
  DollarSign, ShoppingBag, Activity, Flame,
  Clock, ChefHat, DollarSign as FinanceIcon, Truck, Calendar,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import MetricCard from "@/components/features/MetricCard";
import VarianceBadge from "@/components/features/VarianceBadge";
import { useSales } from "@/hooks/useSales";
import { useInventory } from "@/hooks/useInventory";
import { useRecipes } from "@/hooks/useRecipes";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useVariance } from "@/hooks/useVariance";
import { useStoreRequests } from "@/hooks/useStoreRequests";
import { useBatches } from "@/hooks/useBatches";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Settings } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: ETB {p.value.toLocaleString()}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { todayRevenue, todayCost, todayProfit, weekRevenue, topItems, dailyTrend } = useSales();
  const { ingredients, getLowStock } = useInventory();
  const { recipes } = useRecipes();
  const { movements } = useStockMovements();
  const { varianceItems, criticalCount, totalPotentialLoss } = useVariance(
    useSales().sales, movements, recipes, ingredients
  );
  const { pendingForManager, pendingForFinance, pendingForStorekeeper } = useStoreRequests();
  const { expiringSoon, expired } = useBatches();
  const { user } = useAuth();
  const navigate = useNavigate();
  const settings = Settings.get();

  const foodCostPercent = todayRevenue > 0 ? (todayCost / todayRevenue) * 100 : 0;
  const lowStockItems = getLowStock();
  const weekFoodCost = weekRevenue > 0 ? (useSales().weekCost / weekRevenue) * 100 : 0;

  const chartData = dailyTrend.map(d => ({
    date: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    Revenue: Math.round(d.revenue),
    Cost: Math.round(d.cost),
    Profit: Math.round(d.profit),
  }));

  const role = user?.role ?? "";

  // Build pending actions for current role
  const pendingActions: { label: string; count: number; color: string; route: string; icon: React.FC<{ className?: string }> }[] = [];
  if (["admin", "manager"].includes(role) && pendingForManager.length > 0) {
    pendingActions.push({ label: "Requests awaiting manager review", count: pendingForManager.length, color: "text-amber-400", route: "/store-requests", icon: ChefHat });
  }
  if (["admin", "finance"].includes(role) && pendingForFinance.length > 0) {
    pendingActions.push({ label: "Requests awaiting finance approval", count: pendingForFinance.length, color: "text-blue-400", route: "/store-requests", icon: FinanceIcon });
  }
  if (["admin", "storekeeper"].includes(role) && pendingForStorekeeper.length > 0) {
    pendingActions.push({ label: "Requests ready to fulfill", count: pendingForStorekeeper.length, color: "text-green-400", route: "/store-requests", icon: Truck });
  }
  if (expired.length > 0) {
    pendingActions.push({ label: "Expired batches with remaining stock", count: expired.length, color: "text-red-400", route: "/batch-expiry", icon: AlertTriangle });
  }
  if (expiringSoon.length > 0) {
    pendingActions.push({ label: "Batches expiring within 7 days", count: expiringSoon.length, color: "text-amber-400", route: "/batch-expiry", icon: Calendar });
  }

  return (
    <AppLayout>
      {/* Critical alerts banner */}
      {criticalCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-400 alert-pulse shrink-0" />
          <p className="text-sm text-red-300 font-medium">
            🚨 {criticalCount} critical variance{criticalCount > 1 ? "s" : ""} detected! Potential loss:{" "}
            <span className="font-bold">{formatCurrency(totalPotentialLoss, settings.currencySymbol)}</span>
            {" "}— Review Reports immediately.
          </p>
        </div>
      )}

      {/* Pending Actions Widget */}
      {pendingActions.length > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">Pending Actions — Requires Your Attention</h3>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">{pendingActions.length} items</span>
          </div>
          <div className="divide-y divide-border/50">
            {pendingActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={i}
                  onClick={() => navigate(action.route)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg bg-muted/60 shrink-0")}>
                    <Icon className={cn("w-3.5 h-3.5", action.color)} />
                  </div>
                  <p className="flex-1 text-xs text-foreground">{action.label}</p>
                  <span className={cn("text-sm font-bold font-mono shrink-0", action.color)}>{action.count}</span>
                  <span className="text-[10px] text-primary underline shrink-0">View →</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Today's Revenue"
          value={formatCurrency(todayRevenue, "ETB")}
          subtitle="All categories combined"
          icon={DollarSign}
          variant="default"
        />
        {role !== "cashier" && (
          <MetricCard
            title="Food Cost %"
            value={formatPercent(foodCostPercent)}
            subtitle={`Target: ${settings.targetFoodCostPercent}%`}
            icon={Activity}
            variant={foodCostPercent > settings.targetFoodCostPercent + 5 ? "danger" : foodCostPercent > settings.targetFoodCostPercent ? "warning" : "success"}
          />
        )}
        {role === "cashier" && (
          <MetricCard
            title="Today's Transactions"
            value={useSales().sales.filter(s => s.date === new Date().toISOString().split('T')[0]).length.toString()}
            subtitle="Sales recorded today"
            icon={Activity}
            variant="default"
          />
        )}
        <MetricCard
          title="Variance Alerts"
          value={criticalCount.toString()}
          subtitle={`${totalPotentialLoss > 0 ? formatCurrency(totalPotentialLoss, "ETB") + " potential loss" : "No critical issues"}`}
          icon={AlertTriangle}
          variant={criticalCount > 0 ? "danger" : "success"}
        />
        <MetricCard
          title="Low Stock Items"
          value={lowStockItems.length.toString()}
          subtitle={lowStockItems.slice(0, 2).map(i => i.name).join(", ") || "All stocks healthy"}
          icon={Package}
          variant={lowStockItems.length > 3 ? "danger" : lowStockItems.length > 0 ? "warning" : "success"}
        />
      </div>

      {/* Secondary KPIs */}
      {role !== "cashier" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard title="Today's Profit" value={formatCurrency(todayProfit, "ETB")} subtitle="Gross profit" icon={TrendingUp} variant={todayProfit >= 0 ? "success" : "danger"} />
          <MetricCard title="Weekly Revenue" value={formatCurrency(weekRevenue, "ETB")} subtitle="Last 7 days" icon={ShoppingBag} />
          <MetricCard title="Weekly Food Cost" value={formatPercent(weekFoodCost)} subtitle="7-day average" icon={Flame} variant={weekFoodCost > settings.targetFoodCostPercent ? "warning" : "success"} />
          <MetricCard title="Total Ingredients" value={ingredients.length.toString()} subtitle={`${recipes.length} active recipes`} icon={Package} />
        </div>
      )}

      {/* Charts + Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">7-Day Revenue vs Cost</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 30% 18%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Revenue" fill="hsl(210 100% 56%)" radius={[4,4,0,0]} />
              <Bar dataKey="Cost" fill="hsl(0 84% 60% / 0.7)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Selling Items */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Selling Items (7 Days)</h3>
          <div className="space-y-3">
            {topItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No sales recorded yet.</p>}
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-primary/20 text-primary shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(item.revenue / (topItems[0]?.revenue || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.qty} sold</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-accent whitespace-nowrap">
                  ETB {item.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Variance Overview + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Variance Table */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Variance Overview (7 Days)</h3>
            {criticalCount > 0 && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full alert-pulse">{criticalCount} CRITICAL</span>}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {varianceItems.slice(0, 8).map(v => (
              <div key={v.ingredientId} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{v.ingredientName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Expected: {v.expectedConsumption} {v.unit} · Actual: {v.actualConsumption} {v.unit}
                  </p>
                </div>
                <VarianceBadge status={v.status} percent={v.variancePercent} />
              </div>
            ))}
            {varianceItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No variance data yet. Record sales to begin tracking.</p>}
          </div>
        </div>

        {/* Low Stock */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Low Stock Alerts</h3>
          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-sm font-medium text-green-400">All stocks are healthy</p>
              <p className="text-xs text-muted-foreground mt-1">No items below minimum threshold</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-foreground">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold ${item.currentQuantity === 0 ? "text-red-400" : "text-amber-400"}`}>
                      {item.currentQuantity} {item.unit}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Min: {item.minQuantity}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
