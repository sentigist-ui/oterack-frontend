import { useState, useCallback } from "react";
import { Alerts } from "@/lib/storage";
import type { Alert } from "@/types";

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(() => Alerts.getAll());

  const refresh = useCallback(() => {
    setAlerts(Alerts.getAll());
  }, []);

  const markRead = useCallback((id: string) => {
    Alerts.markRead(id);
    refresh();
  }, [refresh]);

  const markAllRead = useCallback(() => {
    Alerts.markAllRead();
    refresh();
  }, [refresh]);

  const addAlert = useCallback((alert: Alert) => {
    Alerts.add(alert);
    refresh();
  }, [refresh]);

  const unreadCount = alerts.filter(a => !a.isRead).length;
  const criticalAlerts = alerts.filter(a => a.severity === "critical" && !a.isRead);

  return { alerts, unreadCount, criticalAlerts, markRead, markAllRead, addAlert, refresh };
}
