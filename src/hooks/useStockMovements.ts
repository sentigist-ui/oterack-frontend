import { useState, useCallback } from "react";
import { StockMovements } from "@/lib/storage";
import type { StockMovement, StockMovementType } from "@/types";

export function useStockMovements() {
  const [movements, setMovements] = useState<StockMovement[]>(() => StockMovements.getAll());
  const [loading] = useState(false);

  const refresh = useCallback(() => {
    setMovements(StockMovements.getAll());
  }, []);

  const addMovement = useCallback((movement: StockMovement) => {
    StockMovements.add(movement);
    setMovements(StockMovements.getAll());
  }, []);

  const flagMovement = useCallback((id: string, reason: string) => {
    StockMovements.flag(id, reason);
    setMovements(StockMovements.getAll());
  }, []);

  const getByType = useCallback((type: StockMovementType) => {
    return movements.filter(m => m.type === type);
  }, [movements]);

  const flagged = movements.filter(m => m.isFlagged);
  const recentGRNs = movements.filter(m => m.type === "GRN").slice(0, 10);
  const recentIssues = movements.filter(m => m.type === "ISSUE").slice(0, 10);

  return { movements, loading, refresh, addMovement, flagMovement, getByType, flagged, recentGRNs, recentIssues };
}
