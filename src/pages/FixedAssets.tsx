import { useState } from "react";
import { Plus, Search, Edit2, Trash2, Package, Calendar, Download, ClipboardCheck, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useFixedAssets } from "@/hooks/useFixedAssets";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, generateId, cn } from "@/lib/utils";
import type { FixedAsset, FixedAssetCategory, MonthlyAssetCount, MonthlyAssetEntry } from "@/types";
import { toast } from "sonner";
import { Settings } from "@/lib/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const CATEGORIES: FixedAssetCategory[] = ["Furniture", "Equipment", "Electronics", "Kitchen Appliances", "Bar Appliances", "HVAC", "Plumbing", "Other"];
const LOCATIONS = ["Kitchen", "Bar", "Main Store", "Office", "Dining Area", "Reception", "Storage"];
const CONDITIONS = ["excellent", "good", "fair", "poor"] as const;

const EMPTY_ASSET: Partial<FixedAsset> = {
  name: "", category: "Equipment", purchaseDate: "", purchasePrice: 0, supplier: "",
  location: "Kitchen", serialNumber: "", model: "", condition: "good",
  depreciationRate: 10, usefulLife: 10, currentValue: 0, status: "active", notes: "",
};

export default function FixedAssetsPage() {
  const { assets, monthlyCounts, upsertAsset, deleteAsset, upsertMonthlyCount, totalValue, totalDepreciation, activeAssets } = useFixedAssets();
  const { user } = useAuth();
  const settings = Settings.get();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<FixedAssetCategory | "All">("All");
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<FixedAsset>>(EMPTY_ASSET);
  const [isEditing, setIsEditing] = useState(false);

  // Monthly count
  const [showMonthlyCount, setShowMonthlyCount] = useState(false);
  const [monthlyCountDate, setMonthlyCountDate] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [physicallyVerified, setPhysicallyVerified] = useState<Record<string, boolean>>({});
  const [countNotes, setCountNotes] = useState<Record<string, string>>({});

  const canEdit = user && ["admin", "finance", "owner"].includes(user.role);

  const filtered = assets.filter(a => {
    const matchCat = catFilter === "All" || a.category === catFilter;
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.location.toLowerCase().includes(search.toLowerCase()) ||
      a.serialNumber?.toLowerCase().includes(search.toLowerCase()) || false;
    return matchCat && matchSearch;
  });

  const openNew = () => {
    setEditingAsset({ ...EMPTY_ASSET, purchaseDate: new Date().toISOString().split("T")[0] });
    setIsEditing(false);
    setShowForm(true);
  };

  const openEdit = (a: FixedAsset) => {
    setEditingAsset({ ...a });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!editingAsset.name?.trim()) { toast.error("Asset name required"); return; }
    if (!editingAsset.purchaseDate) { toast.error("Purchase date required"); return; }

    const asset: FixedAsset = {
      id: isEditing ? editingAsset.id as string : generateId(),
      name: editingAsset.name!,
      category: editingAsset.category || "Equipment",
      purchaseDate: editingAsset.purchaseDate!,
      purchasePrice: editingAsset.purchasePrice || 0,
      supplier: editingAsset.supplier || "",
      location: editingAsset.location || "Kitchen",
      serialNumber: editingAsset.serialNumber,
      model: editingAsset.model,
      condition: editingAsset.condition || "good",
      depreciationRate: editingAsset.depreciationRate || 0,
      usefulLife: editingAsset.usefulLife || 0,
      currentValue: editingAsset.currentValue || editingAsset.purchasePrice || 0,
      status: editingAsset.status || "active",
      notes: editingAsset.notes,
      createdBy: isEditing ? editingAsset.createdBy! : user!.name,
      createdAt: isEditing ? editingAsset.createdAt! : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    upsertAsset(asset);
    toast.success(`Asset "${asset.name}" ${isEditing ? "updated" : "added"}`);
    setShowForm(false);
  };

  const handleDelete = (a: FixedAsset) => {
    if (!confirm(`Delete asset "${a.name}"?`)) return;
    deleteAsset(a.id);
    toast.success("Asset deleted");
  };

  const handleSaveMonthlyCount = () => {
    const existing = monthlyCounts.find(c => c.month === monthlyCountDate);
    const previousMonth = new Date(monthlyCountDate + "-01");
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const prevMonthKey = previousMonth.toISOString().slice(0, 7);
    const prevCount = monthlyCounts.find(c => c.month === prevMonthKey);

    const entries: MonthlyAssetEntry[] = activeAssets.map(a => {
      const verified = physicallyVerified[a.id] ?? false;
      const prevExisted = prevCount ? prevCount.entries.some(e => e.assetId === a.id) : true;
      const depreciation = a.purchasePrice - a.currentValue;

      return {
        assetId: a.id,
        assetName: a.name,
        category: a.category,
        location: a.location,
        purchaseDate: a.purchaseDate,
        purchasePrice: a.purchasePrice,
        currentValue: a.currentValue,
        depreciation,
        condition: a.condition,
        physicallyVerified: verified,
        notes: countNotes[a.id] ?? "",
        previouslyExisted: prevExisted,
      };
    });

    const missingFromPrev = prevCount
      ? prevCount.entries.filter(pe => !entries.some(e => e.assetId === pe.assetId)).length
      : 0;
    const newAssets = entries.filter(e => !e.previouslyExisted).length;

    const count: MonthlyAssetCount = {
      id: existing?.id ?? generateId(),
      month: monthlyCountDate,
      countDate: new Date().toISOString().split("T")[0],
      countedBy: user!.id,
      countedByName: user!.name,
      entries,
      totalAssets: entries.length,
      missingAssets: missingFromPrev,
      newAssets,
      totalValue: entries.reduce((s, e) => s + e.currentValue, 0),
      totalDepreciation: entries.reduce((s, e) => s + e.depreciation, 0),
      status: "submitted",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    upsertMonthlyCount(count);
    setShowMonthlyCount(false);
    toast.success(`Monthly asset count saved for ${monthlyCountDate} — ${entries.filter(e => e.physicallyVerified).length} verified, ${missingFromPrev} missing`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Fixed Assets Report", 14, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()} by ${user?.name}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Asset Name", "Category", "Location", "Purchase Date", "Purchase Price", "Current Value", "Depreciation", "Condition", "Status"]],
      body: filtered.map(a => [
        a.name, a.category, a.location, a.purchaseDate,
        formatCurrency(a.purchasePrice, "ETB"),
        formatCurrency(a.currentValue, "ETB"),
        formatCurrency(a.purchasePrice - a.currentValue, "ETB"),
        a.condition, a.status,
      ]),
      styles: { fontSize: 8 },
    });
    doc.save(`FixedAssets_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exported");
  };

  const latestCount = monthlyCounts[0];

  return (
    <AppLayout>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{activeAssets.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active Assets</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-accent">{formatCurrency(totalValue, settings.currencySymbol)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Value</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-red-400">{formatCurrency(totalDepreciation, settings.currencySymbol)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Depreciation</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{monthlyCounts.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly Counts</p>
        </div>
      </div>

      {latestCount && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <ClipboardCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-300">Latest monthly count: {latestCount.month} by {latestCount.countedByName}</p>
            <p className="text-[10px] text-blue-400/70 mt-0.5">
              {latestCount.totalAssets} assets · {latestCount.missingAssets} missing · {latestCount.newAssets} new
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value as FixedAssetCategory | "All")}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canEdit && (
            <>
              <button onClick={() => { setPhysicallyVerified({}); setCountNotes({}); setShowMonthlyCount(true); }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">
                <Calendar className="w-3.5 h-3.5" /> Monthly Count
              </button>
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
                <Plus className="w-3.5 h-3.5" /> Add Asset
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Asset Name", "Category", "Location", "Purchase Date", "Purchase Price", "Current Value", "Depreciation", "Condition", "Status", ...(canEdit ? ["Actions"] : [])].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="table-row-hover border-b border-border/50 last:border-0">
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-foreground">{a.name}</p>
                  {a.serialNumber && <p className="text-[10px] text-muted-foreground">S/N: {a.serialNumber}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{a.category}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{a.location}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{a.purchaseDate}</td>
                <td className="px-4 py-3 text-xs font-mono text-foreground">{formatCurrency(a.purchasePrice, "ETB")}</td>
                <td className="px-4 py-3 text-xs font-bold font-mono text-accent">{formatCurrency(a.currentValue, "ETB")}</td>
                <td className="px-4 py-3 text-xs font-mono text-red-400">{formatCurrency(a.purchasePrice - a.currentValue, "ETB")}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                    a.condition === "excellent" ? "bg-green-500/15 text-green-400" :
                    a.condition === "good" ? "bg-blue-500/15 text-blue-400" :
                    a.condition === "fair" ? "bg-amber-500/15 text-amber-400" :
                    "bg-red-500/15 text-red-400"
                  )}>{a.condition.toUpperCase()}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                    a.status === "active" ? "bg-green-500/15 text-green-400" :
                    a.status === "maintenance" ? "bg-amber-500/15 text-amber-400" :
                    "bg-muted text-muted-foreground"
                  )}>{a.status.toUpperCase()}</span>
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(a)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-14 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No fixed assets found</p>
          </div>
        )}
      </div>

      {/* Monthly Count Modal */}
      {showMonthlyCount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Monthly Fixed Asset Count</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Verify physical presence and condition of all assets</p>
              </div>
              <button onClick={() => setShowMonthlyCount(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Count Month</label>
                <input type="month" value={monthlyCountDate} onChange={e => setMonthlyCountDate(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Asset", "Location", "Verified", "Notes"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeAssets.map(a => (
                      <tr key={a.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-foreground">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground">{a.category}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.location}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => setPhysicallyVerified(p => ({ ...p, [a.id]: !p[a.id] }))}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                              physicallyVerified[a.id]
                                ? "bg-green-500/20 border-green-500/40 text-green-400"
                                : "bg-muted/30 border-border text-muted-foreground"
                            )}>
                            {physicallyVerified[a.id] ? <ClipboardCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {physicallyVerified[a.id] ? "Verified" : "Not Verified"}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            value={countNotes[a.id] ?? ""}
                            onChange={e => setCountNotes(p => ({ ...p, [a.id]: e.target.value }))}
                            placeholder="Notes..."
                            className="w-full px-2 py-1 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowMonthlyCount(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSaveMonthlyCount} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Save Monthly Count</button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{isEditing ? "Edit Asset" : "Add Fixed Asset"}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Asset Name *</label>
                  <input value={editingAsset.name || ""} onChange={e => setEditingAsset(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., Commercial Oven" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                  <select value={editingAsset.category || "Equipment"} onChange={e => setEditingAsset(p => ({ ...p, category: e.target.value as FixedAssetCategory }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Purchase Date *</label>
                  <input type="date" value={editingAsset.purchaseDate || ""} onChange={e => setEditingAsset(p => ({ ...p, purchaseDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Purchase Price (ETB)</label>
                  <input type="number" value={editingAsset.purchasePrice || ""} onChange={e => setEditingAsset(p => ({ ...p, purchasePrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Current Value (ETB)</label>
                  <input type="number" value={editingAsset.currentValue || ""} onChange={e => setEditingAsset(p => ({ ...p, currentValue: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Location</label>
                  <select value={editingAsset.location || "Kitchen"} onChange={e => setEditingAsset(p => ({ ...p, location: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Condition</label>
                  <select value={editingAsset.condition || "good"} onChange={e => setEditingAsset(p => ({ ...p, condition: e.target.value as typeof CONDITIONS[number] }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Supplier</label>
                  <input value={editingAsset.supplier || ""} onChange={e => setEditingAsset(p => ({ ...p, supplier: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Serial Number</label>
                  <input value={editingAsset.serialNumber || ""} onChange={e => setEditingAsset(p => ({ ...p, serialNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <textarea value={editingAsset.notes || ""} onChange={e => setEditingAsset(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">{isEditing ? "Update" : "Add Asset"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
