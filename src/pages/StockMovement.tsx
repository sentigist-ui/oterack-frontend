import { useState } from "react";
import {
  Plus, AlertTriangle, ArrowDown, ArrowUp, ArrowLeftRight,
  RotateCcw, Wrench, Flag, Search, Calendar, Hash, Package,
  Clock, Info, Download,
} from "lucide-react";
import { exportStockMovementsPDF } from "@/lib/pdfExport";
import AppLayout from "@/components/layout/AppLayout";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useBatches } from "@/hooks/useBatches";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDateTime, generateId, cn } from "@/lib/utils";
import type { StockMovement, StockMovementType, IngredientBatch } from "@/types";
import { Batches } from "@/lib/storage";
import { toast } from "sonner";

const TYPE_CONFIG: Record<StockMovementType, { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }> = {
  GRN:        { label: "Goods Receiving (GRN)", icon: ArrowDown,      color: "text-green-400",  bg: "bg-green-500/15" },
  ISSUE:      { label: "Issue to Kitchen/Bar",   icon: ArrowUp,        color: "text-blue-400",   bg: "bg-blue-500/15" },
  TRANSFER:   { label: "Transfer",               icon: ArrowLeftRight,  color: "text-purple-400", bg: "bg-purple-500/15" },
  ADJUSTMENT: { label: "Adjustment (Waste/Damage)", icon: Wrench,      color: "text-amber-400",  bg: "bg-amber-500/15" },
  RETURN:     { label: "Return",                 icon: RotateCcw,      color: "text-cyan-400",   bg: "bg-cyan-500/15" },
};

const LOCATIONS = ["Main Store", "Kitchen", "Bar", "Restaurant", "Events Hall", "Cold Room", "Dry Store", "Supplier"];

