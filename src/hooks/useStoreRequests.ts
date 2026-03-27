import { useState, useCallback } from "react";
import { StoreRequests } from "@/lib/storage";
import type { StoreRequest } from "@/types";

export function useStoreRequests() {
  const [requests, setRequests] = useState<StoreRequest[]>(() => StoreRequests.getAll());

  const refresh = useCallback(() => {
    setRequests(StoreRequests.getAll());
  }, []);

  const createRequest = useCallback((req: StoreRequest) => {
    StoreRequests.save(req);
    refresh();
  }, [refresh]);

  const managerApprove = useCallback((id: string, reviewedBy: string, adjustments: Record<string, number | "zero">, notes: string) => {
    StoreRequests.managerApprove(id, reviewedBy, adjustments, notes);
    refresh();
  }, [refresh]);

  const managerReject = useCallback((id: string, reviewedBy: string, notes: string) => {
    StoreRequests.managerReject(id, reviewedBy, notes);
    refresh();
  }, [refresh]);

  const financeApprove = useCallback((id: string, reviewedBy: string, adjustments: Record<string, number | "zero">, notes: string) => {
    StoreRequests.financeApprove(id, reviewedBy, adjustments, notes);
    refresh();
  }, [refresh]);

  const financeReject = useCallback((id: string, reviewedBy: string, notes: string) => {
    StoreRequests.financeReject(id, reviewedBy, notes);
    refresh();
  }, [refresh]);

  const fulfill = useCallback((id: string, fulfilledBy: string, fulfilledQtys: Record<string, number>) => {
    StoreRequests.fulfill(id, fulfilledBy, fulfilledQtys);
    refresh();
  }, [refresh]);

  const pendingForManager = requests.filter(r => r.status === "pending");
  const pendingForFinance = requests.filter(r => r.status === "manager_approved");
  const pendingForStorekeeper = requests.filter(r => r.status === "finance_approved");

  return {
    requests,
    refresh,
    createRequest,
    managerApprove,
    managerReject,
    financeApprove,
    financeReject,
    fulfill,
    pendingForManager,
    pendingForFinance,
    pendingForStorekeeper,
  };
}
