import { useState } from "react";
import {
  Wine, Search, RefreshCw, Plus, ArrowDown, ArrowUp,
  ClipboardCheck, Download,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useBarStore } from "@/hooks/useBarStore";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDateTime, generateId, cn } from "@/lib/utils";
import { Settings, PhysicalInventory } from "@/lib/storage";
import type { PhysicalInventoryCount, PhysicalCountEntry } from "@/lib/storage";
import { exportBarStorePDF, exportPhysicalCountPDF } from "@/lib/pdfExport";
import { toast } from "sonner";

export default function BarStorePage() {
  const { barStock, refresh, addQty, deductQty, totalValue } = useBarStore();
  const { user } = useAuth();
  const settings = Settings.get();

  const [search, setSearch] = useState("");
  const [showAdjust, setShowAdjust] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");

  // Physical count
  const [showPhysicalCount, setShowPhysicalCount] = useState(false);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
  const [countNotes, setCountNotes] = useState<Record<string, string>>({});
  const [savedCount, setSavedCount] = useState<PhysicalInventoryCount | null>(() => {
    const today = new Date().toISOString().split("T")[0];
    return PhysicalInventory.getByDate(`bar_${today}`) ?? null;
  });

  const canEdit = user && ["admin", "manager"].includes(user.role);
  const canCount = user && ["admin", "manager"].includes(user.role);
  const filtered = barStock.filter(k =>
    k.ingredientName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdjust = (ingredientId: string) => {
    const qty = parseFloat(adjustQty);
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    if (adjustType === "add") {
      addQty(ingredientId, qty);
      toast.success(`Added ${qty} to bar stock`);
    } else {
      deductQty(ingredientId, qty);
      toast.success(`Deducted ${qty} from bar stock`);
    }
    setShowAdjust(null);
    setAdjustQty("");
  };

  const handleSavePhysicalCount = () => {
    const today = new Date().toISOString().split("T")[0];
    const entries: PhysicalCountEntry[] = barStock.map(k => {
      const rawPhysical = physicalCounts[k.ingredientId];
      const physicalQty = rawPhysical !== undefined && rawPhysical !== "" ? parseFloat(rawPhysical) : k.currentQuantity;
      const variance = physicalQty - k.currentQuantity;
      return {
        ingredientId: k.ingredientId,
        ingredientName: k.ingredientName,
        unit: k.unit,
        theoreticalQty: k.currentQuantity,
        physicalQty: isNaN(physicalQty) ? k.currentQuantity : physicalQty,
        variance: isNaN(physicalQty) ? 0 : variance,
        varianceCost: Math.abs(isNaN(physicalQty) ? 0 : variance) * k.costPerUnit,
        costPerUnit: k.costPerUnit,
        notes: countNotes[k.ingredientId] ?? "",
      };
    });
    const shortageCount = entries.filter(e => e.variance < 0).length;
    const overageCount = entries.filter(e => e.variance > 0).length;
    const totalVarianceCost = entries.reduce((s, e) => s + e.varianceCost, 0);

    const count: PhysicalInventoryCount = {
      id: savedCount?.id ?? generateId(),
      date: `bar_${today}`,
      countedBy: user!.id,
      countedByName: user!.name,
      entries,
      totalVarianceCost,
      shortageCount,
      overageCount,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      createdAt: savedCount?.createdAt ?? new Date().toISOString(),
    };

    PhysicalInventory.save(count);
    setSavedCount(count);
    setShowPhysicalCount(false);
    toast.success(`Bar physical count saved — ${shortageCount} shortage(s), ${overageCount} overage(s)`);
  };

  const handleExportPDF = () => {
    const stockData = barStock.map(k => ({
      ingredientName: k.ingredientName,
      unit: k.unit,
      costPerUnit: k.costPerUnit,
      currentQuantity: k.currentQuantity,
      lastUpdated: k.lastUpdated,
    }));
    const pcData = savedCount?.entries.map(e => ({
      ingredientName: e.ingredientName,
      theoreticalQty: e.theoreticalQty,
      physicalQty: e.physicalQty,
      variance: e.variance,
      varianceCost: e.varianceCost,
    }));
    exportBarStorePDF(stockData, settings.hotelName, user?.name ?? "System", pcData);
    toast.success("Bar store PDF exported");
  };

  const handleExportCountPDF = () => {
    if (!savedCount) { toast.error("No physical count saved today"); return; }
    exportPhysicalCountPDF(
      {
        date: new Date().toISOString().split("T")[0],
        countedByName: savedCount.countedByName,
        entries: savedCount.entries,
        totalVarianceCost: savedCount.totalVarianceCost,
        shortageCount: savedCount.shortageCount,
        overageCount: savedCount.overageCount,
      },
      settings.hotelName,
      user?.name ?? "System",
      "Bar Store",
    );
    toast.success("Physical count PDF exported");
  };

  const emptyItems = barStock.filter(k => k.currentQuantity === 0).length;
  const lowItems = barStock.filter(k => k.currentQuantity > 0 && k.currentQuantity < 1).length;

  return (
    <AppLayout>
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{barStock.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Items in Bar</p>
        </div>
        <div className={cn("stat-card text-center", emptyItems > 0 && "border-red-500/30")}>
          <p className={cn("text-xl font-bold font-mono", emptyItems > 0 ? "text-red-400" : "text-foreground")}>{emptyItems}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Out of Stock</p>
        </div>
        <div className={cn("stat-card text-center", lowItems > 0 && "border-amber-500/30")}>
          <p className={cn("text-xl font-bold font-mono", lowItems > 0 ? "text-amber-400" : "text-foreground")}>{lowItems}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Critical Low</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-accent">{formatCurrency(totalValue, settings.currencySymbol)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bar Stock Value</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
        <Wine className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
        <p className="text-xs text-purple-300/80">
          Bar stock is auto-updated when items are issued/transferred to <strong>Bar</strong> or fulfilled via <strong>Store Requests</strong>.
          Sales deductions apply when bar items are used in recipes.
        </p>
      </div>

      {/* Today's physical count banner */}
      {savedCount && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
          <ClipboardCheck className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-purple-300">Bar physical count completed today by {savedCount.countedByName}</p>
            <p className="text-[10px] text-purple-400/70 mt-0.5">
              {savedCount.shortageCount} shortages · {savedCount.overageCount} overages ·
              Variance cost: {formatCurrency(savedCount.totalVarianceCost, settings.currencySymbol)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleExportCountPDF} className="text-[10px] text-purple-400 border border-purple-500/30 px-2 py-1 rounded-lg hover:bg-purple-500/10 flex items-center gap-1">
              <Download className="w-3 h-3" /> PDF
            </button>
            {canCount && (
              <button onClick={() => {
                const existing: Record<string, string> = {};
                const notes: Record<string, string> = {};
                savedCount.entries.forEach(e => {
                  existing[e.ingredientId] = String(e.physicalQty);
                  notes[e.ingredientId] = e.notes;
                });
                setPhysicalCounts(existing);
                setCountNotes(notes);
                setShowPhysicalCount(true);
              }} className="text-[10px] text-purple-400 underline">Re-count</button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bar stock..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canCount && (
            <button onClick={() => { setPhysicalCounts({}); setCountNotes({}); setShowPhysicalCount(true); }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700">
              <ClipboardCheck className="w-3.5 h-3.5" /> Physical Count
            </button>
          )}
        </div>
      </div>

      {barStock.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Wine className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-foreground">Bar Store is Empty</p>
          <p className="text-sm mt-2 max-w-sm mx-auto">
            Transfer items from the Main Store to Bar via Stock Movements, or submit a Store Request.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Ingredient", "Unit", "Cost/Unit", "Bar Stock",
                  ...(savedCount ? ["Physical Count", "Variance", "Var. Cost"] : []),
                  "Stock Value", "Status", ...(canEdit ? ["Adjust"] : [])].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isOut = item.currentQuantity === 0;
                const isCritical = item.currentQuantity > 0 && item.currentQuantity < 1;
                const countEntry = savedCount?.entries.find(e => e.ingredientId === item.ingredientId);
                const variance = countEntry ? countEntry.variance : null;
                const varCost = countEntry ? countEntry.varianceCost : null;
                return (
                  <tr key={item.ingredientId} className={cn(
                    "table-row-hover border-b border-border/50 last:border-0",
                    isOut && "bg-red-500/5", isCritical && "bg-amber-500/5"
                  )}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">{item.ingredientName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateTime(item.lastUpdated)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.unit}</td>
                    <td className="px-4 py-3 text-xs font-mono">{formatCurrency(item.costPerUnit, "ETB")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-bold font-mono",
                        isOut ? "text-red-400" : isCritical ? "text-amber-400" : "text-green-400"
                      )}>
                        {item.currentQuantity.toFixed(3)} {item.unit}
                      </span>
                    </td>
                    {savedCount && (
                      <>
                        <td className="px-4 py-3">
                          {countEntry ? (
                            <span className="text-xs font-bold font-mono text-foreground">{countEntry.physicalQty.toFixed(3)} {item.unit}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {variance !== null ? (
                            <span className={cn("text-xs font-bold font-mono",
                              variance < 0 ? "text-red-400" : variance > 0 ? "text-amber-400" : "text-green-400"
                            )}>
                              {variance > 0 ? "+" : ""}{variance.toFixed(3)}
                              {variance < -0.001 && <span className="block text-[9px] font-normal">▼ shortage</span>}
                              {variance > 0.001 && <span className="block text-[9px] font-normal">▲ overage</span>}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {varCost !== null && varCost > 0.01 ? (
                            <span className="text-xs font-mono text-red-400">{formatCurrency(varCost, "ETB")}</span>
                          ) : <span className="text-xs text-green-400">—</span>}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-xs font-mono">{formatCurrency(item.currentQuantity * item.costPerUnit, "ETB")}</td>
                    <td className="px-4 py-3">
                      {isOut
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">OUT</span>
                        : isCritical
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">LOW</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">OK</span>
                      }
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setShowAdjust(item.ingredientId); setAdjustQty(""); setAdjustType("add"); }}
                          className="flex items-center gap-1 text-[10px] text-primary hover:bg-primary/10 px-2 py-1 rounded"
                        >
                          <Plus className="w-3 h-3" /> Adjust
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Physical Count Modal */}
      {showPhysicalCount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Wine className="w-4 h-4 text-purple-400" /> Bar Physical Inventory Count
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Count each bar item physically. Variance = Physical − Theoretical.</p>
              </div>
              <button onClick={() => setShowPhysicalCount(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border bg-muted/30">
                    {["Ingredient", "Unit", "Theoretical Stock", "Physical Count", "Variance", "Variance Cost", "Notes"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {barStock.map(k => {
                    const raw = physicalCounts[k.ingredientId];
                    const physical = raw !== undefined && raw !== "" ? parseFloat(raw) : NaN;
                    const variance = !isNaN(physical) ? physical - k.currentQuantity : null;
                    const varCost = variance !== null ? Math.abs(variance) * k.costPerUnit : null;
                    return (
                      <tr key={k.ingredientId} className={cn("border-b border-border/50 last:border-0",
                        variance !== null && variance < 0 ? "bg-red-500/5" :
                        variance !== null && variance > 0 ? "bg-amber-500/5" : ""
                      )}>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-foreground">{k.ingredientName}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{k.unit}</td>
                        <td className="px-4 py-2.5 text-xs font-bold font-mono text-purple-400">{k.currentQuantity.toFixed(3)} {k.unit}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text" inputMode="decimal"
                            value={physicalCounts[k.ingredientId] ?? ""}
                            onChange={e => setPhysicalCounts(p => ({ ...p, [k.ingredientId]: e.target.value }))}
                            placeholder={String(k.currentQuantity.toFixed(3))}
                            className="w-24 px-2 py-1 text-xs font-mono rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          {variance !== null ? (
                            <span className={cn("text-xs font-bold font-mono",
                              variance < 0 ? "text-red-400" : variance > 0 ? "text-amber-400" : "text-green-400"
                            )}>
                              {variance > 0 ? "+" : ""}{variance.toFixed(3)}
                              {variance < -0.001 && <span className="block text-[9px] font-normal">▼ shortage</span>}
                              {variance > 0.001 && <span className="block text-[9px] font-normal">▲ overage</span>}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {varCost !== null && varCost > 0.01 ? (
                            <span className="text-xs font-mono text-red-400">{formatCurrency(varCost, "ETB")}</span>
                          ) : <span className="text-xs text-green-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            value={countNotes[k.ingredientId] ?? ""}
                            onChange={e => setCountNotes(p => ({ ...p, [k.ingredientId]: e.target.value }))}
                            placeholder="Notes..."
                            className="w-32 px-2 py-1 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Summary */}
            <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-6 text-xs">
              {(() => {
                let shortages = 0, overages = 0, totalVarCost = 0;
                barStock.forEach(k => {
                  const raw = physicalCounts[k.ingredientId];
                  if (!raw) return;
                  const p = parseFloat(raw);
                  if (isNaN(p)) return;
                  const v = p - k.currentQuantity;
                  if (v < 0) shortages++;
                  if (v > 0) overages++;
                  totalVarCost += Math.abs(v) * k.costPerUnit;
                });
                return (<>
                  <span className="text-red-400 font-semibold">{shortages} shortage(s)</span>
                  <span className="text-amber-400 font-semibold">{overages} overage(s)</span>
                  <span className="text-foreground">Variance cost: <strong className="text-red-400">{formatCurrency(totalVarCost, "ETB")}</strong></span>
                </>);
              })()}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowPhysicalCount(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSavePhysicalCount} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700">
                <ClipboardCheck className="w-4 h-4 inline mr-2" />Save Bar Count
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Adjust Bar Stock</h2>
              <button onClick={() => setShowAdjust(null)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs font-semibold text-foreground">
                {barStock.find(k => k.ingredientId === showAdjust)?.ingredientName}
              </p>
              <div className="flex gap-2">
                {(["add", "deduct"] as const).map(t => (
                  <button key={t} onClick={() => setAdjustType(t)}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                      adjustType === t
                        ? t === "add" ? "bg-green-500/20 border-green-500/40 text-green-400" : "bg-red-500/20 border-red-500/40 text-red-400"
                        : "bg-muted/30 border-border text-muted-foreground"
                    )}>
                    {t === "add" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                    {t === "add" ? "Add Stock" : "Deduct"}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quantity</label>
                <input type="text" inputMode="decimal" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. 2.5" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowAdjust(null)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={() => handleAdjust(showAdjust)}
                className={cn("flex-1 py-2 rounded-lg text-white text-sm font-semibold", adjustType === "add" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90")}>
                {adjustType === "add" ? "Add Stock" : "Deduct"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
