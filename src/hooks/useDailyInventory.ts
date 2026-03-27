import { useState, useCallback } from "react";
import { DailyInventory, KitchenStock, Sales, ConsumptionStore, StockMovements, Recipes } from "@/lib/storage";
import type { DailyInventorySheet, DailyInventoryEntry } from "@/types";
import { generateId, getTodayISO } from "@/lib/utils";

// Build theoretical closing for each kitchen stock item
function buildTheoreticalEntries(date: string): Omit<DailyInventoryEntry, "physicalCount" | "variance" | "status" | "varianceCost" | "notes" | "recordedBy" | "recordedByName" | "isShortageReported">[] {
  const kitchenItems = KitchenStock.getAll();
  const recipes = Recipes.getAll();

  // Calculate ingredients consumed via sales for this date
  const daySales = Sales.getByDate(date);
  const salesConsumption: Record<string, number> = {};
  daySales.forEach(sale => {
    sale.items.forEach(item => {
      const recipe = recipes.find(r => r.id === item.recipeId);
      if (recipe) {
        recipe.ingredients.forEach(ing => {
          salesConsumption[ing.ingredientId] = (salesConsumption[ing.ingredientId] || 0) + ing.quantity * item.quantity;
        });
      }
    });
  });

  // Calculate manual consumption for this date
  const dayConsumption = ConsumptionStore.getByDate(date);
  const manualConsumption: Record<string, number> = {};
  dayConsumption.forEach(r => {
    manualConsumption[r.ingredientId] = (manualConsumption[r.ingredientId] || 0) + r.quantity;
  });

  // Calculate transfers IN to kitchen for this date
  const allMovements = StockMovements.getAll();
  const transfersIn: Record<string, number> = {};
  allMovements.forEach(m => {
    const mDate = m.timestamp.split("T")[0];
    if (mDate !== date) return;
    const dest = (m.toLocation || "").toLowerCase();
    if ((m.type === "ISSUE" || m.type === "TRANSFER") &&
        (dest === "kitchen" || dest === "bar" || dest === "restaurant")) {
      transfersIn[m.ingredientId] = (transfersIn[m.ingredientId] || 0) + m.quantity;
    }
  });

  return kitchenItems.map(k => {
    const transferred = transfersIn[k.ingredientId] || 0;
    const fromSales = salesConsumption[k.ingredientId] || 0;
    const fromManual = manualConsumption[k.ingredientId] || 0;
    // theoretical opening = current + what was consumed today (reverse-calculate)
    const theoreticalUsage = fromSales;
    const manualUsageToday = fromManual;
    const theoreticalClosing = Math.max(0, k.currentQuantity);
    // Opening is approx: closing + usage - transferred in
    const opening = theoreticalClosing + theoreticalUsage + manualUsageToday - transferred;

    return {
      id: generateId(),
      date,
      ingredientId: k.ingredientId,
      ingredientName: k.ingredientName,
      unit: k.unit,
      costPerUnit: k.costPerUnit,
      openingStock: Math.max(0, opening),
      transferredIn: transferred,
      theoreticalUsage,
      manualConsumption: manualUsageToday,
      theoreticalClosing: Math.max(0, theoreticalClosing),
    };
  });
}

