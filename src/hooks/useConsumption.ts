import { useState, useCallback } from "react";
import { ConsumptionStore } from "@/lib/storage";
import type { ConsumptionRecord } from "@/types";
import { generateId, getTodayISO } from "@/lib/utils";

export function useConsumption() {
  const [records, setRecords] = useState<ConsumptionRecord[]>(() => ConsumptionStore.getAll());

  const reload = useCallback(() => {
    setRecords(ConsumptionStore.getAll());
  }, []);

  const addRecord = useCallback((record: Omit<ConsumptionRecord, "id">) => {
    const newRecord: ConsumptionRecord = { ...record, id: generateId() };
    ConsumptionStore.add(newRecord);
    setRecords(ConsumptionStore.getAll());
    return newRecord;
  }, []);

  const approve = useCallback((id: string, approverName: string) => {
    ConsumptionStore.approve(id, approverName);
    setRecords(ConsumptionStore.getAll());
  }, []);

  const remove = useCallback((id: string) => {
    ConsumptionStore.delete(id);
    setRecords(ConsumptionStore.getAll());
  }, []);

  const getByDate = useCallback((date: string) => {
    return records.filter(r => r.date === date);
  }, [records]);

  const getByIngredient = useCallback((ingredientId: string) => {
    return records.filter(r => r.ingredientId === ingredientId);
  }, [records]);

  const getByDateRange = useCallback((from: string, to: string) => {
    return records.filter(r => r.date >= from && r.date <= to);
  }, [records]);

  const getTotalActualConsumption = useCallback((ingredientId: string, from: string, to: string) => {
    return records
      .filter(r => r.ingredientId === ingredientId && r.date >= from && r.date <= to)
      .reduce((sum, r) => sum + r.quantity, 0);
  }, [records]);

  const todayTotal = useCallback(() => {
    const today = getTodayISO();
    return records
      .filter(r => r.date === today)
      .reduce((s, r) => s + r.totalCost, 0);
  }, [records]);

  return { records, addRecord, approve, remove, getByDate, getByIngredient, getByDateRange, getTotalActualConsumption, todayTotal, reload };
}
