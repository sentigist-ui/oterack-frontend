import { useState, useCallback } from "react";
import { ActivityLogStore } from "@/lib/storage";
import type { ActivityLog } from "@/types";
import { generateId } from "@/lib/utils";

export function useActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>(() => ActivityLogStore.getAll());

  const reload = useCallback(() => {
    setLogs(ActivityLogStore.getAll());
  }, []);

  const addLog = useCallback((entry: Omit<ActivityLog, "id" | "timestamp">) => {
    const log: ActivityLog = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    ActivityLogStore.add(log);
    setLogs(ActivityLogStore.getAll());
  }, []);

  const getByUser = useCallback((userId: string) => {
    return logs.filter(l => l.userId === userId);
  }, [logs]);

  const getByModule = useCallback((module: string) => {
    return logs.filter(l => l.module === module);
  }, [logs]);

  const clearAll = useCallback(() => {
    ActivityLogStore.clearAll();
    setLogs([]);
  }, []);

  return { logs, addLog, getByUser, getByModule, clearAll, reload };
}
