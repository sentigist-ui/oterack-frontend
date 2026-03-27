import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Download, Filter,
  BarChart2, PieChart, Minus,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Sales, ConsumptionStore, PayrollStore, Settings } from "@/lib/storage";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Period = "monthly" | "quarterly" | "semi-annual" | "annual";
const PERIODS: { value: Period; label: string }[] = [
  { value: "monthly",     label: "Monthly" },
  { value: "quarterly",   label: "Quarterly (Q)" },
  { value: "semi-annual", label: "6 Months" },
  { value: "annual",      label: "Annual" },
];

const DEPARTMENTS = ["All", "F&B", "Kitchen", "Bar", "Events"];

function getMonthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function groupIntoQuarters(monthlyData: PLRow[]): PLRow[] {
  const quarters: Record<string, PLRow> = {};
  monthlyData.forEach(row => {
    const [year, month] = row.period.split("-");
    const q = Math.ceil(parseInt(month) / 3);
    const key = `${year}-Q${q}`;
    if (!quarters[key]) {
      quarters[key] = { period: key, label: `Q${q} ${year}`, revenue: 0, cogs: 0, grossProfit: 0, laborCost: 0, netIncome: 0, foodCostPct: 0 };
    }
    quarters[key].revenue += row.revenue;
    quarters[key].cogs += row.cogs;
    quarters[key].grossProfit += row.grossProfit;
    quarters[key].laborCost += row.laborCost;
    quarters[key].netIncome += row.netIncome;
  });
  return Object.values(quarters).map(q => ({
    ...q,
    foodCostPct: q.revenue > 0 ? (q.cogs / q.revenue) * 100 : 0,
  }));
}

interface PLRow {
  period: string;
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  laborCost: number;
  netIncome: number;
  foodCostPct: number;
}

