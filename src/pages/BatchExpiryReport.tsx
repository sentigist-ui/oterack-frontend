import { useState, useMemo } from "react";
import {
  Package, AlertTriangle, Clock, Calendar, Search, RefreshCw,
  Info, Download,
} from "lucide-react";
import { exportBatchExpiryPDF } from "@/lib/pdfExport";
import AppLayout from "@/components/layout/AppLayout";
import { useBatches } from "@/hooks/useBatches";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { Settings } from "@/lib/storage";

const daysUntilExpiry = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
};

type StatusFilter = "all" | "expired" | "expiring_soon" | "good";
type LocationFilter = "all" | "main" | "kitchen" | "bar";

export default function BatchExpiryReport() {
  const { batches, refresh, expired, expiringSoon, activeBatches } = useBatches();
  const { user } = useAuth();
  const settings = Settings.get();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [search, setSearch] = useState("");

  const allWithExpiry = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const week = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    return batches.map(b => ({
      ...b,
      isExpired: b.expiryDate < today,
      isExpiringSoon: b.expiryDate >= today && b.expiryDate <= week && b.expiryDate >= today,
      days: daysUntilExpiry(b.expiryDate),
    }));
  }, [batches]);

  const filtered = useMemo(() => {
    return allWithExpiry.filter(b => {
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "expired" && b.isExpired) ||
        (statusFilter === "expiring_soon" && b.isExpiringSoon && !b.isExpired) ||
        (statusFilter === "good" && !b.isExpired && !b.isExpiringSoon);
      const matchLoc = locationFilter === "all" || b.location === locationFilter;
      const matchSearch =
        b.ingredientName.toLowerCase().includes(search.toLowerCase()) ||
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.supplier.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchLoc && matchSearch;
    }).sort((a, b) => {
      // Sort: expired first, then expiring soon, then by days ascending
      if (a.isExpired && !b.isExpired) return -1;
      if (!a.isExpired && b.isExpired) return 1;
      if (a.isExpiringSoon && !b.isExpiringSoon) return -1;
      if (!a.isExpiringSoon && b.isExpiringSoon) return 1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
  }, [allWithExpiry, statusFilter, locationFilter, search]);

  const expiredValue = expired.reduce((s, b) => s + b.quantity * b.costPerUnit, 0);
  const expiringSoonValue = expiringSoon.reduce((s, b) => s + b.quantity * b.costPerUnit, 0);
  const totalBatchValue = activeBatches.reduce((s, b) => s + b.quantity * b.costPerUnit, 0);
  const riskValue = expiredValue + expiringSoonValue;

  return (
    <AppLayout>
      {/* Critical expiry banner */}
      {(expired.length > 0 || expiringSoon.length > 0) && (
        <div className={cn("mb-5 flex items-start gap-3 rounded-xl border px-4 py-3",
          expired.length > 0 ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"
        )}>
          <AlertTriangle className={cn("w-5 h-5 mt-0.5 shrink-0", expired.length > 0 ? "text-red-400" : "text-amber-400")} />
          <div>
            <p className={cn("text-sm font-semibold", expired.length > 0 ? "text-red-300" : "text-amber-300")}>
              {expired.length > 0 && `🚨 ${expired.length} expired batch${expired.length > 1 ? "es" : ""} still have remaining stock (${formatCurrency(expiredValue, "ETB")} at risk)`}
              {expired.length > 0 && expiringSoon.length > 0 && " · "}
              {expiringSoon.length > 0 && `⚠️ ${expiringSoon.length} batch${expiringSoon.length > 1 ? "es" : ""} expiring within 7 days (${formatCurrency(expiringSoonValue, "ETB")})`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Dispose expired stock, prioritize consuming expiring-soon batches (FIFO enforced automatically).</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className={cn("stat-card text-center", expired.length > 0 && "border-red-500/30 bg-red-500/5")}>
          <p className={cn("text-xl font-bold font-mono", expired.length > 0 ? "text-red-400" : "text-foreground")}>{expired.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Expired Batches</p>
          {expiredValue > 0 && <p className="text-[10px] text-red-400 mt-0.5">{formatCurrency(expiredValue, "ETB")} at risk</p>}
        </div>
        <div className={cn("stat-card text-center", expiringSoon.length > 0 && "border-amber-500/30 bg-amber-500/5")}>
          <p className={cn("text-xl font-bold font-mono", expiringSoon.length > 0 ? "text-amber-400" : "text-foreground")}>{expiringSoon.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Expiring This Week</p>
          {expiringSoonValue > 0 && <p className="text-[10px] text-amber-400 mt-0.5">{formatCurrency(expiringSoonValue, "ETB")}</p>}
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-green-400">{activeBatches.filter(b => !b.isExpiringSoon).length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Good Batches</p>
        </div>
        <div className={cn("stat-card text-center", riskValue > 0 && "border-red-500/20")}>
          <p className={cn("text-xl font-bold font-mono", riskValue > 0 ? "text-red-400" : "text-foreground")}>
            {formatCurrency(riskValue, "ETB")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total At-Risk Value</p>
        </div>
      </div>

      {/* FIFO info banner */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300/80">
          <strong>FIFO is enforced automatically</strong> — when ingredients are issued or used in sales/consumption, the system deducts from the oldest batch first.
          Expired batches should be manually disposed and recorded as Adjustment (Waste) in Stock Movements.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {([
            { key: "all", label: `All (${batches.length})` },
            { key: "expired", label: `Expired (${expired.length})` },
            { key: "expiring_soon", label: `Expiring Soon (${expiringSoon.length})` },
            { key: "good", label: "Good" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={cn("px-3 py-1.5 text-[10px] font-semibold transition-colors whitespace-nowrap",
                statusFilter === f.key
                  ? f.key === "expired" ? "bg-red-600 text-white" : f.key === "expiring_soon" ? "bg-amber-600 text-white" : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}>
              {f.label}
            </button>
          ))}
        </div>

        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value as LocationFilter)}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="all">All Locations</option>
          <option value="main">Main Store</option>
          <option value="kitchen">Kitchen</option>
          <option value="bar">Bar</option>
        </select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batch, ingredient..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportBatchExpiryPDF(batches.map(b => ({ batchNumber: b.batchNumber, ingredientName: b.ingredientName, supplier: b.supplier, location: b.location, receivedDate: b.receivedDate, expiryDate: b.expiryDate, quantity: b.quantity, originalQuantity: b.originalQuantity, unit: b.unit, costPerUnit: b.costPerUnit, isExpired: b.isExpired, isExpiringSoon: b.isExpiringSoon })), settings.currencySymbol, user?.name ?? 'System')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Batch Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Package className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-foreground">No batches found</p>
          <p className="text-sm mt-2">Record a GRN with batch number and expiry date to start tracking.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Status", "Batch No.", "Ingredient", "Supplier", "Location", "Received", "Expiry Date", "Days Left", "Remaining Qty", "Stock Value", "Actions"].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(batch => {
                const days = batch.days;
                return (
                  <tr key={batch.id} className={cn(
                    "table-row-hover border-b border-border/50 last:border-0",
                    batch.isExpired && "bg-red-500/5 border-l-2 border-l-red-500/50",
                    batch.isExpiringSoon && !batch.isExpired && "bg-amber-500/5 border-l-2 border-l-amber-500/50",
                  )}>
                    <td className="px-3 py-3">
                      {batch.isExpired ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">🚨 EXPIRED</span>
                      ) : batch.isExpiringSoon ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">⚠️ EXPIRING SOON</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">✓ GOOD</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-mono font-semibold text-foreground">{batch.batchNumber}</span>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium text-foreground">{batch.ingredientName}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{batch.supplier}</td>
                    <td className="px-3 py-3">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        batch.location === "kitchen" ? "bg-green-500/15 text-green-400" :
                        batch.location === "bar" ? "bg-purple-500/15 text-purple-400" :
                        "bg-blue-500/15 text-blue-400"
                      )}>
                        {batch.location.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[10px] font-mono text-muted-foreground">{batch.receivedDate}</td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs font-mono font-semibold",
                        batch.isExpired ? "text-red-400" : batch.isExpiringSoon ? "text-amber-400" : "text-foreground"
                      )}>
                        {batch.expiryDate}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-sm font-bold font-mono",
                        days <= 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : days <= 30 ? "text-yellow-400" : "text-green-400"
                      )}>
                        {days <= 0 ? "EXPIRED" : `${days}d`}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs font-mono font-semibold",
                        batch.quantity === 0 ? "text-muted-foreground" : "text-foreground"
                      )}>
                        {batch.quantity.toFixed(3)} / {batch.originalQuantity.toFixed(3)} {batch.unit}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs font-mono",
                        batch.isExpired ? "text-red-400" : "text-accent"
                      )}>
                        {formatCurrency(batch.quantity * batch.costPerUnit, settings.currencySymbol)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {batch.isExpired && batch.quantity > 0 && (
                        <a href="/stock-movements"
                          className="text-[10px] text-amber-400 underline hover:text-amber-300 whitespace-nowrap">
                          Record Disposal →
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer summary */}
          <div className="px-4 py-3 bg-muted/20 border-t border-border flex items-center gap-6 text-xs">
            <span className="text-muted-foreground">{filtered.length} batches shown</span>
            <span className="text-foreground">
              Total remaining value: <strong className="text-accent font-mono">
                {formatCurrency(filtered.reduce((s, b) => s + b.quantity * b.costPerUnit, 0), settings.currencySymbol)}
              </strong>
            </span>
            {filtered.some(b => b.isExpired) && (
              <span className="text-red-400 font-semibold">
                ⚠ Expired stock value: {formatCurrency(filtered.filter(b => b.isExpired).reduce((s, b) => s + b.quantity * b.costPerUnit, 0), settings.currencySymbol)}
              </span>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
