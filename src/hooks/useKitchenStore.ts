import { useState, useCallback } from "react";
import { KitchenStock, Ingredients } from "@/lib/storage";
import type { KitchenStockItem } from "@/types";

export function useKitchenStore() {
  const [kitchenStock, setKitchenStock] = useState<KitchenStockItem[]>(() => KitchenStock.getAll());

  const refresh = useCallback(() => {
    setKitchenStock(KitchenStock.getAll());
  }, []);

  const addQty = useCallback((ingredientId: string, qty: number) => {
    const ing = Ingredients.getById(ingredientId);
    if (!ing) return;
    KitchenStock.addQty(ingredientId, qty, ing.name, ing.unit, ing.costPerUnit);
    refresh();
  }, [refresh]);

  const deductQty = useCallback((ingredientId: string, qty: number) => {
    KitchenStock.deductQty(ingredientId, qty);
    refresh();
  }, [refresh]);

  const setQty = useCallback((ingredientId: string, qty: number) => {
    KitchenStock.setQty(ingredientId, qty);
    refresh();
  }, [refresh]);

  const getItem = useCallback((ingredientId: string): KitchenStockItem | undefined => {
    return kitchenStock.find(k => k.ingredientId === ingredientId);
  }, [kitchenStock]);

  const totalValue = kitchenStock.reduce((s, k) => s + k.currentQuantity * k.costPerUnit, 0);
  const lowStock = kitchenStock.filter(k => k.currentQuantity <= 0);
  const criticalItems = kitchenStock.filter(k => k.currentQuantity === 0);

  return {
    kitchenStock,
    refresh,
    addQty,
    deductQty,
    setQty,
    getItem,
    totalValue,
    lowStock,
    criticalItems,
  };
}
