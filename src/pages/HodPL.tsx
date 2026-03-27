import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Building2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Sales, PayrollStore } from "@/lib/storage";
import { formatCurrency, cn } from "@/lib/utils";

function monthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export default function HodPLPage() {
  const { user } = useAuth();
  const department = "F&B"; // HOD sees their own department
  const currentYear = new Date().getFullYear();

  // Build last 6 months of data for the HOD's department
  const monthlyData = useMemo(() => {
    const rows = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const monthStr = `${y}-${String(m).padStart(2, "0")}`;
      const from = `${monthStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

      const sales = Sales.getDateRange(from, to);
      let revenue = 0;
      let cogs = 0;
      sales.forEach(sale => {
        revenue += sale.totalRevenue;
        cogs += sale.totalCost;
      });

      const payroll = PayrollStore.getByMonth(monthStr);
      const laborCost = payroll
        .filter(p => p.department.toLowerCase().includes("f&b") || p.department.toLowerCase().includes("kitchen") || p.department.toLowerCase().includes("bar"))
        .reduce((s, p) => s + p.netSalary + p.employerPension, 0);

      const grossProfit = revenue - cogs;
      const netIncome = grossProfit - laborCost;

      rows.push({
        period: monthStr,
        label: monthLabel(monthStr),
        revenue,
        cogs,
        grossProfit,
        laborCost,
        netIncome,
        foodCostPct: revenue > 0 ? (cogs / revenue) * 100 : 0,
      });
    }
    return rows;
  }, []);

  const currentMonthData = monthlyData[monthlyData.length - 1];
  const prevMonthData = monthlyData[monthlyData.length - 2];

  const revDelta = prevMonthData?.revenue > 0 ? ((currentMonthData.revenue - prevMonthData.revenue) / prevMonthData.revenue) * 100 : 0;
  const profitDelta = prevMonthData?.grossProfit !== 0 ? currentMonthData.netIncome - prevMonthData.netIncome : 0;
  const isProfit = currentMonthData.netIncome >= 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-border bg-card/95 shadow-xl px-3 py-2.5 text-xs backdrop-blur-sm">
        <p className="font-bold text-foreground mb-1.5">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-3 mb-0.5">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono font-semibold">{formatCurrency(p.value, "ETB")}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      {/* HOD Header */}
      <div className="flex items-start gap-4 mb-6 p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/20 shrink-0">
          <Building2 className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">{user?.name} — Department Head View</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            F&B Department P&L · {currentMonthData.label} (current month) · Last 6-month trend
          </p>
        </div>
      </div>

      {/* Current Month KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "Revenue",
            value: currentMonthData.revenue,
            delta: `${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(1)}% vs last month`,
            color: "text-blue-400",
            border: "border-blue-500/30",
            up: revDelta >= 0,
          },
          {
            label: "COGS",
            value: currentMonthData.cogs,
            delta: `${currentMonthData.foodCostPct.toFixed(1)}% food cost`,
            color: currentMonthData.foodCostPct <= 35 ? "text-amber-400" : "text-red-400",
            border: currentMonthData.foodCostPct <= 35 ? "border-amber-500/30" : "border-red-500/30",
            up: currentMonthData.foodCostPct <= 35,
          },
          {
            label: "Labor Expense",
            value: currentMonthData.laborCost,
            delta: `${currentMonthData.revenue > 0 ? ((currentMonthData.laborCost / currentMonthData.revenue) * 100).toFixed(1) : 0}% of revenue`,
            color: "text-purple-400",
            border: "border-purple-500/30",
            up: true,
          },
          {
            label: "Net Income",
            value: currentMonthData.netIncome,
            delta: `${profitDelta >= 0 ? "+" : ""}${formatCurrency(profitDelta, "ETB")} vs last month`,
            color: isProfit ? "text-green-400" : "text-red-400",
            border: isProfit ? "border-green-500/30" : "border-red-500/30",
            up: isProfit,
          },
        ].map(kpi => (
          <div key={kpi.label} className={cn("stat-card border", kpi.border)}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] text-muted-foreground font-medium">{kpi.label}</p>
              {kpi.up
                ? <TrendingUp className={cn("w-3.5 h-3.5", kpi.color)} />
                : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              }
            </div>
            <p className={cn("text-base font-bold font-mono", kpi.color)}>{formatCurrency(kpi.value, "ETB")}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{kpi.delta}</p>
          </div>
        ))}
      </div>

      {/* 6-Month Trend Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">6-Month P&L Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue, gross profit, and net income over last 6 months</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="hodRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="hodNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#hodRev)" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
            <Area type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#10b981" fill="url(#hodNet)" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
            <Area type="monotone" dataKey="netIncome" name="Net Income" stroke="#f59e0b" fill="none" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3, fill: "#f59e0b" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Monthly Breakdown (Last 6 Months)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Month", "Revenue", "COGS", "Food Cost%", "Gross Profit", "Labor", "Net Income", "P/L Status"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row, idx) => {
                const isCurrentMonth = idx === monthlyData.length - 1;
                return (
                  <tr key={row.period} className={cn(
                    "border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors",
                    isCurrentMonth && "border-l-2 border-l-teal-500/60 bg-teal-500/5"
                  )}>
                    <td className="px-4 py-2.5 text-xs font-bold text-foreground">
                      {row.label}
                      {isCurrentMonth && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400">Current</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-blue-400">{formatCurrency(row.revenue, "ETB")}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-amber-400">{formatCurrency(row.cogs, "ETB")}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs font-bold", row.foodCostPct <= 35 ? "text-green-400" : row.foodCostPct <= 45 ? "text-amber-400" : "text-red-400")}>
                        {row.foodCostPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono font-bold text-foreground">{formatCurrency(row.grossProfit, "ETB")}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-purple-400">{formatCurrency(row.laborCost, "ETB")}</td>
                    <td className="px-4 py-2.5 text-xs font-bold font-mono">
                      <span className={cn(row.netIncome >= 0 ? "text-green-400" : "text-red-400")}>
                        {formatCurrency(row.netIncome, "ETB")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                        row.netIncome >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                      )}>
                        {row.netIncome >= 0 ? "PROFIT" : "LOSS"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
