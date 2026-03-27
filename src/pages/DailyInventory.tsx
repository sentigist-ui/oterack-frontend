import { useState, useEffect } from "react";
import { ClipboardList, Plus, CheckCircle, AlertTriangle, TrendingDown, TrendingUp, Send, Shield, FileText } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useDailyInventory } from "@/hooks/useDailyInventory";
import { useKitchenStore } from "@/hooks/useKitchenStore";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, getTodayISO, cn } from "@/lib/utils";
import type { DailyInventorySheet } from "@/types";
import { toast } from "sonner";
import { Settings } from "@/lib/storage";

export default function DailyInventoryPage() {
  const { user } = useAuth();
  const { kitchenStock } = useKitchenStore();
  const {
    sheets, getTodaySheet, createSheet,
    updatePhysicalCount, updateEntryNotes,
    submitSheet, approveSheet, markShortageReported,
  } = useDailyInventory();
  const settings = Settings.get();

  const [selectedDate, setSelectedDate] = useState(getTodayISO());
  const [activeSheet, setActiveSheet] = useState<DailyInventorySheet | null>(null);
  const [editingCounts, setEditingCounts] = useState<Record<string, string>>({});

  const canEdit = user && ["admin", "manager", "kitchen", "storekeeper"].includes(user.role);
  const canApprove = user && ["admin", "manager"].includes(user.role);

  // Sync active sheet when sheets or date changes
  useEffect(() => {
    const found = sheets.find(s => s.date === selectedDate) || null;
    setActiveSheet(found);
    if (found) {
      const counts: Record<string, string> = {};
      found.entries.forEach(e => { counts[e.ingredientId] = String(e.physicalCount); });
      setEditingCounts(counts);
    }
  }, [sheets, selectedDate]);

  const handleCreateSheet = () => {
    if (!user) return;
    if (kitchenStock.length === 0) {
      toast.error("No kitchen stock found. Transfer items from main store to kitchen first.");
      return;
    }
    const sheet = createSheet(selectedDate, user);
    toast.success(`Daily inventory sheet created for ${formatDate(selectedDate)}`);
    setActiveSheet(sheet);
  };

  const handleCountChange = (ingredientId: string, val: string) => {
    setEditingCounts(prev => ({ ...prev, [ingredientId]: val }));
  };

  const handleCountBlur = (sheetId: string, ingredientId: string, val: string) => {
    const qty = parseFloat(val);
    if (!isNaN(qty) && qty >= 0) {
      updatePhysicalCount(sheetId, ingredientId, qty);
    }
  };

  const handleSubmit = (sheetId: string) => {
    if (!user) return;
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const hasPendingShortage = sheet.entries.some(e => e.status === "shortage" && !e.isShortageReported);
    if (hasPendingShortage) {
      if (!confirm("There are unreported shortages. Submit anyway?")) return;
    }
    submitSheet(sheetId, user.name);
    toast.success("Daily inventory submitted successfully");
  };

  const handleApprove = (sheetId: string) => {
    if (!user) return;
    approveSheet(sheetId, user.name);
    toast.success("Daily inventory approved");
  };

  const handleReportShortage = (sheetId: string, ingredientId: string, ingName: string, shortage: number, unit: string, cost: number) => {
    markShortageReported(sheetId, ingredientId);
    toast.warning(`Shortage reported: ${Math.abs(shortage).toFixed(3)} ${unit} of ${ingName} — Cost: ${formatCurrency(Math.abs(shortage) * cost, "ETB")}`);
  };

  const statusColors = {
    ok: "text-green-400 bg-green-500/10",
    shortage: "text-red-400 bg-red-500/10",
    overage: "text-blue-400 bg-blue-500/10",
  };

  return (
    <AppLayout>
      {/* Date picker + create */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Inventory Date</label>
          <input
            type="date"
            value={selectedDate}
            max={getTodayISO()}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {!activeSheet && canEdit && (
          <button
            onClick={handleCreateSheet}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" /> Create Inventory Sheet
          </button>
        )}

        {activeSheet && (
          <div className="flex items-center gap-2 ml-auto">
            <span className={cn(
              "text-[10px] font-bold px-2.5 py-1 rounded-full border",
              activeSheet.status === "draft" && "bg-amber-500/10 text-amber-400 border-amber-500/30",
              activeSheet.status === "submitted" && "bg-blue-500/10 text-blue-400 border-blue-500/30",
              activeSheet.status === "approved" && "bg-green-500/10 text-green-400 border-green-500/30",
            )}>
              {activeSheet.status.toUpperCase()}
            </span>
            {activeSheet.status === "draft" && canEdit && (
              <button
                onClick={() => handleSubmit(activeSheet.id)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                <Send className="w-3.5 h-3.5" /> Submit
              </button>
            )}
            {activeSheet.status === "submitted" && canApprove && (
              <button
                onClick={() => handleApprove(activeSheet.id)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
              >
                <Shield className="w-3.5 h-3.5" /> Approve
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      {activeSheet && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total Items", value: activeSheet.entries.length, color: "text-foreground" },
            { label: "Shortages", value: activeSheet.shortageCount, color: activeSheet.shortageCount > 0 ? "text-red-400" : "text-foreground", urgent: activeSheet.shortageCount > 0 },
            { label: "Overages", value: activeSheet.overageCount, color: activeSheet.overageCount > 0 ? "text-blue-400" : "text-foreground" },
            { label: "Variance Cost", value: formatCurrency(activeSheet.totalVarianceCost, settings.currencySymbol), color: activeSheet.totalVarianceCost > 0 ? "text-amber-400" : "text-green-400" },
          ].map(s => (
            <div key={s.label} className={cn("stat-card text-center", s.urgent && "border-red-500/30")}>
              <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Shortage alerts banner */}
      {activeSheet && activeSheet.shortageCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">
              🚨 {activeSheet.shortageCount} Shortage{activeSheet.shortageCount > 1 ? "s" : ""} Detected
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              Physical count is below theoretical closing. Possible theft, spillage, or unrecorded usage.
              Total shortage cost: {formatCurrency(activeSheet.entries.filter(e => e.status === "shortage").reduce((s, e) => s + e.varianceCost, 0), "ETB")}
            </p>
          </div>
        </div>
      )}

      {/* Sheet not created */}
      {!activeSheet && (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-foreground">No Inventory Sheet for {formatDate(selectedDate)}</p>
          <p className="text-sm mt-2 max-w-sm mx-auto">
            {kitchenStock.length === 0
              ? "Transfer ingredients to the Kitchen Store first, then create a daily inventory sheet."
              : "Click 'Create Inventory Sheet' to start the daily count for this date."}
          </p>
        </div>
      )}

      {/* Inventory Table */}
      {activeSheet && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Ingredient", "Unit", "Opening", "Transferred In", "Sales Usage", "Manual Use", "Theoretical", "Physical Count", "Variance", "Variance Cost", "Status", "Action"].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.entries.map(entry => {
                const isEditable = activeSheet.status === "draft" && canEdit;
                const varIcon = entry.variance < -0.001
                  ? <TrendingDown className="w-3 h-3" />
                  : entry.variance > 0.001
                    ? <TrendingUp className="w-3 h-3" />
                    : <CheckCircle className="w-3 h-3" />;

                return (
                  <tr key={entry.ingredientId} className={cn(
                    "table-row-hover border-b border-border/50 last:border-0",
                    entry.status === "shortage" && "bg-red-500/5 border-l-2 border-l-red-500/50",
                    entry.status === "overage" && "bg-blue-500/5",
                  )}>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium text-foreground">{entry.ingredientName}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{entry.unit}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-foreground">{entry.openingStock.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-green-400">
                      {entry.transferredIn > 0 ? `+${entry.transferredIn.toFixed(3)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-amber-400">
                      {entry.theoreticalUsage > 0 ? `-${entry.theoreticalUsage.toFixed(3)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-orange-400">
                      {entry.manualConsumption > 0 ? `-${entry.manualConsumption.toFixed(3)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold font-mono text-foreground">
                      {entry.theoreticalClosing.toFixed(3)}
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditable ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingCounts[entry.ingredientId] ?? String(entry.physicalCount)}
                          onChange={e => handleCountChange(entry.ingredientId, e.target.value)}
                          onBlur={e => handleCountBlur(activeSheet.id, entry.ingredientId, e.target.value)}
                          className={cn(
                            "w-20 px-2 py-1 text-xs font-mono rounded-lg bg-input border text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
                            entry.status === "shortage" ? "border-red-500/50" : "border-border"
                          )}
                          placeholder="0.000"
                        />
                      ) : (
                        <span className="text-xs font-mono font-bold text-foreground">{entry.physicalCount.toFixed(3)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "flex items-center gap-1 text-xs font-mono font-bold",
                        entry.variance < -0.001 ? "text-red-400" : entry.variance > 0.001 ? "text-blue-400" : "text-green-400"
                      )}>
                        {varIcon}
                        {entry.variance > 0 ? "+" : ""}{entry.variance.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-amber-400">
                      {entry.varianceCost > 0 ? formatCurrency(entry.varianceCost, "ETB") : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit", statusColors[entry.status])}>
                        {varIcon} {entry.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {entry.status === "shortage" && !entry.isShortageReported && canApprove && (
                        <button
                          onClick={() => handleReportShortage(activeSheet.id, entry.ingredientId, entry.ingredientName, entry.variance, entry.unit, entry.costPerUnit)}
                          className="flex items-center gap-1 text-[10px] text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-colors whitespace-nowrap"
                        >
                          <FileText className="w-3 h-3" /> Report
                        </button>
                      )}
                      {entry.isShortageReported && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-400" /> Reported
                        </span>
                      )}
                      {entry.status === "overage" && (
                        <span className="text-[10px] text-blue-400">Overage OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* History */}
      {sheets.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Inventory Sheets</h3>
          <div className="space-y-2">
            {sheets.slice(0, 7).map(sheet => (
              <div
                key={sheet.id}
                onClick={() => setSelectedDate(sheet.date)}
                className={cn(
                  "stat-card cursor-pointer flex items-center justify-between hover:border-primary/40 transition-colors",
                  sheet.date === selectedDate && "border-primary/50 bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{formatDate(sheet.date)}</p>
                    <p className="text-[10px] text-muted-foreground">{sheet.entries.length} items · by {sheet.submittedBy}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sheet.shortageCount > 0 && (
                    <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                      {sheet.shortageCount} shortages
                    </span>
                  )}
                  {sheet.overageCount > 0 && (
                    <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      {sheet.overageCount} overages
                    </span>
                  )}
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    sheet.status === "approved" && "bg-green-500/10 text-green-400",
                    sheet.status === "submitted" && "bg-blue-500/10 text-blue-400",
                    sheet.status === "draft" && "bg-amber-500/10 text-amber-400",
                  )}>
                    {sheet.status.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono text-amber-400">{formatCurrency(sheet.totalVarianceCost, "ETB")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
