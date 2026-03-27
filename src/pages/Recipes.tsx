import { useState } from "react";
import { Plus, Search, Edit2, Trash2, ChefHat, Tag, Clock, DollarSign, Percent } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useRecipes } from "@/hooks/useRecipes";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercent, generateId, getTodayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Recipe, RecipeIngredient } from "@/types";
import { toast } from "sonner";
import { Settings } from "@/lib/storage";

const EMPTY_RECIPE: Partial<Recipe> = {
  name: "", category: "Food", subCategory: "", portionSize: "", sellingPrice: 0,
  ingredients: [], preparationTime: 15, active: true,
};

export default function Recipes() {
  const { recipes, upsert, remove } = useRecipes();
  const { ingredients } = useInventory();
  const { user } = useAuth();
  const settings = Settings.get();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Food" | "Beverage">("All");
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe>>(EMPTY_RECIPE);
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = user && ["admin", "manager"].includes(user.role);

  const filtered = recipes.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || r.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openNew = () => { setEditingRecipe({ ...EMPTY_RECIPE, ingredients: [] }); setIsEditing(false); setShowForm(true); };
  const openEdit = (r: Recipe) => { setEditingRecipe({ ...r }); setIsEditing(true); setShowForm(true); };

  const addIngredientRow = () => {
    setEditingRecipe(prev => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), { ingredientId: "", ingredientName: "", quantity: 0, unit: "", unitCost: 0, totalCost: 0 }],
    }));
  };

  const updateIngredientRow = (idx: number, field: string, value: string | number) => {
    setEditingRecipe(prev => {
      const rows = [...(prev.ingredients || [])];
      if (field === "ingredientId") {
        const ing = ingredients.find(i => i.id === value);
        if (ing) {
          rows[idx] = { ...rows[idx], ingredientId: ing.id, ingredientName: ing.name, unit: ing.unit, unitCost: ing.costPerUnit, totalCost: (rows[idx].quantity || 0) * ing.costPerUnit };
        }
      } else if (field === "quantity") {
        // Allow free-form decimal typing: store raw string, parse to number for cost
        const raw = value as string;
        const qty = parseFloat(raw);
        const safeQty = isNaN(qty) ? 0 : qty;
        rows[idx] = { ...rows[idx], quantity: safeQty, totalCost: safeQty * (rows[idx].unitCost || 0), _rawQty: raw } as RecipeIngredient & { _rawQty: string };
      } else {
        rows[idx] = { ...rows[idx], [field]: value };
      }
      return { ...prev, ingredients: rows };
    });
  };

  const removeIngRow = (idx: number) => {
    setEditingRecipe(prev => ({ ...prev, ingredients: (prev.ingredients || []).filter((_, i) => i !== idx) }));
  };

  const totalCost = (editingRecipe.ingredients || []).reduce((s, r) => s + (r.totalCost || 0), 0);
  const foodCostPct = editingRecipe.sellingPrice && editingRecipe.sellingPrice > 0 ? (totalCost / editingRecipe.sellingPrice) * 100 : 0;
  const suggestedPrice = totalCost > 0 ? totalCost / (settings.targetFoodCostPercent / 100) : 0;

  const handleSave = () => {
    if (!editingRecipe.name?.trim()) { toast.error("Recipe name is required"); return; }
    if (!editingRecipe.sellingPrice || editingRecipe.sellingPrice <= 0) { toast.error("Selling price must be greater than 0"); return; }
    if ((editingRecipe.ingredients || []).length === 0) { toast.error("At least one ingredient is required"); return; }

    const recipe: Recipe = {
      id: isEditing ? (editingRecipe.id as string) : generateId(),
      name: editingRecipe.name!,
      category: editingRecipe.category as "Food" | "Beverage",
      subCategory: editingRecipe.subCategory || "",
      portionSize: editingRecipe.portionSize || "",
      sellingPrice: editingRecipe.sellingPrice!,
      ingredients: editingRecipe.ingredients as RecipeIngredient[],
      totalCost,
      foodCostPercent: foodCostPct,
      suggestedPrice,
      preparationTime: editingRecipe.preparationTime || 0,
      active: editingRecipe.active !== false,
      createdAt: isEditing ? (editingRecipe.createdAt as string) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsert(recipe);
    toast.success(`Recipe "${recipe.name}" ${isEditing ? "updated" : "created"}`);
    setShowForm(false);
  };

  const handleDelete = (r: Recipe) => {
    if (!confirm(`Delete recipe "${r.name}"?`)) return;
    remove(r.id);
    toast.success("Recipe deleted");
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(["All", "Food", "Beverage"] as const).map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", categoryFilter === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                {cat}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
          </div>
        </div>
        {canEdit && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Recipe
          </button>
        )}
      </div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(recipe => {
          const costColor = recipe.foodCostPercent > settings.targetFoodCostPercent + 10 ? "text-red-400" : recipe.foodCostPercent > settings.targetFoodCostPercent ? "text-amber-400" : "text-green-400";
          return (
            <div key={recipe.id} className="stat-card group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", recipe.category === "Food" ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400")}>
                      {recipe.category}
                    </span>
                    {!recipe.active && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm leading-tight">{recipe.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{recipe.subCategory} · {recipe.portionSize}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(recipe)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(recipe)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-xs font-bold text-accent">{formatCurrency(recipe.sellingPrice, "ETB")}</p>
                  <p className="text-[10px] text-muted-foreground">Selling</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-xs font-bold text-foreground">{formatCurrency(recipe.totalCost, "ETB")}</p>
                  <p className="text-[10px] text-muted-foreground">Cost</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className={cn("text-xs font-bold", costColor)}>{formatPercent(recipe.foodCostPercent)}</p>
                  <p className="text-[10px] text-muted-foreground">Cost %</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Ingredients ({recipe.ingredients.length})</p>
                <div className="space-y-1">
                  {recipe.ingredients.slice(0, 3).map(ri => (
                    <div key={ri.ingredientId} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{ri.ingredientName}</span>
                      <span className="font-mono text-foreground">{ri.quantity} {ri.unit}</span>
                    </div>
                  ))}
                  {recipe.ingredients.length > 3 && <p className="text-[10px] text-muted-foreground">+{recipe.ingredients.length - 3} more...</p>}
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{recipe.preparationTime} min</span>
                <span className="mx-1">·</span>
                <DollarSign className="w-3 h-3" />
                <span>Suggested: {formatCurrency(recipe.suggestedPrice, "ETB")}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No recipes found</p>
          <p className="text-sm mt-1">{canEdit ? "Click 'New Recipe' to add your first recipe" : "No recipes available"}</p>
        </div>
      )}

      {/* Recipe Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-semibold text-foreground">{isEditing ? "Edit Recipe" : "New Recipe"}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Recipe Name *</label>
                  <input value={editingRecipe.name || ""} onChange={e => setEditingRecipe(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., Kitfo Special" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category *</label>
                  <select value={editingRecipe.category || "Food"} onChange={e => setEditingRecipe(p => ({ ...p, category: e.target.value as "Food" | "Beverage" }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="Food">Food</option>
                    <option value="Beverage">Beverage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Sub-Category</label>
                  <input value={editingRecipe.subCategory || ""} onChange={e => setEditingRecipe(p => ({ ...p, subCategory: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., Traditional, Grilled" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Portion Size</label>
                  <input value={editingRecipe.portionSize || ""} onChange={e => setEditingRecipe(p => ({ ...p, portionSize: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., 350g, 1 pc" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Prep Time (min)</label>
                  <input type="number" value={editingRecipe.preparationTime || ""} onChange={e => setEditingRecipe(p => ({ ...p, preparationTime: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">Selling Price (ETB) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingRecipe.sellingPrice === 0 ? "" : String(editingRecipe.sellingPrice ?? "")}
                    onChange={e => {
                      const raw = e.target.value;
                      const parsed = parseFloat(raw);
                      setEditingRecipe(p => ({ ...p, sellingPrice: isNaN(parsed) ? 0 : parsed, _rawSelling: raw } as typeof p & { _rawSelling: string }));
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-foreground">Ingredients *</label>
                  <button onClick={addIngredientRow} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Plus className="w-3.5 h-3.5" /> Add Ingredient
                  </button>
                </div>
                <div className="space-y-2">
                  {(editingRecipe.ingredients || []).map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select value={row.ingredientId} onChange={e => updateIngredientRow(idx, "ingredientId", e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="">Select ingredient</option>
                          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                        type="text"
                        inputMode="decimal"
                        value={(row as RecipeIngredient & { _rawQty?: string })._rawQty !== undefined ? (row as RecipeIngredient & { _rawQty?: string })._rawQty : (row.quantity === 0 ? "" : String(row.quantity))}
                        onChange={e => updateIngredientRow(idx, "quantity", e.target.value)}
                        placeholder="Qty (e.g. 0.001)"
                        className="w-full px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground px-1">{row.unit || "unit"}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-xs text-accent font-mono">{row.totalCost.toFixed(0)}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button onClick={() => removeIngRow(idx)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Summary */}
              <div className="rounded-xl bg-muted/50 border border-border p-4 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground font-mono">{formatCurrency(totalCost, "ETB")}</p>
                  <p className="text-[10px] text-muted-foreground">Total Cost</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-sm font-bold font-mono", foodCostPct > settings.targetFoodCostPercent ? "text-red-400" : "text-green-400")}>{formatPercent(foodCostPct)}</p>
                  <p className="text-[10px] text-muted-foreground">Food Cost %</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-accent font-mono">{formatCurrency(suggestedPrice, "ETB")}</p>
                  <p className="text-[10px] text-muted-foreground">Suggested Price</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                {isEditing ? "Update Recipe" : "Create Recipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
