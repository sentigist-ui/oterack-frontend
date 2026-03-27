import { useState, useCallback } from "react";
import { PRStore, NotificationsStore } from "@/lib/storage";
import type { PurchaseRequest, PRItem, AppNotification, PurchaserConfirmedItem } from "@/types";
import { generateId } from "@/lib/utils";

export function usePurchaseRequests() {
  const [requests, setRequests] = useState<PurchaseRequest[]>(() => PRStore.getAll());

  const refresh = useCallback(() => {
    setRequests(PRStore.getAll());
  }, []);

  const createPR = useCallback((pr: PurchaseRequest) => {
    PRStore.upsert(pr);
    setRequests(PRStore.getAll());
  }, []);

  const storekeeperForward = useCallback((id: string, reviewedBy: string, notes: string) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = {
      ...all[idx],
      status: "finance_review",
      storekeeperNotes: notes,
      storekeeperReviewedBy: reviewedBy,
      storekeeperReviewedAt: new Date().toISOString(),
    };
    PRStore.upsert(all[idx]);
    setRequests(PRStore.getAll());
  }, []);

  const financeApprove = useCallback((id: string, reviewedBy: string, notes: string, adjustedItems?: PRItem[]) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    const items = adjustedItems ?? all[idx].items;
    all[idx] = {
      ...all[idx],
      status: "finance_approved",
      items,
      totalApprovedCost: items.filter(i => !i.zeroed).reduce((s, i) => s + i.approvedQty * i.estimatedUnitCost, 0),
      financeNotes: notes,
      financeReviewedBy: reviewedBy,
      financeReviewedAt: new Date().toISOString(),
    };
    PRStore.upsert(all[idx]);
    setRequests(PRStore.getAll());
  }, []);

  const financeReject = useCallback((id: string, reviewedBy: string, notes: string) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], status: "finance_rejected", financeNotes: notes, financeReviewedBy: reviewedBy, financeReviewedAt: new Date().toISOString() };
    PRStore.upsert(all[idx]);
    setRequests(PRStore.getAll());
  }, []);

  const ownerApprove = useCallback((id: string, reviewedBy: string, notes: string, purchaserId: string, purchaserName: string, adjustedItems?: PRItem[]) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = {
      ...all[idx],
      status: "sent_to_purchaser",
      items: adjustedItems ?? all[idx].items,
      totalApprovedCost: adjustedItems
        ? adjustedItems.filter(i => !i.zeroed).reduce((s, i) => s + i.approvedQty * i.estimatedUnitCost, 0)
        : all[idx].totalApprovedCost,
      ownerNotes: notes,
      ownerReviewedBy: reviewedBy,
      ownerReviewedAt: new Date().toISOString(),
      purchaserAssignedTo: purchaserId,
      purchaserAssignedName: purchaserName,
      sentToPurchaserAt: new Date().toISOString(),
    };
    PRStore.upsert(all[idx]);

    const notif: AppNotification = {
      id: generateId(),
      recipientUserId: purchaserId,
      recipientRole: "purchaser",
      title: "New Purchase Request Assigned",
      message: `PR ${all[idx].prNumber} approved by Owner — assigned to you for procurement. Total: ETB ${all[idx].totalApprovedCost.toLocaleString()}.`,
      type: "pr_action",
      relatedId: id,
      isRead: false,
      createdAt: new Date().toISOString(),
      createdBy: reviewedBy,
    };
    NotificationsStore.add(notif);
    setRequests(PRStore.getAll());
  }, []);

  const ownerReject = useCallback((id: string, reviewedBy: string, notes: string) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], status: "owner_rejected", ownerNotes: notes, ownerReviewedBy: reviewedBy, ownerReviewedAt: new Date().toISOString() };
    PRStore.upsert(all[idx]);
    setRequests(PRStore.getAll());
  }, []);

  /**
   * Purchaser confirms items with REAL quantities and unit prices.
   * Status → "quality_check" (storekeeper + manager must verify before going to main store)
   */
  const purchaserConfirm = useCallback((
    id: string,
    purchaserName: string,
    confirmedItems: PurchaserConfirmedItem[],
    invoiceNumber: string,
    supplierName: string,
    notes: string,
  ) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    const totalActualCost = confirmedItems.reduce((s, i) => s + i.totalPrice, 0);
    all[idx] = {
      ...all[idx],
      status: "quality_check",
      purchaserConfirmedItems: confirmedItems,
      purchaserConfirmedAt: new Date().toISOString(),
      purchaserInvoiceNumber: invoiceNumber,
      purchaserSupplierName: supplierName,
      purchaserNotes: notes,
      purchaserTotalActualCost: totalActualCost,
      grnReference: invoiceNumber,
    };
    PRStore.upsert(all[idx]);

    // Notify storekeeper and manager
    const storekeepersNotif: AppNotification = {
      id: generateId(),
      recipientRole: "storekeeper",
      recipientUserId: "broadcast",
      title: "Quality Check Required",
      message: `PR ${all[idx].prNumber} — Goods arrived from ${supplierName}. Invoice: ${invoiceNumber}. Please inspect and confirm receipt of ${confirmedItems.length} items (Total: ETB ${totalActualCost.toLocaleString()}).`,
      type: "pr_action",
      relatedId: id,
      isRead: false,
      createdAt: new Date().toISOString(),
      createdBy: purchaserName,
    };
    const managerNotif: AppNotification = {
      id: generateId(),
      recipientRole: "manager",
      recipientUserId: "broadcast",
      title: "Goods Ready for Quality Inspection",
      message: `PR ${all[idx].prNumber} items delivered by ${supplierName}. Storekeeper quality check pending before main store update.`,
      type: "pr_action",
      relatedId: id,
      isRead: false,
      createdAt: new Date().toISOString(),
      createdBy: purchaserName,
    };
    NotificationsStore.add(storekeepersNotif);
    NotificationsStore.add(managerNotif);
    setRequests(PRStore.getAll());
  }, []);

  /**
   * Storekeeper / F&B Manager approves quality → items automatically go to Main Store.
   * Creates ingredient entries if they don't exist.
   */
  const qualityApprove = useCallback((
    id: string,
    checkedBy: string,
    checkedByName: string,
    qualityNotes: string,
  ) => {
    const { Ingredients: IngredientsStore } = require("@/lib/storage");
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    const pr = all[idx];
    const confirmedItems = pr.purchaserConfirmedItems ?? [];

    // Auto-add to main store ingredients
    confirmedItems.forEach(ci => {
      const existing = IngredientsStore.getAll().find((ing: any) => ing.name.toLowerCase() === ci.itemName.toLowerCase());
      if (existing) {
        // Update quantity and cost per unit
        IngredientsStore.updateQuantity(existing.id, ci.receivedQty);
        // Update cost per unit if changed
        const updatedIng = { ...existing, costPerUnit: ci.unitPrice, lastUpdated: new Date().toISOString() };
        IngredientsStore.upsert(updatedIng);
      } else {
        // Create new ingredient from received item
        const newIng = {
          id: generateId(),
          name: ci.itemName,
          unit: ci.unit,
          costPerUnit: ci.unitPrice,
          currentQuantity: ci.receivedQty,
          minQuantity: 0,
          category: "General",
          lastUpdated: new Date().toISOString(),
        };
        IngredientsStore.upsert(newIng);
      }
    });

    all[idx] = {
      ...pr,
      status: "grn_received",
      qualityCheckedBy: checkedBy,
      qualityCheckedByName: checkedByName,
      qualityCheckedAt: new Date().toISOString(),
      qualityNotes: qualityNotes,
      grnCompletedAt: new Date().toISOString(),
    };
    PRStore.upsert(all[idx]);
    setRequests(PRStore.getAll());
  }, []);

  // Legacy purchaserReceive (kept for backward compatibility in PurchaseRequestsPage)
  const purchaserReceive = useCallback((id: string, purchaserName: string, grnRef: string, notes: string) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = {
      ...all[idx],
      status: "grn_received",
      purchaserNotes: notes,
      grnCompletedAt: new Date().toISOString(),
      grnReference: grnRef,
    };
    PRStore.upsert(all[idx]);
    setRequests(PRStore.getAll());
  }, []);

  const closePR = useCallback((id: string) => {
    const all = PRStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], status: "closed" };
    PRStore.upsert(all[idx]);
    setRequests(PRStore.getAll());
  }, []);

  const pendingForStorekeeper = requests.filter(r =>
    r.status === "pending" && ["kitchen", "bar", "hod"].includes(r.requestedByRole)
  );
  const pendingForFinance = requests.filter(r =>
    r.status === "storekeeper_review" || (r.status === "pending" && r.requestedByRole === "storekeeper")
  );
  const pendingForOwner = requests.filter(r => r.status === "finance_approved");
  const pendingForPurchaser = requests.filter(r => r.status === "sent_to_purchaser");
  const pendingQualityCheck = requests.filter(r => r.status === "quality_check");

  return {
    requests,
    refresh,
    createPR,
    storekeeperForward,
    financeApprove,
    financeReject,
    ownerApprove,
    ownerReject,
    purchaserReceive,
    purchaserConfirm,
    qualityApprove,
    closePR,
    pendingForStorekeeper,
    pendingForFinance,
    pendingForOwner,
    pendingForPurchaser,
    pendingQualityCheck,
  };
}
