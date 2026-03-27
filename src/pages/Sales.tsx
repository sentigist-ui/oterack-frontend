import { useState } from "react";
import { Plus, Trash2, ShoppingCart, TrendingUp, Download } from "lucide-react";
import { exportSalesPDF } from "@/lib/pdfExport";
import AppLayout from "@/components/layout/AppLayout";
import { useSales } from "@/hooks/useSales";
import { useRecipes } from "@/hooks/useRecipes";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, generateId, getTodayISO, cn } from "@/lib/utils";
import type { Sale, SaleItem } from "@/types";
import { toast } from "sonner";
import { Settings } from "@/lib/storage";

export default function Sales() {
  const { sales, addSale, todayRevenue, todayCost, todayProfit } = useSales();
  const { recipes } = useRecipes();
  const { user } = useAuth();
  const settings = Settings.get();

  const [showForm, setShowForm] = useState(false);
  const [saleDate, setSaleDate] = useState(getTodayISO());
  const [shift, setShift] = useState<"Morning" | "Afternoon" | "Evening" | "Night">("Evening");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Partial<SaleItem & { recipeId: string }>[]>([{ recipeId: "", quantity: 1 }]);

  const canAdd = user && ["admin", "manager", "cashier"].includes(user.role);

  const addItem = () => setItems(p => [...p, { recipeId: "", quantity: 1 }]);
  const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: string, value: string | number) => {
    setItems(prev => {
      const rows = [...prev];
      if (field === "recipeId") {
        const recipe = recipes.find(r => r.id === value);
        rows[idx] = { ...rows[idx], recipeId: value as string, recipeName: recipe?.name, unitPrice: recipe?.sellingPrice, category: recipe?.category };
      } else {
        rows[idx] = { ...rows[idx], [field]: value };
      }
      return rows;
    });
  };

  const validItems = items.filter(i => i.recipeId && (i.quantity || 0) > 0);
  const previewTotal = validItems.reduce((s, i) => {
    const recipe = recipes.find(r => r.id === i.recipeId);
    return s + (recipe?.sellingPrice || 0) * (i.quantity || 0);
  }, 0);

  const handleSave = () => {
    if (validItems.length === 0) { toast.error("Add at least one sale item"); return; }
    const saleItems: SaleItem[] = validItems.map(i => {
      const recipe = recipes.find(r => r.id === i.recipeId)!;
      return {
        recipeId: recipe.id,
        recipeName: recipe.name,
        quantity: i.quantity || 0,
        unitPrice: recipe.sellingPrice,
        totalPrice: recipe.sellingPrice * (i.quantity || 0),
        category: recipe.category,
      };
    });
    const totalRevenue = saleItems.reduce((s, i) => s + i.totalPrice, 0);
    const totalCost = saleItems.reduce((s, i) => {
      const recipe = recipes.find(r => r.id === i.recipeId)!;
      return s + recipe.totalCost * i.quantity;
    }, 0);
    const grossProfit = totalRevenue - totalCost;
    const sale: Sale = {
      id: generateId(),
      date: saleDate,
      items: saleItems,
      totalRevenue,
      totalCost,
      grossProfit,
      grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      recordedBy: user!.name,
      shift,
      notes,
    };
    addSale(sale);
    toast.success(`Sale recorded — ${formatCurrency(totalRevenue, "ETB")}`);
    setShowForm(false);
    setItems([{ recipeId: "", quantity: 1 }]);
    setNotes("");
  };

  const todayFoodCostPct = todayRevenue > 0 ? (todayCost / todayRevenue) * 100 : 0;

  return (
    <AppLayout>
      {/* Today summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Today's Revenue", value: formatCurrency(todayRevenue, settings.currencySymbol), color: "text-primary" },
          { label: "Today's Cost", value: formatCurrency(todayCost, settings.currencySymbol), color: "text-foreground" },
          { label: "Today's Profit", value: formatCurrency(todayProfit, settings.currencySymbol), color: todayProfit >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Food Cost %", value: `${todayFoodCostPct.toFixed(1)}%`, color: todayFoodCostPct > settings.targetFoodCostPercent ? "text-amber-400" : "text-green-400" },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Sales Records</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportSalesPDF(sales.map(s => ({ date: s.date, shift: s.shift, recordedBy: s.recordedBy, totalRevenue: s.totalRevenue, totalCost: s.totalCost, grossProfit: s.grossProfit, grossMargin: s.grossMargin, items: s.items.map(i => ({ recipeName: i.recipeName, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, category: i.category })) })), settings.hotelName, user?.name ?? 'System')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canAdd && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Record Sale
            </button>
          )}
        </div>
      </div>

      {/* Sales Table */}
      <div className="space-y-3">
        {sales.slice(0, 20).map(sale => (
          <div key={sale.id} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{formatDate(sale.date)}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{sale.shift}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Recorded by {sale.recordedBy}</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-bold font-mono text-accent">{formatCurrency(sale.totalRevenue, "ETB")}</p>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                </div>
                <div>
                  <p className="text-xs font-mono text-foreground">{formatCurrency(sale.grossProfit, "ETB")}</p>
                  <p className="text-[10px] text-muted-foreground">Profit</p>
                </div>
                <div>
                  <p className={cn("text-xs font-semibold", sale.grossMargin >= settings.targetFoodCostPercent ? "text-green-400" : "text-amber-400")}>
                    {(100 - sale.totalCost / sale.totalRevenue * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Margin</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {sale.items.map(item => (
                <div key={item.recipeId} className="flex items-center justify-between bg-muted/40 rounded-lg px-2.5 py-1.5">
                  <span className="text-[10px] text-foreground truncate">{item.recipeName}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground ml-1.5">×{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {sales.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No sales recorded yet</p>
            <p className="text-sm mt-1">Click 'Record Sale' to add your first sale entry</p>
          </div>
        )}
      </div>

      {/* Sale Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-semibold text-foreground">Record Daily Sale</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Sale Date *</label>
                  <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Shift</label>
                  <select value={shift} onChange={e => setShift(e.target.value as typeof shift)} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {["Morning", "Afternoon", "Evening", "Night"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Sale Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-foreground">Sale Items *</label>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const recipe = recipes.find(r => r.id === item.recipeId);
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <select value={item.recipeId || ""} onChange={e => updateItem(idx, "recipeId", e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="">Select recipe</option>
                            {recipes.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name} ({r.category})</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="1" value={item.quantity || ""} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 0)} placeholder="Qty" className="w-full px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-xs font-mono text-accent">
                            {recipe ? formatCurrency(recipe.sellingPrice * (item.quantity || 0), "ETB") : "—"}
                          </span>
                        </div>
                        <div className="col-span-1 text-right">
                          <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Optional notes about this sale session" />
              </div>

              {previewTotal > 0 && (
                <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Total Sale Amount</span>
                  <span className="text-xl font-bold text-primary font-mono">{formatCurrency(previewTotal, "ETB")}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
                <span className="flex items-center justify-center gap-2"><TrendingUp className="w-4 h-4" /> Save Sale</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
