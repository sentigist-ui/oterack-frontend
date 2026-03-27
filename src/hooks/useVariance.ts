import { useMemo } from "react";
import type { Sale, StockMovement, Recipe, Ingredient, VarianceItem } from "@/types";
import { getVarianceStatus } from "@/lib/utils";
import { Settings } from "@/lib/storage";

export function useVariance(
  sales: Sale[],
  movements: StockMovement[],
  recipes: Recipe[],
  ingredients: Ingredient[],
  periodDays = 7
) {
  const settings = Settings.get();

  const varianceItems = useMemo(() => {
    // Step 1: Calculate expected consumption per ingredient from sales × recipes
    const expected: Record<string, number> = {};

    sales.forEach(sale => {
      sale.items.forEach(saleItem => {
        const recipe = recipes.find(r => r.id === saleItem.recipeId);
        if (!recipe) return;
        recipe.ingredients.forEach(ri => {
          expected[ri.ingredientId] = (expected[ri.ingredientId] || 0) + ri.quantity * saleItem.quantity;
        });
      });
    });

    // Step 2: Calculate actual consumption from ISSUE + ADJUSTMENT movements
    const actual: Record<string, number> = {};
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);

    movements.forEach(m => {
      if ((m.type === "ISSUE" || m.type === "ADJUSTMENT") && new Date(m.timestamp) >= cutoff) {
        actual[m.ingredientId] = (actual[m.ingredientId] || 0) + m.quantity;
      }
    });

    // Step 3: Compute variance for ingredients that have either expected or actual consumption
    const allIds = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const items: VarianceItem[] = [];

    allIds.forEach(id => {
      const ingredient = ingredients.find(i => i.id === id);
      if (!ingredient) return;

      const exp = expected[id] || 0;
      const act = actual[id] || 0;
      if (exp === 0 && act === 0) return;

      const variance = act - exp;
      const variancePercent = exp > 0 ? (variance / exp) * 100 : act > 0 ? 100 : 0;
      const status = getVarianceStatus(
        variancePercent,
        settings.varianceWarningPercent,
        settings.varianceCriticalPercent
      );

      items.push({
        ingredientId: id,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        expectedConsumption: Math.round(exp * 100) / 100,
        actualConsumption: Math.round(act * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variancePercent: Math.round(variancePercent * 10) / 10,
        status,
        potentialLoss: Math.max(0, variance) * ingredient.costPerUnit,
        period: `Last ${periodDays} days`,
      });
    });

    return items.sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent));
  }, [sales, movements, recipes, ingredients, periodDays, settings]);

  const criticalCount = varianceItems.filter(v => v.status === "critical").length;
  const warningCount = varianceItems.filter(v => v.status === "warning").length;
  const totalPotentialLoss = varianceItems.reduce((s, v) => s + v.potentialLoss, 0);

  return { varianceItems, criticalCount, warningCount, totalPotentialLoss };
}
