import { useState, useCallback } from "react";
import { Ingredients } from "@/lib/storage";
import type { Ingredient } from "@/types";

export function useInventory() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => Ingredients.getAll());
  const [loading] = useState(false);

  const refresh = useCallback(() => {
    setIngredients(Ingredients.getAll());
  }, []);

  const upsert = useCallback((ingredient: Ingredient) => {
    Ingredients.upsert(ingredient);
    setIngredients(Ingredients.getAll());
  }, []);

  const remove = useCallback((id: string) => {
    Ingredients.delete(id);
    setIngredients(Ingredients.getAll());
  }, []);

  const getLowStock = useCallback(() => {
    return ingredients.filter(i => i.currentQuantity <= i.minQuantity);
  }, [ingredients]);

  const getByCategory = useCallback((category: string) => {
    return ingredients.filter(i => i.category === category);
  }, [ingredients]);

  const categories = [...new Set(ingredients.map(i => i.category))].sort();

  return { ingredients, loading, refresh, upsert, remove, getLowStock, getByCategory, categories };
}
