import { useState, useMemo } from "react";
import {
  Truck, Package, CheckCircle, Clock, AlertTriangle, Plus, Download,
  ChevronDown, ChevronUp, Split, ShoppingCart, FileCheck, Eye,
  DollarSign, Hash, Building2, ClipboardCheck,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { usePurchaseRequests } from "@/hooks/usePurchaseRequests";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDateTime, generateId, cn } from "@/lib/utils";
import type { PurchaseRequest, PurchaserConfirmedItem, VendorOrder } from "@/types";
import { PRStore, Settings } from "@/lib/storage";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ItemReceiveStatus = "ordered" | "partially_received" | "fully_received";

export default function PurchaserDashboard() {
  const { user } = useAuth();
  const { requests, purchaserConfirm, qualityApprove, purchaserReceive } = usePurchaseRequests();
  const settings = Settings.get();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<PurchaseRequest | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmedQtys, setConfirmedQtys] = useState<Record<string, string>>({});
  const [confirmedPrices, setConfirmedPrices] = useState<Record<string, string>>({});

  // Quality check modal (storekeeper / manager / admin)
  const [qualityModal, setQualityModal] = useState<PurchaseRequest | null>(null);
  const [qualityNotes, setQualityNotes] = useState("");

  // Vendor split state
  const [splitModal, setSplitModal] = useState<PurchaseRequest | null>(null);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorContact, setNewVendorContact] = useState("");
  const [splitItemVendor, setSplitItemVendor] = useState<Record<string, string>>({});

  const [itemStatus, setItemStatus] = useState<Record<string, Record<string, ItemReceiveStatus>>>({});

  const role = user?.role ?? "";
  const isPurchaser = role === "purchaser" || role === "admin";
  const isQualityRole = ["storekeeper", "manager", "admin"].includes(role);

  // PRs visible to this user
  const myPRs = useMemo(() => {
    return requests.filter(r => {
      if (["sent_to_purchaser", "purchaser_confirmed", "quality_check", "grn_received", "closed"].includes(r.status)) {
        if (role === "admin") return true;
        if (role === "purchaser") return r.purchaserAssignedTo === user?.id || r.status === "sent_to_purchaser";
        if (isQualityRole) return r.status === "quality_check" || r.status === "grn_received";
      }
      return false;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, user, role]);

  const pendingOrders = myPRs.filter(r => r.status === "sent_to_purchaser");
  const awaitingQuality = myPRs.filter(r => r.status === "quality_check");
  const completed = myPRs.filter(r => ["grn_received", "closed"].includes(r.status));

  const totalPendingValue = pendingOrders.reduce((s, r) => s + r.totalApprovedCost, 0);

  // ─── Open Confirmation Modal ──────────────────────────────────────────────
  const openConfirmModal = (pr: PurchaseRequest) => {
    setConfirmModal(pr);
    const initQtys: Record<string, string> = {};
    const initPrices: Record<string, string> = {};
    pr.items.filter(i => !i.zeroed).forEach(item => {
      initQtys[item.id] = String(item.approvedQty);
      initPrices[item.id] = String(item.estimatedUnitCost || "");
    });
    setConfirmedQtys(initQtys);
    setConfirmedPrices(initPrices);
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setSupplierName(pr.purchaserSupplierName ?? "");
    setConfirmNotes("");
  };

  const handlePurchaserConfirm = () => {
    if (!confirmModal) return;
    if (!invoiceNumber.trim()) { toast.error("Invoice number required"); return; }
    if (!supplierName.trim()) { toast.error("Supplier name required"); return; }

    const confirmedItems: PurchaserConfirmedItem[] = confirmModal.items
      .filter(i => !i.zeroed)
      .map(item => {
        const receivedQty = parseFloat(confirmedQtys[item.id] ?? "0") || 0;
        const unitPrice = parseFloat(confirmedPrices[item.id] ?? "0") || 0;
        return {
          itemId: item.id,
          itemName: item.itemName,
          unit: item.unit,
          orderedQty: item.approvedQty,
          receivedQty,
          unitPrice,
          totalPrice: receivedQty * unitPrice,
          supplierName: supplierName,
          invoiceNumber: invoiceNumber,
        };
      });

    if (confirmedItems.some(i => i.receivedQty <= 0)) {
      toast.error("All received quantities must be greater than 0");
      return;
    }

    purchaserConfirm(confirmModal.id, user!.name, confirmedItems, invoiceNumber, supplierName, confirmNotes);
    toast.success("Items confirmed — sent to storekeeper for quality check");
    setConfirmModal(null);
  };

  // ─── Quality Approval (Storekeeper/Manager) ───────────────────────────────
  const openQualityModal = (pr: PurchaseRequest) => {
    setQualityModal(pr);
    setQualityNotes("");
  };

  const handleQualityApprove = () => {
    if (!qualityModal) return;
    qualityApprove(qualityModal.id, user!.id, user!.name, qualityNotes);
    toast.success("Quality approved — items added to Main Store inventory automatically");
    setQualityModal(null);
  };

  // ─── Vendor Split ──────────────────────────────────────────────────────────
  const openSplitModal = (pr: PurchaseRequest) => {
    setSplitModal(pr);
    const existing: VendorOrder[] = (pr as any).vendorOrders ?? [];
    setVendorOrders(existing.length > 0 ? existing : []);
    const init: Record<string, string> = {};
    pr.items.forEach(i => { init[i.id] = (pr as any).vendorOrders?.find((vo: VendorOrder) => vo.items.find((vi: any) => vi.itemId === i.id))?.id ?? ""; });
    setSplitItemVendor(init);
    setNewVendorName("");
    setNewVendorContact("");
  };

  const addVendor = () => {
    if (!newVendorName.trim()) { toast.error("Vendor name required"); return; }
    const vo: VendorOrder = {
      id: generateId(), vendorName: newVendorName.trim(), vendorContact: newVendorContact.trim(),
      items: [], status: "ordered", createdAt: new Date().toISOString(),
    };
    setVendorOrders(prev => [...prev, vo]);
    setNewVendorName(""); setNewVendorContact("");
    toast.success(`Vendor "${vo.vendorName}" added`);
  };

  const saveSplit = () => {
    if (!splitModal) return;
    if (vendorOrders.length === 0) { toast.error("Add at least one vendor"); return; }
    const updatedOrders = vendorOrders.map(vo => ({
      ...vo,
      items: splitModal.items.filter(i => splitItemVendor[i.id] === vo.id)
        .map(i => ({ itemId: i.id, itemName: i.itemName, qty: i.approvedQty, unit: i.unit })),
    }));
    const allPRs = PRStore.getAll();
    const idx = allPRs.findIndex(r => r.id === splitModal.id);
    if (idx >= 0) { (allPRs[idx] as any).vendorOrders = updatedOrders; PRStore.upsert(allPRs[idx]); }
    setSplitModal(null);
    toast.success(`Split into ${vendorOrders.length} vendor orders saved`);
  };

  const toggleItemStatus = (prId: string, itemId: string) => {
    setItemStatus(prev => {
      const prStatuses = prev[prId] ?? {};
      const current = prStatuses[itemId] ?? "ordered";
      const next: ItemReceiveStatus = current === "ordered" ? "partially_received" : current === "partially_received" ? "fully_received" : "ordered";
      return { ...prev, [prId]: { ...prStatuses, [itemId]: next } };
    });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(37, 99, 235); doc.rect(0, 28, pw, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text(settings.hotelName, 14, 11);
    doc.setFontSize(9); doc.text("Purchaser Dashboard — Assigned PRs", pw - 14, 11, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()} by ${user?.name}`, 14, 20);
    autoTable(doc, {
      startY: 36,
      head: [["PR No.", "Date", "Dept", "Purpose", "Items", "Approved Cost", "Actual Cost", "Supplier", "Invoice", "Status"]],
      body: myPRs.map(r => [
        r.prNumber, r.date, r.department, r.purpose.slice(0, 40),
        r.items.map(i => `${i.itemName}: ${i.approvedQty} ${i.unit}`).join("; ").slice(0, 60),
        r.totalApprovedCost.toFixed(2),
        r.purchaserTotalActualCost?.toFixed(2) ?? "—",
        r.purchaserSupplierName ?? "—",
        r.purchaserInvoiceNumber ?? "—",
        r.status.replace(/_/g, " ").toUpperCase(),
      ]),
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    });
    doc.save(`Purchaser_PRs_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exported");
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      sent_to_purchaser:   { label: "Ready to Order",        color: "text-primary",     bg: "bg-primary/10" },
      purchaser_confirmed: { label: "Awaiting Quality Check", color: "text-amber-400",   bg: "bg-amber-500/10" },
      quality_check:       { label: "Quality Inspection",     color: "text-purple-400",  bg: "bg-purple-500/10" },
      grn_received:        { label: "GRN Received",           color: "text-emerald-400", bg: "bg-emerald-500/10" },
      closed:              { label: "Closed",                 color: "text-muted-foreground", bg: "bg-muted/20" },
    };
    return map[status] ?? { label: status, color: "text-muted-foreground", bg: "bg-muted/20" };
  };

  return (
    <AppLayout>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className={cn("stat-card border", pendingOrders.length > 0 ? "border-amber-500/30" : "border-border")}>
          <p className={cn("text-xl font-bold font-mono", pendingOrders.length > 0 ? "text-amber-400" : "text-foreground")}>{pendingOrders.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending Orders</p>
        </div>
        <div className={cn("stat-card border", awaitingQuality.length > 0 ? "border-purple-500/30" : "border-border")}>
          <p className={cn("text-xl font-bold font-mono", awaitingQuality.length > 0 ? "text-purple-400" : "text-foreground")}>{awaitingQuality.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Quality Checks</p>
        </div>
        <div className="stat-card border border-blue-500/30">
          <p className="text-xl font-bold font-mono text-blue-400">{formatCurrency(totalPendingValue, "ETB")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending Value</p>
        </div>
        <div className="stat-card border border-emerald-500/30">
          <p className="text-xl font-bold font-mono text-emerald-400">{completed.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Completed GRNs</p>
        </div>
      </div>

      {/* Quality Check Alert */}
      {awaitingQuality.length > 0 && isQualityRole && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
          <ClipboardCheck className="w-5 h-5 text-purple-400 shrink-0" />
          <p className="text-sm font-semibold text-purple-300">
            {awaitingQuality.length} delivery{awaitingQuality.length > 1 ? "ies" : ""} awaiting quality inspection — inspect goods and approve to auto-add to Main Store
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-foreground">
          {pendingOrders.length > 0
            ? <span className="text-amber-400">{pendingOrders.length} Purchase Order{pendingOrders.length > 1 ? "s" : ""} Awaiting Action</span>
            : awaitingQuality.length > 0
            ? <span className="text-purple-400">{awaitingQuality.length} Delivery{awaitingQuality.length > 1 ? "ies" : ""} Pending Quality Check</span>
            : "All Orders Complete"}
        </h2>
        <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
          <Download className="w-3.5 h-3.5" /> Export PDF
        </button>
      </div>

      {/* ─── Pending Purchaser Orders ─────────────────────────────────────────── */}
      {isPurchaser && pendingOrders.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending Procurement</h3>
          {pendingOrders.map(pr => {
            const isExpanded = expandedId === pr.id;
            return (
              <div key={pr.id} className={cn("rounded-2xl border bg-card transition-all",
                pr.urgency === "urgent" ? "border-red-500/40" : "border-amber-500/30",
                isExpanded && "shadow-lg"
              )}>
                <div className="flex items-center gap-4 px-4 py-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : pr.id)}>
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 shrink-0">
                    <Truck className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold font-mono text-foreground">{pr.prNumber}</span>
                      {pr.urgency === "urgent" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">🚨 URGENT</span>}
                      <span className="text-[10px] text-muted-foreground">{pr.department}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pr.purpose} · {pr.items.filter(i => !i.zeroed).length} items</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono text-accent">{formatCurrency(pr.totalApprovedCost, "ETB")}</p>
                    <p className="text-[10px] text-muted-foreground">approved cost</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); openSplitModal(pr); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[10px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
                      <Split className="w-3 h-3" /> Split
                    </button>
                    <button onClick={e => { e.stopPropagation(); openConfirmModal(pr); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition-all">
                      <FileCheck className="w-3.5 h-3.5" /> Confirm Receipt
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/50 px-4 py-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Items to Procure</p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            {["Item", "Unit", "Approved Qty", "Est. Unit Cost", "Est. Total", "Status"].map(h => (
                              <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pr.items.filter(i => !i.zeroed).map(item => {
                            const status = itemStatus[pr.id]?.[item.id] ?? "ordered";
                            return (
                              <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                                <td className="px-3 py-2.5 text-xs font-medium text-foreground">{item.itemName}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.unit}</td>
                                <td className="px-3 py-2.5 text-xs font-bold font-mono">{item.approvedQty}</td>
                                <td className="px-3 py-2.5 text-xs font-mono">{item.estimatedUnitCost > 0 ? formatCurrency(item.estimatedUnitCost, "ETB") : "—"}</td>
                                <td className="px-3 py-2.5 text-xs font-mono text-accent">{item.estimatedTotalCost > 0 ? formatCurrency(item.estimatedTotalCost, "ETB") : "—"}</td>
                                <td className="px-3 py-2.5">
                                  <button onClick={() => toggleItemStatus(pr.id, item.id)}
                                    className={cn("text-[10px] px-2 py-1 rounded-lg font-semibold border transition-all",
                                      status === "fully_received" ? "bg-green-500/15 border-green-500/30 text-green-400" :
                                      status === "partially_received" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                                      "bg-muted/30 border-border text-muted-foreground"
                                    )}>
                                    {status === "fully_received" ? "✓ Ordered" : status === "partially_received" ? "~ Partial" : "○ Pending"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {pr.ownerNotes && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                        <p className="text-[10px] font-semibold text-amber-400">Owner Notes ({pr.ownerReviewedBy}):</p>
                        <p className="text-xs text-foreground mt-0.5">{pr.ownerNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Quality Check Section ────────────────────────────────────────────── */}
      {awaitingQuality.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Awaiting Quality Inspection → Auto Main Store</h3>
          {awaitingQuality.map(pr => (
            <div key={pr.id} className="rounded-2xl border border-purple-500/30 bg-card">
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-500/20 shrink-0">
                  <Eye className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold font-mono text-foreground">{pr.prNumber}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold">Quality Check</span>
                    <span className="text-[10px] text-muted-foreground">{pr.department}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Supplier: {pr.purchaserSupplierName} · Invoice: {pr.purchaserInvoiceNumber} · Confirmed: {formatDateTime(pr.purchaserConfirmedAt ?? pr.createdAt)}
                  </p>
                  {pr.purchaserConfirmedItems && (
                    <p className="text-[10px] text-emerald-400 mt-0.5">
                      Actual Cost: {formatCurrency(pr.purchaserTotalActualCost ?? 0, "ETB")} · {pr.purchaserConfirmedItems.length} items received
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isQualityRole && (
                    <button onClick={() => openQualityModal(pr)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-all">
                      <ClipboardCheck className="w-3.5 h-3.5" /> Approve & Add to Store
                    </button>
                  )}
                </div>
              </div>
              {/* Confirmed Items Preview */}
              {pr.purchaserConfirmedItems && (
                <div className="border-t border-border/50 px-4 py-3">
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Item", "Unit", "Approved Qty", "Received Qty", "Unit Price", "Total"].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pr.purchaserConfirmedItems.map(ci => (
                          <tr key={ci.itemId} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2 text-xs font-medium text-foreground">{ci.itemName}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{ci.unit}</td>
                            <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{ci.orderedQty}</td>
                            <td className="px-3 py-2">
                              <span className={cn("text-xs font-bold font-mono",
                                ci.receivedQty >= ci.orderedQty ? "text-green-400" : ci.receivedQty > 0 ? "text-amber-400" : "text-red-400"
                              )}>{ci.receivedQty}</span>
                              {ci.receivedQty < ci.orderedQty && <span className="text-[10px] text-red-400 ml-1">(shortage)</span>}
                            </td>
                            <td className="px-3 py-2 text-xs font-mono text-blue-400">{formatCurrency(ci.unitPrice, "ETB")}</td>
                            <td className="px-3 py-2 text-xs font-bold font-mono text-accent">{formatCurrency(ci.totalPrice, "ETB")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Completed Orders</h3>
          <div className="space-y-2">
            {completed.map(pr => {
              const badge = getStatusBadge(pr.status);
              return (
                <div key={pr.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/20 transition-colors">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-foreground">{pr.prNumber}</span>
                      <span className="text-[10px] text-muted-foreground">{pr.department} · {pr.purpose.slice(0, 40)}</span>
                    </div>
                    {pr.purchaserSupplierName && <p className="text-[10px] text-muted-foreground mt-0.5">Supplier: {pr.purchaserSupplierName} · Invoice: {pr.purchaserInvoiceNumber}</p>}
                    {pr.grnReference && <p className="text-[10px] text-emerald-400 mt-0.5">GRN: {pr.grnReference}</p>}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs font-mono font-bold text-muted-foreground">{formatCurrency(pr.totalApprovedCost, "ETB")}</p>
                    {pr.purchaserTotalActualCost && (
                      <p className="text-[10px] font-mono text-emerald-400">Actual: {formatCurrency(pr.purchaserTotalActualCost, "ETB")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {myPRs.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-border bg-card">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold text-foreground">No orders assigned</p>
          <p className="text-xs text-muted-foreground mt-1">Orders will appear here when the Owner assigns them to you</p>
        </div>
      )}

      {/* ─── Purchaser Confirm Receipt Modal ─────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Confirm Goods Received — {confirmModal.prNumber}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Enter real received quantities and actual unit prices</p>
                <p className="text-[10px] text-purple-400 mt-0.5">After confirmation → Storekeeper quality check → Auto added to Main Store</p>
              </div>
              <button onClick={() => setConfirmModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Supplier Name *</label>
                  <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Addis Ababa Trading PLC" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice / Receipt Number *</label>
                  <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="INV-2025-001" />
                </div>
              </div>

              {/* Items with real qty and price */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-3 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Received Items — Enter Actual Quantities & Prices</p>
                  <p className="text-[10px] text-purple-400">Real prices will update ingredient cost in store</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Item", "Unit", "Approved Qty", "Received Qty *", "Unit Price (ETB) *", "Total"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {confirmModal.items.filter(i => !i.zeroed).map(item => {
                      const qty = parseFloat(confirmedQtys[item.id] ?? "0") || 0;
                      const price = parseFloat(confirmedPrices[item.id] ?? "0") || 0;
                      const total = qty * price;
                      return (
                        <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                          <td className="px-3 py-3 text-xs font-medium text-foreground">{item.itemName}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{item.unit}</td>
                          <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{item.approvedQty}</td>
                          <td className="px-3 py-3">
                            <input
                              type="text" inputMode="decimal"
                              value={confirmedQtys[item.id] ?? ""}
                              onChange={e => setConfirmedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-20 px-2 py-1.5 text-xs rounded-lg bg-input border border-blue-500/40 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-mono"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text" inputMode="decimal"
                              value={confirmedPrices[item.id] ?? ""}
                              onChange={e => setConfirmedPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-24 px-2 py-1.5 text-xs rounded-lg bg-input border border-emerald-500/40 text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center font-mono"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-3 text-xs font-bold font-mono text-accent">
                            {total > 0 ? formatCurrency(total, "ETB") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={5} className="px-3 py-2 text-xs font-bold text-right text-foreground">Total Actual Cost:</td>
                      <td className="px-3 py-2 text-sm font-bold font-mono text-accent">
                        {formatCurrency(
                          confirmModal.items.filter(i => !i.zeroed).reduce((s, item) => {
                            const qty = parseFloat(confirmedQtys[item.id] ?? "0") || 0;
                            const price = parseFloat(confirmedPrices[item.id] ?? "0") || 0;
                            return s + qty * price;
                          }, 0),
                          "ETB"
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <textarea value={confirmNotes} onChange={e => setConfirmNotes(e.target.value)} rows={2}
                  placeholder="Any discrepancies, partial deliveries, or quality notes..."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handlePurchaserConfirm} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                Confirm Receipt → Quality Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Quality Approval Modal ───────────────────────────────────────────── */}
      {qualityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Quality Check — {qualityModal.prNumber}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Approve to automatically add items to Main Store inventory</p>
                <p className="text-[10px] text-purple-400 mt-0.5">Items will be created/updated as ingredients in Main Store</p>
              </div>
              <button onClick={() => setQualityModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                <p className="text-xs font-semibold text-purple-400 mb-2">Received Items to Add to Main Store:</p>
                <div className="space-y-1">
                  {qualityModal.purchaserConfirmedItems?.map(ci => (
                    <div key={ci.itemId} className="flex justify-between items-center text-xs">
                      <span className="text-foreground font-medium">{ci.itemName}</span>
                      <span className="text-muted-foreground font-mono">{ci.receivedQty} {ci.unit} @ {formatCurrency(ci.unitPrice, "ETB")}/unit</span>
                      <span className="text-emerald-400 font-bold font-mono">{formatCurrency(ci.totalPrice, "ETB")}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/50 pt-1 flex justify-between font-bold text-xs">
                    <span className="text-foreground">Total Actual Cost</span>
                    <span className="text-accent font-mono">{formatCurrency(qualityModal.purchaserTotalActualCost ?? 0, "ETB")}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quality Notes</label>
                <textarea value={qualityNotes} onChange={e => setQualityNotes(e.target.value)} rows={3}
                  placeholder="Quality inspection notes — any defects, acceptable condition, temperature check, etc."
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setQualityModal(null)} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleQualityApprove} className="flex-1 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700">
                ✓ Approve Quality → Add to Main Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Vendor Split Modal ───────────────────────────────────────────────── */}
      {splitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Split {splitModal.prNumber} into Vendor Orders</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Assign items to different vendors</p>
              </div>
              <button onClick={() => setSplitModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Add Vendor</p>
                <div className="flex gap-2">
                  <input value={newVendorName} onChange={e => setNewVendorName(e.target.value)} placeholder="Vendor name *"
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input value={newVendorContact} onChange={e => setNewVendorContact(e.target.value)} placeholder="Contact / phone"
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={addVendor} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {vendorOrders.map(vo => (
                  <div key={vo.id} className="flex items-center gap-2 text-xs text-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span className="font-medium">{vo.vendorName}</span>
                    {vo.vendorContact && <span className="text-muted-foreground">· {vo.vendorContact}</span>}
                  </div>
                ))}
              </div>
              {vendorOrders.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Assign Items to Vendors</p>
                  </div>
                  {splitModal.items.filter(i => !i.zeroed).map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-0">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">{item.itemName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.approvedQty} {item.unit}</p>
                      </div>
                      <select value={splitItemVendor[item.id] ?? ""} onChange={e => setSplitItemVendor(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option value="">Unassigned</option>
                        {vendorOrders.map(vo => <option key={vo.id} value={vo.id}>{vo.vendorName}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setSplitModal(null)} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={saveSplit} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Save Vendor Split</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
