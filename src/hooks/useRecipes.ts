import { useState, useCallback } from "react";
import { Recipes } from "@/lib/storage";
import type { Recipe } from "@/types";

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(() => Recipes.getAll());
  const [loading] = useState(false);

  const refresh = useCallback(() => {
    setRecipes(Recipes.getAll());
  }, []);

  const upsert = useCallback((recipe: Recipe) => {
    Recipes.upsert(recipe);
    setRecipes(Recipes.getAll());
  }, []);

  const remove = useCallback((id: string) => {
    Recipes.delete(id);
    setRecipes(Recipes.getAll());
  }, []);

  const getByCategory = useCallback((category: "Food" | "Beverage") => {
    return recipes.filter(r => r.category === category);
  }, [recipes]);

  const foodCostAvg = recipes.length > 0
    ? recipes.filter(r => r.active).reduce((s, r) => s + r.foodCostPercent, 0) / Math.max(1, recipes.filter(r => r.active).length)
    : 0;

  return { recipes, loading, refresh, upsert, remove, getByCategory, foodCostAvg };
}