export function useDailyInventory() {
  const [sheets, setSheets] = useState<DailyInventorySheet[]>(() => DailyInventory.getAll());

  const refresh = useCallback(() => {
    setSheets(DailyInventory.getAll());
  }, []);

  const getTodaySheet = useCallback((): DailyInventorySheet | undefined => {
    return DailyInventory.getByDate(getTodayISO());
  }, []);

  const createSheet = useCallback((date: string, user: { id: string; name: string }): DailyInventorySheet => {
    const existing = DailyInventory.getByDate(date);
    if (existing) return existing;

    const theoretical = buildTheoreticalEntries(date);
    const entries: DailyInventoryEntry[] = theoretical.map(t => ({
      ...t,
      physicalCount: t.theoreticalClosing, // default to theoretical
      variance: 0,
      status: "ok" as const,
      varianceCost: 0,
      notes: "",
      recordedBy: user.id,
      recordedByName: user.name,
      isShortageReported: false,
    }));

    const sheet: DailyInventorySheet = {
      id: generateId(),
      date,
      entries,
      totalVarianceCost: 0,
      shortageCount: 0,
      overageCount: 0,
      status: "draft",
      submittedBy: user.name,
      createdAt: new Date().toISOString(),
    };

    DailyInventory.save(sheet);
    setSheets(DailyInventory.getAll());
    return sheet;
  }, []);

  const updatePhysicalCount = useCallback((sheetId: string, ingredientId: string, physicalCount: number) => {
    const all = DailyInventory.getAll();
    const sheetIdx = all.findIndex(s => s.id === sheetId);
    if (sheetIdx < 0) return;

    const sheet = { ...all[sheetIdx] };
    const entryIdx = sheet.entries.findIndex(e => e.ingredientId === ingredientId);
    if (entryIdx < 0) return;

    const entry = { ...sheet.entries[entryIdx] };
    entry.physicalCount = physicalCount;
    entry.variance = physicalCount - entry.theoreticalClosing;
    entry.varianceCost = Math.abs(entry.variance) * entry.costPerUnit;
    if (Math.abs(entry.variance) < 0.001) {
      entry.status = "ok";
    } else if (entry.variance < 0) {
      entry.status = "shortage";
    } else {
      entry.status = "overage";
    }

    sheet.entries[entryIdx] = entry;
    // Recalculate totals
    sheet.totalVarianceCost = sheet.entries.reduce((s, e) => s + e.varianceCost, 0);
    sheet.shortageCount = sheet.entries.filter(e => e.status === "shortage").length;
    sheet.overageCount = sheet.entries.filter(e => e.status === "overage").length;

    DailyInventory.save(sheet);
    setSheets(DailyInventory.getAll());
  }, []);

  const updateEntryNotes = useCallback((sheetId: string, ingredientId: string, notes: string) => {
    const all = DailyInventory.getAll();
    const sheetIdx = all.findIndex(s => s.id === sheetId);
    if (sheetIdx < 0) return;
    const sheet = { ...all[sheetIdx] };
    const entryIdx = sheet.entries.findIndex(e => e.ingredientId === ingredientId);
    if (entryIdx < 0) return;
    sheet.entries[entryIdx] = { ...sheet.entries[entryIdx], notes };
    DailyInventory.save(sheet);
    setSheets(DailyInventory.getAll());
  }, []);

  const submitSheet = useCallback((sheetId: string, submitterName: string) => {
    const all = DailyInventory.getAll();
    const sheetIdx = all.findIndex(s => s.id === sheetId);
    if (sheetIdx < 0) return;
    const sheet = { ...all[sheetIdx], status: "submitted" as const, submittedBy: submitterName };
    // Apply physical count to kitchen stock for shortage items
    sheet.entries.forEach(e => {
      if (e.status === "shortage") {
        // Set kitchen stock to physical count (actual reality)
        KitchenStock.setQty(e.ingredientId, e.physicalCount);
      }
    });
    DailyInventory.save(sheet);
    setSheets(DailyInventory.getAll());
  }, []);

  const approveSheet = useCallback((sheetId: string, approverName: string) => {
    const all = DailyInventory.getAll();
    const sheetIdx = all.findIndex(s => s.id === sheetId);
    if (sheetIdx < 0) return;
    const sheet = { ...all[sheetIdx], status: "approved" as const, approvedBy: approverName };
    DailyInventory.save(sheet);
    setSheets(DailyInventory.getAll());
  }, []);

  const markShortageReported = useCallback((sheetId: string, ingredientId: string) => {
    const all = DailyInventory.getAll();
    const sheetIdx = all.findIndex(s => s.id === sheetId);
    if (sheetIdx < 0) return;
    const sheet = { ...all[sheetIdx] };
    const entryIdx = sheet.entries.findIndex(e => e.ingredientId === ingredientId);
    if (entryIdx < 0) return;
    sheet.entries[entryIdx] = { ...sheet.entries[entryIdx], isShortageReported: true };
    DailyInventory.save(sheet);
    setSheets(DailyInventory.getAll());
  }, []);

  return {
    sheets,
    refresh,
    getTodaySheet,
    createSheet,
    updatePhysicalCount,
    updateEntryNotes,
    submitSheet,
    approveSheet,
    markShortageReported,
  };
}
