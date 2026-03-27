/**
 * Supabase DB API — Ingredients
 * Replaces localStorage Ingredients store for main store items.
 */
import { supabase } from "@/lib/supabase";
import type { Ingredient } from "@/types";
import type { DbIngredient } from "@/lib/supabase";

// ─── Mappers ──────────────────────────────────────────────────────────────────
function toDb(ing: Ingredient): Omit<DbIngredient, "created_at"> {
  return {
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    cost_per_unit: ing.costPerUnit,
    current_quantity: ing.currentQuantity,
    min_quantity: ing.minQuantity,
    category: ing.category,
    supplier_id: ing.supplierId,
    last_updated: ing.lastUpdated,
  };
}

function fromDb(row: DbIngredient): Ingredient {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    costPerUnit: Number(row.cost_per_unit),
    currentQuantity: Number(row.current_quantity),
    minQuantity: Number(row.min_quantity),
    category: row.category,
    supplierId: row.supplier_id,
    lastUpdated: row.last_updated,
  };
}

// ─── DB Operations ────────────────────────────────────────────────────────────
export const IngredientsDB = {
  getAll: async (): Promise<Ingredient[]> => {
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .order("name", { ascending: true });
    if (error) { console.error("IngredientsDB.getAll:", error.message); return []; }
    return (data as DbIngredient[]).map(fromDb);
  },

  getById: async (id: string): Promise<Ingredient | null> => {
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return fromDb(data as DbIngredient);
  },

  upsert: async (ing: Ingredient): Promise<boolean> => {
    const { error } = await supabase
      .from("ingredients")
      .upsert(toDb(ing), { onConflict: "id" });
    if (error) { console.error("IngredientsDB.upsert:", error.message); return false; }
    return true;
  },

  updateQuantity: async (id: string, delta: number): Promise<boolean> => {
    // Fetch current, apply delta, save
    const current = await IngredientsDB.getById(id);
    if (!current) return false;
    const newQty = Math.max(0, current.currentQuantity + delta);
    const { error } = await supabase
      .from("ingredients")
      .update({ current_quantity: newQty, last_updated: new Date().toISOString() })
      .eq("id", id);
    if (error) { console.error("IngredientsDB.updateQuantity:", error.message); return false; }
    return true;
  },

  setQuantity: async (id: string, qty: number): Promise<boolean> => {
    const { error } = await supabase
      .from("ingredients")
      .update({ current_quantity: Math.max(0, qty), last_updated: new Date().toISOString() })
      .eq("id", id);
    if (error) { console.error("IngredientsDB.setQuantity:", error.message); return false; }
    return true;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) { console.error("IngredientsDB.delete:", error.message); return false; }
    return true;
  },

  getLowStock: async (): Promise<Ingredient[]> => {
    const { data, error } = await supabase
      .from("ingredients")
      .select("*");
    if (error || !data) return [];
    return (data as DbIngredient[])
      .map(fromDb)
      .filter(i => i.currentQuantity <= i.minQuantity);
  },
};
