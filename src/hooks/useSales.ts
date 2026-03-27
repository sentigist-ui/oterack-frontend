import { useState, useCallback } from "react";
import { Sales, KitchenStock, BarStock, Recipes } from "@/lib/storage";
import type { Sale } from "@/types";
import { getTodayISO, daysAgo } from "@/lib/utils";

const BAR_CATEGORIES = ["Beverage", "beverage", "Alcohol", "alcohol", "Bar", "bar"];

export function useSales() {
  const [sales, setSales] = useState<Sale[]>(() => Sales.getAll());
  const [loading] = useState(false);

  const refresh = useCallback(() => {
    setSales(Sales.getAll());
  }, []);

  const addSale = useCallback((sale: Sale) => {
    Sales.add(sale);
    setSales(Sales.getAll());

    // Deduct kitchen/bar stock based on recipe category
    const recipes = Recipes.getAll();
    sale.items.forEach(item => {
      const recipe = recipes.find(r => r.id === item.recipeId);
      if (recipe) {
        const isBarItem = BAR_CATEGORIES.includes(recipe.category) || BAR_CATEGORIES.includes(recipe.subCategory ?? "");
        recipe.ingredients.forEach(ing => {
          const qty = ing.quantity * item.quantity;
          if (isBarItem) {
            const barItem = BarStock.getById(ing.ingredientId);
            if (barItem && barItem.currentQuantity > 0) {
              BarStock.deductQty(ing.ingredientId, qty);
            } else {
              KitchenStock.deductQty(ing.ingredientId, qty);
            }
          } else {
            KitchenStock.deductQty(ing.ingredientId, qty);
          }
        });
      }
    });
  }, []);

  const todaySales = sales.filter(s => s.date === getTodayISO());
  const todayRevenue = todaySales.reduce((s, sale) => s + sale.totalRevenue, 0);
  const todayCost = todaySales.reduce((s, sale) => s + sale.totalCost, 0);
  const todayProfit = todayRevenue - todayCost;

  const weekSales = sales.filter(s => s.date >= daysAgo(7));
  const weekRevenue = weekSales.reduce((s, sale) => s + sale.totalRevenue, 0);
  const weekCost = weekSales.reduce((s, sale) => s + sale.totalCost, 0);

  const topItems = (() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    weekSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!map[item.recipeId]) map[item.recipeId] = { name: item.recipeName, qty: 0, revenue: 0 };
        map[item.recipeId].qty += item.quantity;
        map[item.recipeId].revenue += item.totalPrice;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  })();

  const revenueByCategory = (() => {
    const map: Record<string, number> = {};
    weekSales.forEach(sale => {
      sale.items.forEach(item => {
        map[item.category] = (map[item.category] || 0) + item.totalPrice;
      });
    });
    return Object.entries(map).map(([category, amount]) => ({ category, amount }));
  })();

  const dailyTrend = (() => {
    const map: Record<string, { revenue: number; cost: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      map[d] = { revenue: 0, cost: 0 };
    }
    weekSales.forEach(s => {
      if (map[s.date]) {
        map[s.date].revenue += s.totalRevenue;
        map[s.date].cost += s.totalCost;
      }
    });
    return Object.entries(map).map(([date, vals]) => ({ date, ...vals, profit: vals.revenue - vals.cost }));
  })();

  return { sales, loading, refresh, addSale, todaySales, todayRevenue, todayCost, todayProfit, weekRevenue, weekCost, topItems, revenueByCategory, dailyTrend };
}
