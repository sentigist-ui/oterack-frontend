/**
 * Supabase DB API — Stock Movements
 * Replaces localStorage StockMovements store.
 */
import { supabase } from "@/lib/supabase";
import type { StockMovement } from "@/types";
import type { DbStockMovement } from "@/lib/supabase";
import { IngredientsDB } from "./ingredients";
import { Ingredients, KitchenStock, BarStock, Batches } from "@/lib/storage";

// ─── Mappers ──────────────────────────────────────────────────────────────────
function toDb(m: StockMovement): Omit<DbStockMovement, "created_at"> {
  return {
    id: m.id,
    ingredient_id: m.ingredientId,
    ingredient_name: m.ingredientName,
    ingredient_unit: m.ingredientUnit,
    quantity: m.quantity,
    type: m.type,
    user_id: m.userId,
    user_name: m.userName,
    approved_by: m.approvedBy,
    from_location: m.fromLocation,
    to_location: m.toLocation,
    reason: m.reason,
    reference: m.reference,
    timestamp: m.timestamp,
    unit_cost: m.unitCost,
    total_cost: m.totalCost,
    is_flagged: m.isFlagged ?? false,
    flag_reason: m.flagReason,
  };
}

function fromDb(row: DbStockMovement): StockMovement {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredient_name,
    ingredientUnit: row.ingredient_unit,
    quantity: Number(row.quantity),
    type: row.type as StockMovement["type"],
    userId: row.user_id,
    userName: row.user_name,
    approvedBy: row.approved_by,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    reason: row.reason,
    reference: row.reference,
    timestamp: row.timestamp,
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    isFlagged: row.is_flagged,
    flagReason: row.flag_reason,
  };
}

// ─── DB Operations ────────────────────────────────────────────────────────────
export const StockMovementsDB = {
  getAll: async (): Promise<StockMovement[]> => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("timestamp", { ascending: false });
    if (error) { console.error("StockMovementsDB.getAll:", error.message); return []; }
    return (data as DbStockMovement[]).map(fromDb);
  },

  getByIngredient: async (ingredientId: string): Promise<StockMovement[]> => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("ingredient_id", ingredientId)
      .order("timestamp", { ascending: false });
    if (error) { console.error("StockMovementsDB.getByIngredient:", error.message); return []; }
    return (data as DbStockMovement[]).map(fromDb);
  },

  getByType: async (type: string): Promise<StockMovement[]> => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("type", type)
      .order("timestamp", { ascending: false });
    if (error) { console.error("StockMovementsDB.getByType:", error.message); return []; }
    return (data as DbStockMovement[]).map(fromDb);
  },

  getFlagged: async (): Promise<StockMovement[]> => {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("is_flagged", true)
      .order("timestamp", { ascending: false });
    if (error) { console.error("StockMovementsDB.getFlagged:", error.message); return []; }
    return (data as DbStockMovement[]).map(fromDb);
  },

  /**
   * Add a movement AND trigger side effects (quantity updates, kitchen/bar stock, batches)
   * All side effects remain in localStorage for FIFO/batch complexity.
   */
  add: async (movement: StockMovement): Promise<boolean> => {
    const { error } = await supabase.from("stock_movements").insert(toDb(movement));
    if (error) { console.error("StockMovementsDB.add:", error.message); return false; }

    // ─── Side effects on localStorage stores (FIFO, kitchen/bar stock) ────────
    if (movement.type === "GRN" || movement.type === "RETURN") {
      await IngredientsDB.updateQuantity(movement.ingredientId, movement.quantity);
      Ingredients.updateQuantity(movement.ingredientId, movement.quantity);
    } else if (movement.type === "ISSUE" || movement.type === "ADJUSTMENT") {
      await IngredientsDB.updateQuantity(movement.ingredientId, -movement.quantity);
      Ingredients.updateQuantity(movement.ingredientId, -movement.quantity);
      const dest = (movement.toLocation || "").toLowerCase();
      if (dest === "kitchen" || dest === "restaurant") {
        KitchenStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "kitchen", movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      } else if (dest === "bar") {
        BarStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "bar", movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      }
    } else if (movement.type === "TRANSFER") {
      await IngredientsDB.updateQuantity(movement.ingredientId, -movement.quantity);
      Ingredients.updateQuantity(movement.ingredientId, -movement.quantity);
      const dest = (movement.toLocation || "").toLowerCase();
      if (dest === "kitchen" || dest === "restaurant") {
        KitchenStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "kitchen", movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      } else if (dest === "bar") {
        BarStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "bar", movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      }
    }
    return true;
  },

  flag: async (id: string, reason: string): Promise<boolean> => {
    const { error } = await supabase
      .from("stock_movements")
      .update({ is_flagged: true, flag_reason: reason })
      .eq("id", id);
    if (error) { console.error("StockMovementsDB.flag:", error.message); return false; }
    return true;
  },
};