export default function StockMovement() {
  const { movements, addMovement, flagMovement, flagged } = useStockMovements();
  const { expiringSoon, expired, activeBatches, refresh: refreshBatches } = useBatches();
  const { ingredients } = useInventory();
  const { user } = useAuth();

  const [typeFilter, setTypeFilter] = useState<"All" | StockMovementType>("All");
  const [showFlagged, setShowFlagged] = useState(false);
  const [showBatches, setShowBatches] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ingredientId: "",
    quantity: "",
    type: "GRN" as StockMovementType,
    fromLocation: "Supplier",
    toLocation: "Main Store",
    reason: "",
    reference: "",
    // GRN-specific batch fields
    batchNumber: "",
    supplier: "",
    expiryDate: "",
  });

  const canAdd = user && ["admin", "manager", "storekeeper"].includes(user.role);
  const canApprove = user && ["admin", "manager"].includes(user.role);

  const filtered = movements.filter(m => {
    const matchType = typeFilter === "All" || m.type === typeFilter;
    const matchFlagged = !showFlagged || m.isFlagged;
    const matchSearch = m.ingredientName.toLowerCase().includes(search.toLowerCase()) || m.userName.toLowerCase().includes(search.toLowerCase());
    return matchType && matchFlagged && matchSearch;
  });

  const handleSubmit = () => {
    const ing = ingredients.find(i => i.id === form.ingredientId);
    if (!ing) { toast.error("Select an ingredient"); return; }
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) { toast.error("Quantity must be greater than 0"); return; }
    if (form.type === "ISSUE" && qty > ing.currentQuantity) {
      toast.error(`Insufficient stock. Available: ${ing.currentQuantity} ${ing.unit}`);
      return;
    }
    // Validate batch fields for GRN
    if (form.type === "GRN") {
      if (!form.batchNumber.trim()) { toast.error("Batch number is required for GRN"); return; }
      if (!form.expiryDate) { toast.error("Expiry date is required for GRN"); return; }
      if (!form.supplier.trim()) { toast.error("Supplier name is required for GRN"); return; }
    }

    const movement: StockMovement = {
      id: generateId(),
      ingredientId: ing.id,
      ingredientName: ing.name,
      ingredientUnit: ing.unit,
      quantity: qty,
      type: form.type,
      userId: user!.id,
      userName: user!.name,
      fromLocation: form.fromLocation,
      toLocation: form.toLocation,
      reason: form.reason,
      reference: form.reference || (form.type === "GRN" ? `${form.batchNumber}` : undefined),
      timestamp: new Date().toISOString(),
      unitCost: ing.costPerUnit,
      totalCost: qty * ing.costPerUnit,
      isFlagged: false,
    };

    addMovement(movement);

    // Record batch for GRN
    if (form.type === "GRN" && form.batchNumber && form.expiryDate) {
      const today = new Date().toISOString().split("T")[0];
      const weekDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const batch: IngredientBatch = {
        id: `batch_${generateId()}`,
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.unit,
        batchNumber: form.batchNumber,
        supplier: form.supplier,
        quantity: qty,
        originalQuantity: qty,
        costPerUnit: ing.costPerUnit,
        receivedDate: today,
        expiryDate: form.expiryDate,
        receivedBy: user!.name,
        grnReference: form.reference || form.batchNumber,
        isExpired: form.expiryDate < today,
        isExpiringSoon: form.expiryDate >= today && form.expiryDate <= weekDate,
        location: "main",
      };
      Batches.add(batch);
      refreshBatches();
      if (batch.isExpired) toast.warning(`⚠️ Batch ${form.batchNumber} has already expired!`);
      else if (batch.isExpiringSoon) toast.warning(`⚠️ Batch ${form.batchNumber} expires within 7 days`);
    }

    toast.success(`${TYPE_CONFIG[form.type].label} recorded successfully`);
    setShowForm(false);
    setForm({ ingredientId: "", quantity: "", type: "GRN", fromLocation: "Supplier", toLocation: "Main Store", reason: "", reference: "", batchNumber: "", supplier: "", expiryDate: "" });
  };

  const handleFlag = (id: string) => {
    const reason = prompt("Enter reason for flagging this movement:");
    if (reason) { flagMovement(id, reason); toast.warning("Movement flagged for review"); }
  };

  const totalFlaggedValue = flagged.reduce((s, m) => s + m.totalCost, 0);

  const daysUntilExpiry = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  return (
    <AppLayout>
      {/* Batch Expiry Warning */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div className={cn("mb-4 flex items-start gap-3 rounded-xl border px-4 py-3", expired.length > 0 ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10")}>
          <AlertTriangle className={cn("w-5 h-5 mt-0.5 shrink-0", expired.length > 0 ? "text-red-400" : "text-amber-400")} />
          <div>
            <p className={cn("text-sm font-semibold", expired.length > 0 ? "text-red-300" : "text-amber-300")}>
              {expired.length > 0 ? `🚨 ${expired.length} expired batch${expired.length > 1 ? "es" : ""} with remaining stock` : ""}
              {expiringSoon.length > 0 ? ` ⚠️ ${expiringSoon.length} batch${expiringSoon.length > 1 ? "es" : ""} expiring within 7 days` : ""}
            </p>
            <button onClick={() => setShowBatches(true)} className="text-xs text-amber-400/70 underline mt-0.5">View batch details →</button>
          </div>
        </div>
      )}

      {/* Flagged Banner */}
      {flagged.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-400 alert-pulse shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">🚨 {flagged.length} suspicious stock movement{flagged.length > 1 ? "s" : ""} flagged</p>
            <p className="text-xs text-red-400/70">Total flagged value: {formatCurrency(totalFlaggedValue, "ETB")} · Immediate review required</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["All", "GRN", "ISSUE", "TRANSFER", "ADJUSTMENT", "RETURN"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn("px-3 py-1.5 text-[10px] font-semibold transition-colors", typeFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showFlagged} onChange={e => setShowFlagged(e.target.checked)} className="rounded" />
          <span className="text-red-400">🚨 Flagged ({flagged.length})</span>
        </label>
        <button onClick={() => setShowBatches(!showBatches)}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors", showBatches ? "bg-primary/20 border-primary/40 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}>
          <Package className="w-3.5 h-3.5" /> Batches ({activeBatches.length})
          {expiringSoon.length > 0 && <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded">{expiringSoon.length}</span>}
        </button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportStockMovementsPDF(movements.map(m => ({ type: m.type, ingredientName: m.ingredientName, ingredientUnit: m.ingredientUnit, quantity: m.quantity, fromLocation: m.fromLocation, toLocation: m.toLocation, userName: m.userName, timestamp: m.timestamp, unitCost: m.unitCost, totalCost: m.totalCost, isFlagged: m.isFlagged, flagReason: m.flagReason, reference: m.reference })), 'Grar Hotel', user?.name ?? 'System')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canAdd && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Record Movement
            </button>
          )}
        </div>
      </div>

      {/* Batch FIFO Panel */}
      {showBatches && (
        <div className="mb-5 rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">Batch Tracking (FIFO — oldest consumed first)</p>
            <span className="ml-auto text-[10px] text-muted-foreground">{activeBatches.length} active batches</span>
          </div>
          {activeBatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">No active batches. Record a GRN with batch number and expiry date.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Batch No.", "Ingredient", "Supplier", "Received", "Expiry", "Days Left", "Remaining", "Location", "Status"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeBatches
                    .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate))
                    .map(batch => {
                      const days = daysUntilExpiry(batch.expiryDate);
                      return (
                        <tr key={batch.id} className={cn(
                          "border-b border-border/50 last:border-0 table-row-hover",
                          batch.isExpired && "bg-red-500/5",
                          batch.isExpiringSoon && !batch.isExpired && "bg-amber-500/5"
                        )}>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-mono font-semibold text-foreground">{batch.batchNumber}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-foreground">{batch.ingredientName}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{batch.supplier}</td>
                          <td className="px-3 py-2.5 text-[10px] font-mono text-muted-foreground">{batch.receivedDate}</td>
                          <td className="px-3 py-2.5 text-[10px] font-mono font-semibold text-foreground">{batch.expiryDate}</td>
                          <td className="px-3 py-2.5">
                            <span className={cn("text-xs font-bold font-mono",
                              days <= 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-green-400"
                            )}>
                              {days <= 0 ? "EXPIRED" : `${days}d`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-foreground">
                            {batch.quantity.toFixed(3)} / {batch.originalQuantity.toFixed(3)} {batch.unit}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                              batch.location === "kitchen" ? "bg-green-500/15 text-green-400" :
                              batch.location === "bar" ? "bg-purple-500/15 text-purple-400" :
                              "bg-blue-500/15 text-blue-400"
                            )}>
                              {batch.location.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {batch.isExpired ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">EXPIRED</span>
                            ) : batch.isExpiringSoon ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">EXPIRING SOON</span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">GOOD</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Movements Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Type", "Ingredient", "Qty", "From → To", "Recorded By", "Date & Time", "Value", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
              {canApprove && <th className="px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const cfg = TYPE_CONFIG[m.type];
              const Icon = cfg.icon;
              return (
                <tr key={m.id} className={cn("table-row-hover border-b border-border/50 last:border-0", m.isFlagged && "bg-red-500/5 border-l-2 border-l-red-500/50")}>
                  <td className="px-4 py-3">
                    <span className={cn("flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full w-fit", cfg.bg, cfg.color)}>
                      <Icon className="w-3 h-3" />
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{m.ingredientName}</p>
                    {m.reference && <p className="text-[10px] text-muted-foreground">{m.reference}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-foreground">{m.quantity} {m.ingredientUnit}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span>{m.fromLocation || "—"}</span>
                    {m.toLocation && <span className="text-primary"> → {m.toLocation}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-foreground">{m.userName}</p>
                    {m.approvedBy && <p className="text-[10px] text-green-400">✓ {m.approvedBy}</p>}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono">{formatDateTime(m.timestamp)}</td>
                  <td className="px-4 py-3 text-xs font-mono text-accent">{formatCurrency(m.totalCost, "ETB")}</td>
                  <td className="px-4 py-3">
                    {m.isFlagged ? (
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> FLAGGED
                        </span>
                        {m.flagReason && <p className="text-[10px] text-red-400/70 mt-0.5 max-w-[120px] truncate">{m.flagReason}</p>}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">Clear</span>
                    )}
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3">
                      {!m.isFlagged && (
                        <button onClick={() => handleFlag(m.id)}
                          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-2 py-1 rounded transition-colors">
                          <Flag className="w-3 h-3" /> Flag
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No movements found</p>
          </div>
        )}
      </div>

      {/* Record Movement Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Record Stock Movement</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Movement Type *</label>
                <select value={form.type} onChange={e => setForm(p => ({
                  ...p, type: e.target.value as StockMovementType,
                  fromLocation: e.target.value === "GRN" ? "Supplier" : "Main Store",
                  toLocation: e.target.value === "GRN" ? "Main Store" : "Kitchen",
                }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Ingredient *</label>
                <select value={form.ingredientId} onChange={e => setForm(p => ({ ...p, ingredientId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select ingredient</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.currentQuantity} {i.unit})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Quantity *</label>
                  <input type="text" inputMode="decimal" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Reference / GRN#</label>
                  <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., GRN-2024-003" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">From Location</label>
                  <select value={form.fromLocation} onChange={e => setForm(p => ({ ...p, fromLocation: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">To Location</label>
                  <select value={form.toLocation} onChange={e => setForm(p => ({ ...p, toLocation: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Reason / Notes</label>
                <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g., Spoilage, waste, event request..." />
              </div>

              {/* GRN Batch Fields */}
              {form.type === "GRN" && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-3.5 h-3.5 text-green-400" />
                    <p className="text-xs font-semibold text-green-300">Batch & Expiry Tracking (FIFO)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Batch Number *</label>
                      <input value={form.batchNumber} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="e.g. BATCH-2024-001" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Supplier Name *</label>
                      <input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="e.g. Addis Meats Co." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      <Calendar className="w-3.5 h-3.5 inline mr-1 text-green-400" />
                      Expiry Date *
                    </label>
                    <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-green-500" />
                    {form.expiryDate && (
                      <p className={cn("text-[10px] mt-1", daysUntilExpiry(form.expiryDate) <= 7 ? "text-amber-400" : "text-green-400")}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {daysUntilExpiry(form.expiryDate) <= 0
                          ? "⚠️ Already expired!"
                          : `Expires in ${daysUntilExpiry(form.expiryDate)} day(s)`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                    <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-blue-300">Items will be consumed FIFO — oldest batches deducted first when issuing or recording sales/consumption.</p>
                  </div>
                </div>
              )}

              {form.ingredientId && form.quantity && (
                <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs">
                  <p className="text-foreground font-medium">Movement Summary</p>
                  <p className="text-muted-foreground mt-1">
                    {ingredients.find(i => i.id === form.ingredientId)?.name} · {form.quantity} {ingredients.find(i => i.id === form.ingredientId)?.unit} ·{" "}
                    {formatCurrency((parseFloat(form.quantity) || 0) * (ingredients.find(i => i.id === form.ingredientId)?.costPerUnit || 0), "ETB")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSubmit} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Record Movement</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
