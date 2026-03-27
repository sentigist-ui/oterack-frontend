import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, ClipboardCheck, Download } from "lucide-react";
import { exportInventoryPDF, exportPhysicalCountPDF } from "@/lib/pdfExport";
import AppLayout from "@/components/layout/AppLayout";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, generateId, cn } from "@/lib/utils";
import type { Ingredient } from "@/types";
import { toast } from "sonner";
import { Settings, PhysicalInventory } from "@/lib/storage";
import type { PhysicalInventoryCount, PhysicalCountEntry } from "@/lib/storage";

const UNITS = ["kg", "g", "liter", "ml", "pcs", "bottle", "box", "can", "bag", "dozen"];
const CATEGORIES = ["Meat", "Poultry", "Seafood", "Vegetables", "Dairy", "Dry Goods", "Spices", "Beverage", "Condiments", "Other"];

const EMPTY_ING: Partial<Ingredient> & { _rawCost?: string; _rawQty?: string; _rawMin?: string } = {
  name: "", unit: "kg", costPerUnit: 0, currentQuantity: 0, minQuantity: 0, category: "Dry Goods",
};

export default function Inventory() {
  const { ingredients, upsert, remove, getLowStock, categories } = useInventory();
  const { user } = useAuth();
  const settings = Settings.get();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingIng, setEditingIng] = useState<Partial<Ingredient> & { _rawCost?: string; _rawQty?: string; _rawMin?: string }>(EMPTY_ING);
  const [isEditing, setIsEditing] = useState(false);

  // Physical count mode
  const [showPhysicalCount, setShowPhysicalCount] = useState(false);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({});
  const [countNotes, setCountNotes] = useState<Record<string, string>>({});
  const [savedCount, setSavedCount] = useState<PhysicalInventoryCount | null>(() => {
    const today = new Date().toISOString().split("T")[0];
    return PhysicalInventory.getByDate(today) ?? null;
  });

  const canEdit = user && ["admin", "manager", "storekeeper"].includes(user.role);
  const canCount = user && ["admin", "manager"].includes(user.role);
  const lowStock = getLowStock();

  const filtered = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || i.category === catFilter;
    const matchLow = !showLowOnly || i.currentQuantity <= i.minQuantity;
    return matchSearch && matchCat && matchLow;
  });

  const openNew = () => { setEditingIng({ ...EMPTY_ING }); setIsEditing(false); setShowForm(true); };
  const openEdit = (i: Ingredient) => {
    setEditingIng({ ...i, _rawCost: String(i.costPerUnit), _rawQty: String(i.currentQuantity), _rawMin: String(i.minQuantity) });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!editingIng.name?.trim()) { toast.error("Name is required"); return; }
    if (!editingIng.unit) { toast.error("Unit is required"); return; }
    const item: Ingredient = {
      id: isEditing ? editingIng.id as string : generateId(),
      name: editingIng.name!,
      unit: editingIng.unit!,
      costPerUnit: editingIng.costPerUnit || 0,
      currentQuantity: editingIng.currentQuantity || 0,
      minQuantity: editingIng.minQuantity || 0,
      category: editingIng.category || "Other",
      lastUpdated: new Date().toISOString(),
    };
    upsert(item);
    toast.success(`Ingredient "${item.name}" ${isEditing ? "updated" : "added"}`);
    setShowForm(false);
  };

  const handleSavePhysicalCount = () => {
    const today = new Date().toISOString().split("T")[0];
    const entries: PhysicalCountEntry[] = ingredients.map(ing => {
      const rawPhysical = physicalCounts[ing.id];
      const physicalQty = rawPhysical !== undefined && rawPhysical !== "" ? parseFloat(rawPhysical) : ing.currentQuantity;
      const variance = physicalQty - ing.currentQuantity;
      return {
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.unit,
        theoreticalQty: ing.currentQuantity,
        physicalQty: isNaN(physicalQty) ? ing.currentQuantity : physicalQty,
        variance: isNaN(physicalQty) ? 0 : variance,
        varianceCost: Math.abs(isNaN(physicalQty) ? 0 : variance) * ing.costPerUnit,
        costPerUnit: ing.costPerUnit,
        notes: countNotes[ing.id] ?? "",
      };
    });

    const shortageCount = entries.filter(e => e.variance < 0).length;
    const overageCount = entries.filter(e => e.variance > 0).length;
    const totalVarianceCost = entries.reduce((s, e) => s + e.varianceCost, 0);

    const count: PhysicalInventoryCount = {
      id: savedCount?.id ?? generateId(),
      date: today,
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
    toast.success(`Physical count saved — ${shortageCount} shortage(s), ${overageCount} overage(s), total variance: ${formatCurrency(totalVarianceCost, settings.currencySymbol)}`);
  };

  const stockColor = (item: Ingredient) => {
    if (item.currentQuantity === 0) return "text-red-400";
    if (item.currentQuantity <= item.minQuantity) return "text-amber-400";
    return "text-green-400";
  };

  const stockBg = (item: Ingredient) => {
    if (item.currentQuantity === 0) return "bg-red-500/10 border-red-500/30";
    if (item.currentQuantity <= item.minQuantity) return "bg-amber-500/10 border-amber-500/30";
    return "";
  };

  const totalValue = ingredients.reduce((s, i) => s + i.currentQuantity * i.costPerUnit, 0);
  const today = new Date().toISOString().split("T")[0];

  return (
    <AppLayout>
      {/* Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Items", value: ingredients.length.toString() },
          { label: "Low Stock", value: lowStock.length.toString(), urgent: lowStock.length > 0 },
          { label: "Out of Stock", value: ingredients.filter(i => i.currentQuantity === 0).length.toString(), urgent: true },
          { label: "Inventory Value", value: formatCurrency(totalValue, settings.currencySymbol) },
        ].map(s => (
          <div key={s.label} className={cn("stat-card text-center", s.urgent && s.value !== "0" && "border-amber-500/30")}>
            <p className={cn("text-xl font-bold font-mono", s.urgent && s.value !== "0" ? "text-amber-400" : "text-foreground")}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Today's physical count banner */}
      {savedCount && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <ClipboardCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-300">Physical count completed today by {savedCount.countedByName}</p>
            <p className="text-[10px] text-blue-400/70 mt-0.5">
              {savedCount.shortageCount} shortages · {savedCount.overageCount} overages ·
              Total variance cost: {formatCurrency(savedCount.totalVarianceCost, settings.currencySymbol)}
            </p>
          </div>
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
            }} className="text-[10px] text-blue-400 underline shrink-0">Re-count</button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showLowOnly} onChange={e => setShowLowOnly(e.target.checked)} className="rounded" />
          Low stock only
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              const pcData = savedCount?.entries.map(e => ({ ingredientName: e.ingredientName, theoreticalQty: e.theoreticalQty, physicalQty: e.physicalQty, variance: e.variance, varianceCost: e.varianceCost }));
              exportInventoryPDF(ingredients.map(i => ({ name: i.name, category: i.category, unit: i.unit, costPerUnit: i.costPerUnit, currentQuantity: i.currentQuantity, minQuantity: i.minQuantity, lastUpdated: i.lastUpdated })), settings.hotelName, user?.name ?? 'System', pcData);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {savedCount && canCount && (
            <button
              onClick={() => exportPhysicalCountPDF({ date: new Date().toISOString().split('T')[0], countedByName: savedCount.countedByName, entries: savedCount.entries, totalVarianceCost: savedCount.totalVarianceCost, shortageCount: savedCount.shortageCount, overageCount: savedCount.overageCount }, settings.hotelName, user?.name ?? 'System', 'Main Store')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 text-xs hover:bg-blue-600/30 border border-blue-500/30">
              <Download className="w-3.5 h-3.5" /> Count PDF
            </button>
          )}
          {canCount && (
            <button onClick={() => { setPhysicalCounts({}); setCountNotes({}); setShowPhysicalCount(true); }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
              <ClipboardCheck className="w-3.5 h-3.5" /> Physical Count
            </button>
          )}
          {canEdit && (
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Table — with physical count variance if today's count exists */}
      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Item Name", "Category", "Unit", "Cost/Unit", "Min Stock", "Theoretical Stock", ...(savedCount ? ["Physical Count", "Variance", "Var. Cost"] : []), "Status", ...(canEdit ? ["Actions"] : [])].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const countEntry = savedCount?.entries.find(e => e.ingredientId === item.id);
              const variance = countEntry ? countEntry.variance : null;
              const varCost = countEntry ? countEntry.varianceCost : null;
              return (
                <tr key={item.id} className={cn("table-row-hover border-b border-border/50 last:border-0", stockBg(item))}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.currentQuantity <= item.minQuantity && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <span className="text-xs font-medium text-foreground">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.unit}</td>
                  <td className="px-4 py-3 text-xs font-mono text-foreground">{formatCurrency(item.costPerUnit, "ETB")}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.minQuantity} {item.unit}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-bold font-mono", stockColor(item))}>{item.currentQuantity} {item.unit}</span>
                  </td>
                  {savedCount && (
                    <>
                      <td className="px-4 py-3">
                        {countEntry ? (
                          <span className="text-xs font-bold font-mono text-foreground">{countEntry.physicalQty} {item.unit}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {variance !== null ? (
                          <span className={cn("text-xs font-bold font-mono",
                            variance < 0 ? "text-red-400" : variance > 0 ? "text-amber-400" : "text-green-400"
                          )}>
                            {variance > 0 ? "+" : ""}{variance.toFixed(3)}
                            {variance < 0 && <span className="ml-1 text-[9px]">▼ shortage</span>}
                            {variance > 0 && <span className="ml-1 text-[9px]">▲ overage</span>}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {varCost !== null && varCost > 0 ? (
                          <span className="text-xs font-mono text-red-400">{formatCurrency(varCost, "ETB")}</span>
                        ) : <span className="text-xs text-green-400">—</span>}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    {item.currentQuantity === 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">OUT</span>
                    ) : item.currentQuantity <= item.minQuantity ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">LOW</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">OK</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { if (confirm(`Delete ${item.name}?`)) { remove(item.id); toast.success("Deleted"); } }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No inventory items found</p>
          </div>
        )}
      </div>

      {/* Physical Count Modal */}
      {showPhysicalCount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Morning Physical Inventory Count</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  F&B Manager manually counts each item. Variance = Physical - Theoretical.
                  Shortage = negative, Overage = positive.
                </p>
              </div>
              <button onClick={() => setShowPhysicalCount(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border bg-muted/30">
                    {["Ingredient", "Category", "Theoretical Stock", "Physical Count", "Variance", "Variance Cost", "Notes"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(ing => {
                    const raw = physicalCounts[ing.id];
                    const physical = raw !== undefined && raw !== "" ? parseFloat(raw) : NaN;
                    const variance = !isNaN(physical) ? physical - ing.currentQuantity : null;
                    const varCost = variance !== null ? Math.abs(variance) * ing.costPerUnit : null;
                    return (
                      <tr key={ing.id} className={cn("border-b border-border/50 last:border-0",
                        variance !== null && variance < 0 ? "bg-red-500/5" :
                        variance !== null && variance > 0 ? "bg-amber-500/5" : ""
                      )}>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-foreground">{ing.name}</p>
                          <p className="text-[10px] text-muted-foreground">{ing.unit}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{ing.category}</td>
                        <td className="px-4 py-2.5 text-xs font-bold font-mono text-blue-400">{ing.currentQuantity} {ing.unit}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text" inputMode="decimal"
                            value={physicalCounts[ing.id] ?? ""}
                            onChange={e => setPhysicalCounts(p => ({ ...p, [ing.id]: e.target.value }))}
                            placeholder={String(ing.currentQuantity)}
                            className="w-24 px-2 py-1 text-xs font-mono rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                            value={countNotes[ing.id] ?? ""}
                            onChange={e => setCountNotes(p => ({ ...p, [ing.id]: e.target.value }))}
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

            {/* Summary footer */}
            <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-6 text-xs">
              {(() => {
                let shortages = 0, overages = 0, totalVarCost = 0;
                ingredients.forEach(ing => {
                  const raw = physicalCounts[ing.id];
                  if (raw === undefined || raw === "") return;
                  const physical = parseFloat(raw);
                  if (isNaN(physical)) return;
                  const v = physical - ing.currentQuantity;
                  if (v < 0) shortages++;
                  if (v > 0) overages++;
                  totalVarCost += Math.abs(v) * ing.costPerUnit;
                });
                return (
                  <>
                    <span className="text-red-400 font-semibold">{shortages} shortage(s)</span>
                    <span className="text-amber-400 font-semibold">{overages} overage(s)</span>
                    <span className="text-foreground">Total variance cost: <strong className="text-red-400">{formatCurrency(totalVarCost, "ETB")}</strong></span>
                  </>
                );
              })()}
            </div>

            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowPhysicalCount(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSavePhysicalCount} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
                <ClipboardCheck className="w-4 h-4 inline mr-2" />Save Physical Count
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{isEditing ? "Edit Ingredient" : "Add Ingredient"}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Name *</label>
                <input value={editingIng.name || ""} onChange={e => setEditingIng(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., Beef (Minced)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                  <select value={editingIng.category || "Other"} onChange={e => setEditingIng(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Unit</label>
                  <select value={editingIng.unit || "kg"} onChange={e => setEditingIng(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Cost/Unit (ETB)</label>
                  <input type="text" inputMode="decimal"
                    value={editingIng._rawCost !== undefined ? editingIng._rawCost : (editingIng.costPerUnit === 0 ? "" : String(editingIng.costPerUnit ?? ""))}
                    onChange={e => { const raw = e.target.value; const parsed = parseFloat(raw); setEditingIng(p => ({ ...p, _rawCost: raw, costPerUnit: isNaN(parsed) ? 0 : parsed })); }}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Current Qty</label>
                  <input type="text" inputMode="decimal"
                    value={editingIng._rawQty !== undefined ? editingIng._rawQty : (editingIng.currentQuantity === 0 ? "" : String(editingIng.currentQuantity ?? ""))}
                    onChange={e => { const raw = e.target.value; const parsed = parseFloat(raw); setEditingIng(p => ({ ...p, _rawQty: raw, currentQuantity: isNaN(parsed) ? 0 : parsed })); }}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Min Stock</label>
                  <input type="text" inputMode="decimal"
                    value={editingIng._rawMin !== undefined ? editingIng._rawMin : (editingIng.minQuantity === 0 ? "" : String(editingIng.minQuantity ?? ""))}
                    onChange={e => { const raw = e.target.value; const parsed = parseFloat(raw); setEditingIng(p => ({ ...p, _rawMin: raw, minQuantity: isNaN(parsed) ? 0 : parsed })); }}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">{isEditing ? "Update" : "Add Item"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
