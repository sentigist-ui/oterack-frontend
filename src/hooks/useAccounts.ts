import { useState, useCallback } from "react";
import { ARStore, APStore, NotificationsStore } from "@/lib/storage";
import type { AccountReceivable, AccountPayable, AppNotification } from "@/types";
import { generateId } from "@/lib/utils";

export function useAccounts() {
  const [arRecords, setARRecords] = useState<AccountReceivable[]>(() =>
    ARStore.getAll().map(r => ARStore.recalcStatus(r))
  );
  const [apRecords, setAPRecords] = useState<AccountPayable[]>(() => APStore.getAll());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => NotificationsStore.getAll());

  const refreshAR = useCallback(() => {
    setARRecords(ARStore.getAll().map(r => ARStore.recalcStatus(r)));
  }, []);

  const refreshAP = useCallback(() => {
    setAPRecords(APStore.getAll());
  }, []);

  // ── AR ──────────────────────────────────────────────────────────────────────
  const addAR = useCallback((record: Omit<AccountReceivable, "id" | "agingBucket" | "status" | "collectorNotified" | "collectorConfirmed" | "payments">) => {
    const full: AccountReceivable = {
      ...record,
      id: generateId(),
      paidAmount: 0,
      outstandingAmount: record.totalAmount,
      status: "outstanding",
      agingBucket: ARStore.calcAging(record.dueDate),
      collectorNotified: false,
      collectorConfirmed: false,
      payments: [],
    };
    const finalized = ARStore.recalcStatus(full);
    ARStore.upsert(finalized);
    refreshAR();
  }, [refreshAR]);

  const updateAR = useCallback((record: AccountReceivable) => {
    const finalized = ARStore.recalcStatus(record);
    ARStore.upsert(finalized);
    refreshAR();
  }, [refreshAR]);

  const deleteAR = useCallback((id: string) => {
    ARStore.delete(id);
    refreshAR();
  }, [refreshAR]);

  const recordARPayment = useCallback((id: string, amount: number, reference: string, recordedBy: string) => {
    const record = ARStore.getById(id);
    if (!record) return;
    const newPaid = record.paidAmount + amount;
    const updated: AccountReceivable = {
      ...record,
      paidAmount: newPaid,
      outstandingAmount: Math.max(0, record.totalAmount - newPaid),
      payments: [...record.payments, { date: new Date().toISOString().split("T")[0], amount, reference, recordedBy }],
    };
    const finalized = ARStore.recalcStatus(updated);
    ARStore.upsert(finalized);
    refreshAR();
  }, [refreshAR]);

  // Finance sends AR collection document to collector
  const sendToCollector = useCallback((arId: string, collectorUserId: string, collectorName: string, sentBy: string) => {
    const record = ARStore.getById(arId);
    if (!record) return;
    const updated: AccountReceivable = {
      ...record,
      assignedCollector: collectorUserId,
      collectorName,
      collectorNotified: true,
      collectorConfirmed: false,
    };
    ARStore.upsert(updated);

    // Create notification for collector
    const notif: AppNotification = {
      id: generateId(),
      recipientUserId: collectorUserId,
      recipientRole: "collector",
      title: "New Collection Assignment",
      message: `Finance has assigned you to collect ${record.invoiceNumber} from ${record.clientName} — ETB ${record.outstandingAmount.toLocaleString()} outstanding.`,
      type: "ar_collection",
      relatedId: arId,
      isRead: false,
      createdAt: new Date().toISOString(),
      createdBy: sentBy,
    };
    NotificationsStore.add(notif);
    refreshAR();
    setNotifications(NotificationsStore.getAll());
  }, [refreshAR]);

  // Collector confirms receipt of collection document
  const collectorConfirm = useCallback((arId: string, userId: string) => {
    const record = ARStore.getById(arId);
    if (!record) return;
    const updated: AccountReceivable = {
      ...record,
      collectorConfirmed: true,
      collectorConfirmedAt: new Date().toISOString(),
    };
    ARStore.upsert(updated);
    refreshAR();
  }, [refreshAR]);

  // ── AP ──────────────────────────────────────────────────────────────────────
  const addAP = useCallback((record: Omit<AccountPayable, "id" | "agingBucket" | "status" | "paidAmount" | "outstandingAmount" | "payments">) => {
    const full: AccountPayable = {
      ...record,
      id: generateId(),
      paidAmount: 0,
      outstandingAmount: record.totalAmount,
      status: "unpaid",
      agingBucket: APStore.calcAging(record.dueDate),
      payments: [],
    };
    APStore.upsert(full);
    refreshAP();
  }, [refreshAP]);

  const updateAP = useCallback((record: AccountPayable) => {
    APStore.upsert(record);
    refreshAP();
  }, [refreshAP]);

  const deleteAP = useCallback((id: string) => {
    APStore.delete(id);
    refreshAP();
  }, [refreshAP]);

  const recordAPPayment = useCallback((id: string, amount: number, reference: string, recordedBy: string) => {
    const record = APStore.getById(id);
    if (!record) return;
    const newPaid = record.paidAmount + amount;
    const outstanding = Math.max(0, record.totalAmount - newPaid);
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = record.dueDate < today;
    let status: AccountPayable["status"] = "unpaid";
    if (outstanding <= 0) status = "paid";
    else if (newPaid > 0) status = isOverdue ? "overdue" : "partially_paid";
    else if (isOverdue) status = "overdue";

    const updated: AccountPayable = {
      ...record,
      paidAmount: newPaid,
      outstandingAmount: outstanding,
      status,
      payments: [...record.payments, { date: today, amount, reference, recordedBy }],
    };
    APStore.upsert(updated);
    refreshAP();
  }, [refreshAP]);

  // Notifications
  const getUserNotifications = useCallback((userId: string, role?: string) => {
    return NotificationsStore.getForUser(userId, role);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    NotificationsStore.markRead(id);
    setNotifications(NotificationsStore.getAll());
  }, []);

  const markAllNotificationsRead = useCallback((userId: string, role?: string) => {
    NotificationsStore.markAllRead(userId, role);
    setNotifications(NotificationsStore.getAll());
  }, []);

  // Computed stats
  const arStats = {
    totalOutstanding: arRecords.filter(r => r.status !== "paid").reduce((s, r) => s + r.outstandingAmount, 0),
    overdue: arRecords.filter(r => r.status === "overdue"),
    aging0_30: arRecords.filter(r => r.agingBucket === "0-30" && r.status !== "paid"),
    aging31_60: arRecords.filter(r => r.agingBucket === "31-60" && r.status !== "paid"),
    aging61plus: arRecords.filter(r => r.agingBucket === "61+" && r.status !== "paid"),
  };

  const apStats = {
    totalOutstanding: apRecords.filter(r => r.status !== "paid").reduce((s, r) => s + r.outstandingAmount, 0),
    overdue: apRecords.filter(r => r.status === "overdue"),
  };

  return {
    arRecords,
    apRecords,
    notifications,
    arStats,
    apStats,
    addAR, updateAR, deleteAR, recordARPayment, sendToCollector, collectorConfirm,
    addAP, updateAP, deleteAP, recordAPPayment,
    getUserNotifications, markNotificationRead, markAllNotificationsRead,
    refreshAR, refreshAP,
  };
}
