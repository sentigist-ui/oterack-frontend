/**
 * Supabase DB API — Recipes
 * Replaces localStorage Recipes store.
 */
import { supabase } from "@/lib/supabase";
import type { Recipe, RecipeIngredient } from "@/types";
import type { DbRecipe } from "@/lib/supabase";

// ─── Mappers ──────────────────────────────────────────────────────────────────
function toDb(r: Recipe): Omit<DbRecipe, "created_at"> {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    sub_category: r.subCategory ?? "",
    portion_size: r.portionSize,
    selling_price: r.sellingPrice,
    ingredients: r.ingredients,
    total_cost: r.totalCost,
    food_cost_percent: r.foodCostPercent,
    suggested_price: r.suggestedPrice,
    preparation_time: r.preparationTime,
    active: r.active,
    updated_at: r.updatedAt,
  };
}

function fromDb(row: DbRecipe): Recipe {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Recipe["category"],
    subCategory: row.sub_category,
    portionSize: row.portion_size,
    sellingPrice: Number(row.selling_price),
    ingredients: (row.ingredients as RecipeIngredient[]) ?? [],
    totalCost: Number(row.total_cost),
    foodCostPercent: Number(row.food_cost_percent),
    suggestedPrice: Number(row.suggested_price),
    preparationTime: Number(row.preparation_time),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── DB Operations ────────────────────────────────────────────────────────────
export const RecipesDB = {
  getAll: async (): Promise<Recipe[]> => {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("name", { ascending: true });
    if (error) { console.error("RecipesDB.getAll:", error.message); return []; }
    return (data as DbRecipe[]).map(fromDb);
  },

  getById: async (id: string): Promise<Recipe | null> => {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return fromDb(data as DbRecipe);
  },

  upsert: async (recipe: Recipe): Promise<boolean> => {
    const { error } = await supabase
      .from("recipes")
      .upsert(toDb(recipe), { onConflict: "id" });
    if (error) { console.error("RecipesDB.upsert:", error.message); return false; }
    return true;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) { console.error("RecipesDB.delete:", error.message); return false; }
    return true;
  },

  getActive: async (): Promise<Recipe[]> => {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) { console.error("RecipesDB.getActive:", error.message); return []; }
    return (data as DbRecipe[]).map(fromDb);
  },
};
