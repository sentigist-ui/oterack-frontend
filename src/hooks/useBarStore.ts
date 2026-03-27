import { useState, useCallback } from "react";
import { BarStock, Ingredients } from "@/lib/storage";
import type { BarStockItem } from "@/types";

export function useBarStore() {
  const [barStock, setBarStock] = useState<BarStockItem[]>(() => BarStock.getAll());

  const refresh = useCallback(() => {
    setBarStock(BarStock.getAll());
  }, []);

  const addQty = useCallback((ingredientId: string, qty: number) => {
    const ing = Ingredients.getById(ingredientId);
    if (!ing) return;
    BarStock.addQty(ingredientId, qty, ing.name, ing.unit, ing.costPerUnit);
    refresh();
  }, [refresh]);

  const deductQty = useCallback((ingredientId: string, qty: number) => {
    BarStock.deductQty(ingredientId, qty);
    refresh();
  }, [refresh]);

  const setQty = useCallback((ingredientId: string, qty: number) => {
    BarStock.setQty(ingredientId, qty);
    refresh();
  }, [refresh]);

  const totalValue = barStock.reduce((s, k) => s + k.currentQuantity * k.costPerUnit, 0);
  const outOfStock = barStock.filter(k => k.currentQuantity === 0);
  const lowStock = barStock.filter(k => k.currentQuantity > 0 && k.currentQuantity < 1);

  return { barStock, refresh, addQty, deductQty, setQty, totalValue, outOfStock, lowStock };
}
