import { useState, useCallback } from "react";
import { FixedAssetsStore, MonthlyAssetCountsStore } from "@/lib/storage";
import type { FixedAsset, MonthlyAssetCount } from "@/types";

export function useFixedAssets() {
  const [assets, setAssets] = useState<FixedAsset[]>(() => FixedAssetsStore.getAll());
  const [monthlyCounts, setMonthlyCounts] = useState<MonthlyAssetCount[]>(() => MonthlyAssetCountsStore.getAll());

  const refresh = useCallback(() => {
    setAssets(FixedAssetsStore.getAll());
    setMonthlyCounts(MonthlyAssetCountsStore.getAll());
  }, []);

  const upsertAsset = useCallback((asset: FixedAsset) => {
    FixedAssetsStore.upsert(asset);
    refresh();
  }, [refresh]);

  const deleteAsset = useCallback((id: string) => {
    FixedAssetsStore.delete(id);
    refresh();
  }, [refresh]);

  const upsertMonthlyCount = useCallback((count: MonthlyAssetCount) => {
    MonthlyAssetCountsStore.upsert(count);
    refresh();
  }, [refresh]);

  const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
  const totalDepreciation = assets.reduce((s, a) => s + (a.purchasePrice - a.currentValue), 0);
  const activeAssets = assets.filter(a => a.status === "active");

  return {
    assets,
    monthlyCounts,
    refresh,
    upsertAsset,
    deleteAsset,
    upsertMonthlyCount,
    totalValue,
    totalDepreciation,
    activeAssets,
  };
}
