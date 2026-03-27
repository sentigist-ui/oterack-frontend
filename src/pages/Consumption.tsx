import { useState } from "react";
import { Plus, Search, CheckCircle, Clock, Trash2, FlaskConical, AlertTriangle, Download } from "lucide-react";
import { exportConsumptionPDF } from "@/lib/pdfExport";
import AppLayout from "@/components/layout/AppLayout";
import { useConsumption } from "@/hooks/useConsumption";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDateTime, generateId, getTodayISO, cn } from "@/lib/utils";
import type { ConsumptionRecord, ConsumptionCategory } from "@/types";
import { toast } from "sonner";

const CATEGORIES: ConsumptionCategory[] = ["Kitchen", "Bar", "Events", "Staff Meal", "Wastage", "Testing", "Other"];
const SHIFTS = ["Morning", "Afternoon", "Evening", "Night"] as const;

const CATEGORY_COLORS: Record<ConsumptionCategory, string> = {
  Kitchen:    "bg-amber-500/15 text-amber-400",
  Bar:        "bg-blue-500/15 text-blue-400",
  Events:     "bg-purple-500/15 text-purple-400",
  "Staff Meal": "bg-green-500/15 text-green-400",
  Wastage:    "bg-red-500/15 text-red-400",
  Testing:    "bg-cyan-500/15 text-cyan-400",
  Other:      "bg-muted text-muted-foreground",
};

const EMPTY_FORM = {
  ingredientId: "",
  quantity: "",
  category: "Kitchen" as ConsumptionCategory,
  shift: "Morning" as typeof SHIFTS[number],
  notes: "",
  date: getTodayISO(),
};

