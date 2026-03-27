import { useState, useCallback } from "react";
import { Batches } from "@/lib/storage";
import type { IngredientBatch } from "@/types";

export function useBatches() {
  const [batches, setBatches] = useState<IngredientBatch[]>(() => {
    Batches.updateFlags();
    return Batches.getAll();
  });

  const refresh = useCallback(() => {
    Batches.updateFlags();
    setBatches(Batches.getAll());
  }, []);

  const addBatch = useCallback((batch: IngredientBatch) => {
    Batches.add(batch);
    refresh();
  }, [refresh]);

  const expiringSoon = batches.filter(b => b.isExpiringSoon && !b.isExpired && b.quantity > 0);
  const expired = batches.filter(b => b.isExpired && b.quantity > 0);
  const activeBatches = batches.filter(b => !b.isExpired && b.quantity > 0);

  const getByIngredient = useCallback((ingredientId: string) =>
    batches.filter(b => b.ingredientId === ingredientId).sort((a, b) => a.receivedDate.localeCompare(b.receivedDate)),
  [batches]);

  return { batches, activeBatches, expiringSoon, expired, refresh, addBatch, getByIngredient };
}