export default function ProfitLossPage() {
  const { user } = useAuth();
  const settings = Settings.get();

  // HOD gets restricted to their department only
  const isHOD = user?.role === "hod";

  const [period, setPeriod] = useState<Period>("monthly");
  const [year, setYear] = useState(new Date().getFullYear());
  const [department, setDepartment] = useState(isHOD ? "F&B" : "All");
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  const currentYear = new Date().getFullYear();

  // Build 12 months of data for the selected year
  const monthlyData = useMemo((): PLRow[] => {
    const rows: PLRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, "0")}`;
      const from = `${monthStr}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const to = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

      const sales = Sales.getDateRange(from, to);
      let revenue = 0;
      let cogs = 0;
      sales.forEach(sale => {
        sale.items.forEach(item => {
          // Department filter
          if (department !== "All") {
            const cat = item.category?.toLowerCase() ?? "";
            const dept = department.toLowerCase();
            if (dept === "kitchen" && !["food", "traditional", "grilled", "bread"].includes(cat)) return;
            if (dept === "bar" && !["beverage", "alcohol", "non-alcohol"].includes(cat)) return;
          }
          revenue += item.totalPrice;
        });
        cogs += sale.totalCost;
      });

      // Labor cost from payroll records
      const payroll = PayrollStore.getByMonth(monthStr);
      let laborCost = 0;
      payroll.forEach(p => {
        if (department === "All" || p.department.toLowerCase().includes(department.toLowerCase())) {
          laborCost += p.netSalary + p.employerPension;
        }
      });

      const grossProfit = revenue - cogs;
      const netIncome = grossProfit - laborCost;
      const foodCostPct = revenue > 0 ? (cogs / revenue) * 100 : 0;

      rows.push({
        period: monthStr,
        label: monthLabel(monthStr),
        revenue,
        cogs,
        grossProfit,
        laborCost,
        netIncome,
        foodCostPct,
      });
    }
    return rows;
  }, [year, department]);

  const displayData = useMemo((): PLRow[] => {
    switch (period) {
      case "monthly":    return monthlyData;
      case "quarterly":  return groupIntoQuarters(monthlyData);
      case "semi-annual":return [
        (() => {
          const h1 = monthlyData.slice(0, 6);
          const r = h1.reduce((s, x) => ({ ...s, revenue: s.revenue + x.revenue, cogs: s.cogs + x.cogs, grossProfit: s.grossProfit + x.grossProfit, laborCost: s.laborCost + x.laborCost, netIncome: s.netIncome + x.netIncome }), { revenue: 0, cogs: 0, grossProfit: 0, laborCost: 0, netIncome: 0 });
          return { period: `${year}-H1`, label: `H1 ${year}`, ...r, foodCostPct: r.revenue > 0 ? (r.cogs / r.revenue) * 100 : 0 };
        })(),
        (() => {
          const h2 = monthlyData.slice(6, 12);
          const r = h2.reduce((s, x) => ({ ...s, revenue: s.revenue + x.revenue, cogs: s.cogs + x.cogs, grossProfit: s.grossProfit + x.grossProfit, laborCost: s.laborCost + x.laborCost, netIncome: s.netIncome + x.netIncome }), { revenue: 0, cogs: 0, grossProfit: 0, laborCost: 0, netIncome: 0 });
          return { period: `${year}-H2`, label: `H2 ${year}`, ...r, foodCostPct: r.revenue > 0 ? (r.cogs / r.revenue) * 100 : 0 };
        })(),
      ];
      case "annual": {
        const r = monthlyData.reduce((s, x) => ({ ...s, revenue: s.revenue + x.revenue, cogs: s.cogs + x.cogs, grossProfit: s.grossProfit + x.grossProfit, laborCost: s.laborCost + x.laborCost, netIncome: s.netIncome + x.netIncome }), { revenue: 0, cogs: 0, grossProfit: 0, laborCost: 0, netIncome: 0 });
        return [{ period: `${year}`, label: `FY ${year}`, ...r, foodCostPct: r.revenue > 0 ? (r.cogs / r.revenue) * 100 : 0 }];
      }
    }
  }, [period, monthlyData, year]);

  const totals = useMemo(() => displayData.reduce((s, r) => ({
    revenue: s.revenue + r.revenue,
    cogs: s.cogs + r.cogs,
    grossProfit: s.grossProfit + r.grossProfit,
    laborCost: s.laborCost + r.laborCost,
    netIncome: s.netIncome + r.netIncome,
  }), { revenue: 0, cogs: 0, grossProfit: 0, laborCost: 0, netIncome: 0 }), [displayData]);

  const avgFoodCostPct = totals.revenue > 0 ? (totals.cogs / totals.revenue) * 100 : 0;
  const grossMargin = totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0;
  const netMargin = totals.revenue > 0 ? (totals.netIncome / totals.revenue) * 100 : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-border bg-card/95 shadow-xl px-4 py-3 text-xs backdrop-blur-sm">
        <p className="font-bold text-foreground mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono font-semibold">{formatCurrency(p.value, "ETB")}</span>
          </div>
        ))}
      </div>
    );
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Cover header
    doc.setFillColor(10, 15, 30); doc.rect(0, 0, pw, 38, "F");
    doc.setFillColor(37, 99, 235); doc.rect(0, 38, pw, 2.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
    doc.text(settings.hotelName, 14, 15);
    doc.setFontSize(11); doc.setTextColor(148, 163, 184);
    doc.text("Profit & Loss — Executive Report", 14, 25);
    doc.setFontSize(8.5);
    doc.text(`Period: ${PERIODS.find(p => p.value === period)?.label} | Year: ${year} | Dept: ${department}`, 14, 33);
    doc.text(`Generated: ${new Date().toLocaleString()} by ${user?.name}`, pw - 14, 33, { align: "right" });

    // KPI summary boxes
    const kpis = [
      { label: "Total Revenue", value: formatCurrency(totals.revenue, "ETB"), color: [37, 99, 235] as [number,number,number] },
      { label: "Gross Profit", value: formatCurrency(totals.grossProfit, "ETB"), color: [16, 185, 129] as [number,number,number] },
      { label: "Labor Cost", value: formatCurrency(totals.laborCost, "ETB"), color: [234, 179, 8] as [number,number,number] },
      { label: "Net Income", value: formatCurrency(totals.netIncome, "ETB"), color: totals.netIncome >= 0 ? [16,185,129] as [number,number,number] : [239,68,68] as [number,number,number] },
      { label: "Food Cost %", value: `${avgFoodCostPct.toFixed(1)}%`, color: [168, 85, 247] as [number,number,number] },
      { label: "Net Margin", value: `${netMargin.toFixed(1)}%`, color: [20, 184, 166] as [number,number,number] },
    ];
    const boxW = (pw - 28 - 10) / 6;
    kpis.forEach((kpi, i) => {
      const x = 14 + i * (boxW + 2);
      doc.setFillColor(20, 27, 45); doc.roundedRect(x, 45, boxW, 20, 2, 2, "F");
      doc.setDrawColor(...kpi.color); doc.setLineWidth(0.5); doc.line(x + 2, 45, x + 2, 65);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...kpi.color);
      doc.text(kpi.value, x + boxW / 2, 53, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
      doc.text(kpi.label, x + boxW / 2, 60, { align: "center" });
    });

    // P&L table
    autoTable(doc, {
      startY: 72,
      head: [["Period", "Revenue (ETB)", "COGS (ETB)", "Gross Profit (ETB)", "Gross Margin %", "Labor Cost (ETB)", "Net Income (ETB)", "Net Margin %", "Food Cost %"]],
      body: [
        ...displayData.map(r => [
          r.label,
          r.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          r.cogs.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          r.grossProfit.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          r.revenue > 0 ? `${((r.grossProfit / r.revenue) * 100).toFixed(1)}%` : "—",
          r.laborCost.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          r.netIncome.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          r.revenue > 0 ? `${((r.netIncome / r.revenue) * 100).toFixed(1)}%` : "—",
          `${r.foodCostPct.toFixed(1)}%`,
        ]),
        // Totals row
        [
          "TOTAL",
          totals.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          totals.cogs.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          totals.grossProfit.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          `${grossMargin.toFixed(1)}%`,
          totals.laborCost.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          totals.netIncome.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          `${netMargin.toFixed(1)}%`,
          `${avgFoodCostPct.toFixed(1)}%`,
        ],
      ],
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [10, 15, 30], textColor: [148, 163, 184], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      bodyStyles: { textColor: [30, 30, 30] },
      foot: [],
      didParseCell: (data: any) => {
        if (data.row.index === displayData.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [37, 99, 235];
          data.cell.styles.textColor = [255, 255, 255];
        }
        // Color net income column
        if (data.column.index === 6 && data.row.index < displayData.length) {
          const val = parseFloat(String(data.cell.raw).replace(/,/g, ""));
          if (!isNaN(val)) data.cell.styles.textColor = val >= 0 ? [16, 120, 80] : [200, 50, 50];
        }
      },
      margin: { left: 14, right: 14 },
    });

    // Footer
    doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(`${settings.hotelName} — Confidential Executive Report`, 14, ph - 8);
    doc.text(`Page 1`, pw - 14, ph - 8, { align: "right" });

    doc.save(`PL_Report_${period}_${year}_${department}.pdf`);
    toast.success("P&L executive report exported");
  };

  return (
    <AppLayout>
      {/* Header Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Period Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                period === p.value ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Year */}
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Department */}
        {!isHOD && (
          <select value={department} onChange={e => setDepartment(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>)}
          </select>
        )}

        {/* Chart Toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <button onClick={() => setChartType("area")} className={cn("p-1.5 rounded-lg", chartType === "area" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}>
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setChartType("bar")} className={cn("p-1.5 rounded-lg", chartType === "bar" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}>
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="ml-auto">
          <button onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow">
            <Download className="w-3.5 h-3.5" /> Export PDF Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total Revenue", value: totals.revenue, type: "currency", color: "text-blue-400", border: "border-blue-500/30", icon: TrendingUp },
          { label: "COGS", value: totals.cogs, type: "currency", color: "text-amber-400", border: "border-amber-500/30", icon: Minus },
          { label: "Gross Profit", value: totals.grossProfit, type: "currency", color: totals.grossProfit >= 0 ? "text-emerald-400" : "text-red-400", border: totals.grossProfit >= 0 ? "border-emerald-500/30" : "border-red-500/30", icon: totals.grossProfit >= 0 ? TrendingUp : TrendingDown },
          { label: "Labor Cost", value: totals.laborCost, type: "currency", color: "text-purple-400", border: "border-purple-500/30", icon: DollarSign },
          { label: "Net Income", value: totals.netIncome, type: "currency", color: totals.netIncome >= 0 ? "text-green-400" : "text-red-400", border: totals.netIncome >= 0 ? "border-green-500/30" : "border-red-500/30", icon: totals.netIncome >= 0 ? TrendingUp : TrendingDown },
          { label: "Food Cost %", value: avgFoodCostPct, type: "percent", color: avgFoodCostPct <= 35 ? "text-green-400" : "text-red-400", border: avgFoodCostPct <= 35 ? "border-green-500/30" : "border-red-500/30", icon: PieChart },
        ].map(kpi => (
          <div key={kpi.label} className={cn("stat-card border", kpi.border)}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] text-muted-foreground font-medium">{kpi.label}</p>
              <kpi.icon className={cn("w-3.5 h-3.5", kpi.color)} />
            </div>
            <p className={cn("text-base font-bold font-mono", kpi.color)}>
              {kpi.type === "currency" ? formatCurrency(kpi.value, "ETB") : `${kpi.value.toFixed(1)}%`}
            </p>
            {kpi.label === "Gross Profit" && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{grossMargin.toFixed(1)}% margin</p>
            )}
            {kpi.label === "Net Income" && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{netMargin.toFixed(1)}% net margin</p>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Revenue vs Cost Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{PERIODS.find(p => p.value === period)?.label} · {year} · {department}</p>
          </div>
        </div>
        {period === "annual" ? (
          <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <BarChart2 className="w-10 h-10 mx-auto opacity-30" />
              <p>Annual summary shown in table below</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            {chartType === "area" ? (
              <AreaChart data={displayData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLabor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#gradRevenue)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#10b981" fill="url(#gradProfit)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="laborCost" name="Labor Cost" stroke="#a855f7" fill="url(#gradLabor)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="netIncome" name="Net Income" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3 }} />
              </AreaChart>
            ) : (
              <BarChart data={displayData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" opacity={0.85} radius={[3, 3, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="#f59e0b" opacity={0.8} radius={[3, 3, 0, 0]} />
                <Bar dataKey="grossProfit" name="Gross Profit" fill="#10b981" opacity={0.85} radius={[3, 3, 0, 0]} />
                <Bar dataKey="laborCost" name="Labor Cost" fill="#a855f7" opacity={0.8} radius={[3, 3, 0, 0]} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* P&L Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Profit & Loss Statement</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{department === "All" ? "All Departments" : department} · FY {year}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Period", "Revenue", "COGS", "Gross Profit", "Gross Margin", "Labor Cost", "Net Income", "Net Margin", "Food Cost %"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => {
                const gm = row.revenue > 0 ? (row.grossProfit / row.revenue) * 100 : 0;
                const nm = row.revenue > 0 ? (row.netIncome / row.revenue) * 100 : 0;
                return (
                  <tr key={row.period} className={cn("border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/10")}>
                    <td className="px-4 py-3 text-xs font-bold text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-xs font-mono text-blue-400">{formatCurrency(row.revenue, "ETB")}</td>
                    <td className="px-4 py-3 text-xs font-mono text-amber-400">{formatCurrency(row.cogs, "ETB")}</td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-foreground">{formatCurrency(row.grossProfit, "ETB")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-bold font-mono", gm >= 50 ? "text-emerald-400" : gm >= 30 ? "text-amber-400" : "text-red-400")}>
                        {gm.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-purple-400">{formatCurrency(row.laborCost, "ETB")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-bold font-mono", row.netIncome >= 0 ? "text-green-400" : "text-red-400")}>
                        {formatCurrency(row.netIncome, "ETB")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-bold font-mono", nm >= 15 ? "text-emerald-400" : nm >= 0 ? "text-amber-400" : "text-red-400")}>
                        {nm.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-bold font-mono", row.foodCostPct <= 35 ? "text-green-400" : row.foodCostPct <= 45 ? "text-amber-400" : "text-red-400")}>
                        {row.foodCostPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-primary/10">
                <td className="px-4 py-3 text-xs font-bold text-primary">TOTAL</td>
                <td className="px-4 py-3 text-xs font-mono font-bold text-blue-400">{formatCurrency(totals.revenue, "ETB")}</td>
                <td className="px-4 py-3 text-xs font-mono font-bold text-amber-400">{formatCurrency(totals.cogs, "ETB")}</td>
                <td className="px-4 py-3 text-xs font-mono font-bold text-foreground">{formatCurrency(totals.grossProfit, "ETB")}</td>
                <td className="px-4 py-3 text-xs font-bold font-mono text-foreground">{grossMargin.toFixed(1)}%</td>
                <td className="px-4 py-3 text-xs font-mono font-bold text-purple-400">{formatCurrency(totals.laborCost, "ETB")}</td>
                <td className="px-4 py-3 text-sm font-bold font-mono">
                  <span className={cn(totals.netIncome >= 0 ? "text-green-400" : "text-red-400")}>
                    {formatCurrency(totals.netIncome, "ETB")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-bold font-mono text-foreground">{netMargin.toFixed(1)}%</td>
                <td className="px-4 py-3 text-xs font-bold font-mono">
                  <span className={cn(avgFoodCostPct <= 35 ? "text-green-400" : "text-red-400")}>
                    {avgFoodCostPct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