export default function Consumption() {
  const { records, addRecord, approve, remove, getTotalActualConsumption } = useConsumption();
  const { ingredients } = useInventory();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<"All" | ConsumptionCategory>("All");
  const [dateFilter, setDateFilter] = useState(getTodayISO());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const canApprove = user && ["admin", "manager"].includes(user.role);
  const canAdd = user && ["admin", "manager", "kitchen", "storekeeper"].includes(user.role);

  const selectedIng = ingredients.find(i => i.id === form.ingredientId);

  const filtered = records.filter(r => {
    const matchDate = !dateFilter || r.date === dateFilter;
    const matchCat = catFilter === "All" || r.category === catFilter;
    const matchSearch =
      r.ingredientName.toLowerCase().includes(search.toLowerCase()) ||
      r.recordedByName.toLowerCase().includes(search.toLowerCase()) ||
      r.notes.toLowerCase().includes(search.toLowerCase());
    return matchDate && matchCat && matchSearch;
  });

  const filteredTotal = filtered.reduce((s, r) => s + r.totalCost, 0);
  const filteredQty = (ingredientId: string) =>
    filtered.filter(r => r.ingredientId === ingredientId).reduce((s, r) => s + r.quantity, 0);

  const handleSubmit = () => {
    if (!form.ingredientId) { toast.error("Select an ingredient"); return; }
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) { toast.error("Quantity must be greater than 0"); return; }
    if (!selectedIng) return;

    const isKitchenChief = user!.role === "kitchen";
    const autoApprove = canApprove; // Admin/Manager can auto-approve their own consumption

    const record: Omit<ConsumptionRecord, "id"> = {
      date: form.date,
      ingredientId: selectedIng.id,
      ingredientName: selectedIng.name,
      unit: selectedIng.unit,
      quantity: qty,
      unitCost: selectedIng.costPerUnit,
      totalCost: qty * selectedIng.costPerUnit,
      category: form.category,
      notes: form.notes,
      recordedBy: user!.id,
      recordedByName: user!.name,
      shift: form.shift,
      approved: autoApprove,
      approvedBy: autoApprove ? user!.name : undefined,
    };

    addRecord(record);

    if (isKitchenChief) {
      toast.success(`Consumption recorded — sent to F&B Manager for approval`);
    } else if (autoApprove) {
      toast.success(`Consumption of ${selectedIng.name} recorded and approved`);
    } else {
      toast.success(`Consumption of ${selectedIng.name} recorded — pending approval`);
    }

    setShowForm(false);
    setForm({ ...EMPTY_FORM });
  };

  const handleApprove = (r: ConsumptionRecord) => {
    approve(r.id, user!.name);
    toast.success(`Approved consumption record for ${r.ingredientName}`);
  };

  const handleDelete = (r: ConsumptionRecord) => {
    if (!confirm(`Delete consumption record for ${r.ingredientName}?`)) return;
    remove(r.id);
    toast.success("Record deleted");
  };

  const pendingCount = records.filter(r => !r.approved).length;

  return (
    <AppLayout>
      {/* Header metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{filtered.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Records (Today)</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-accent">{formatCurrency(filteredTotal, "ETB")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Cost</p>
        </div>
        <div className={cn("stat-card text-center", pendingCount > 0 && "border-amber-500/30")}>
          <p className={cn("text-xl font-bold font-mono", pendingCount > 0 ? "text-amber-400" : "text-foreground")}>{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending Approval</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{records.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Records</p>
        </div>
      </div>

      {/* Pending approval banner */}
      {pendingCount > 0 && canApprove && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs font-medium text-amber-300">{pendingCount} consumption record{pendingCount > 1 ? "s" : ""} pending your approval</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["All", ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat as "All" | ConsumptionCategory)}
              className={cn("px-2.5 py-1.5 text-[10px] font-semibold transition-colors whitespace-nowrap",
                catFilter === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportConsumptionPDF(records.map(r => ({ date: r.date, ingredientName: r.ingredientName, unit: r.unit, quantity: r.quantity, unitCost: r.unitCost, totalCost: r.totalCost, category: r.category, shift: r.shift, recordedByName: r.recordedByName, approved: r.approved, approvedBy: r.approvedBy, notes: r.notes })), 'Grar Hotel', user?.name ?? 'System')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canAdd && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Record Consumption
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Date", "Ingredient", "Quantity", "Category", "Shift", "Cost", "Recorded By", "Status", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className={cn("table-row-hover border-b border-border/50 last:border-0", !r.approved && "bg-amber-500/5")}>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{r.date}</td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-foreground">{r.ingredientName}</p>
                  {r.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{r.notes}</p>}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-foreground">{r.quantity} {r.unit}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", CATEGORY_COLORS[r.category])}>
                    {r.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.shift}</td>
                <td className="px-4 py-3 text-xs font-mono text-accent">{formatCurrency(r.totalCost, "ETB")}</td>
                <td className="px-4 py-3">
                  <p className="text-xs text-foreground">{r.recordedByName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(r.date + "T00:00:00Z").split(",")[0]}</p>
                </td>
                <td className="px-4 py-3">
                  {r.approved ? (
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" /> Approved
                      </span>
                      {r.approvedBy && <p className="text-[10px] text-muted-foreground mt-0.5">by {r.approvedBy}</p>}
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 flex items-center gap-1 w-fit">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {canApprove && !r.approved && (
                      <button onClick={() => handleApprove(r)} className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 font-medium">
                        Approve
                      </button>
                    )}
                    {(canApprove || r.recordedBy === user?.id) && (
                      <button onClick={() => handleDelete(r)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-14 text-muted-foreground">
            <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No consumption records</p>
            <p className="text-xs mt-1">Click "Record Consumption" to log actual ingredient usage</p>
          </div>
        )}
      </div>

      {/* Record Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Record Actual Consumption</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>
            <div className="p-5 space-y-3">
              {/* Info banner */}
              <div className="flex items-start gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
                <FlaskConical className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-primary/80 leading-relaxed">
                  Record actual ingredient usage. This is compared against <strong>sales-based expected consumption</strong> to detect theft and wastage.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Ingredient *</label>
                <select
                  value={form.ingredientId}
                  onChange={e => setForm(p => ({ ...p, ingredientId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit}) — Stock: {i.currentQuantity} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Quantity Used *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.quantity}
                      onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                      placeholder={`e.g., 2.5 ${selectedIng?.unit || ""}`}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                    />
                    {selectedIng && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{selectedIng.unit}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Shift</label>
                  <select
                    value={form.shift}
                    onChange={e => setForm(p => ({ ...p, shift: e.target.value as typeof SHIFTS[number] }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Category *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, category: cat }))}
                      className={cn(
                        "py-1.5 rounded-lg text-[11px] font-semibold border transition-all",
                        form.category === cat
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes / Reason</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g., Used for Kitfo preparation, staff meal, event service..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Live cost preview */}
              {selectedIng && form.quantity && parseFloat(form.quantity) > 0 && (
                <div className="rounded-lg bg-muted/50 border border-border p-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-foreground font-mono">{parseFloat(form.quantity).toFixed(3)} {selectedIng.unit}</p>
                    <p className="text-[10px] text-muted-foreground">Quantity</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground font-mono">{formatCurrency(selectedIng.costPerUnit, "ETB")}</p>
                    <p className="text-[10px] text-muted-foreground">Unit Cost</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-accent font-mono">{formatCurrency(parseFloat(form.quantity) * selectedIng.costPerUnit, "ETB")}</p>
                    <p className="text-[10px] text-muted-foreground">Total Cost</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSubmit} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Record Consumption</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
