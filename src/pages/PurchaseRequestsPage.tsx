import { useState, useMemo } from "react";
import {
  ShoppingCart, Plus, Search, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, XCircle, Truck, Package, Trash2, Download, Edit2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { usePurchaseRequests } from "@/hooks/usePurchaseRequests";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDateTime, generateId, cn } from "@/lib/utils";
import type { PurchaseRequest, PRItem, PRStatus } from "@/types";
import { toast } from "sonner";
import { Users, Settings } from "@/lib/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_CONFIG: Record<PRStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:               { label: "Pending (Storekeeper)",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  storekeeper_review:    { label: "At Storekeeper",          color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
  finance_review:        { label: "Finance Reviewing",       color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
  finance_approved:      { label: "Finance Approved",        color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
  finance_rejected:      { label: "Finance Rejected",        color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
  owner_approved:        { label: "Owner Approved",          color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30" },
  owner_rejected:        { label: "Owner Rejected",          color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
  sent_to_purchaser:     { label: "Sent to Purchaser",       color: "text-primary",     bg: "bg-primary/10",     border: "border-primary/30" },
  purchaser_confirmed:   { label: "Purchaser Confirmed",     color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/30" },
  quality_check:         { label: "Quality Inspection",      color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  grn_received:          { label: "GRN Received",            color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  closed:                { label: "Closed",                  color: "text-muted-foreground", bg: "bg-muted/20",  border: "border-border" },
};

const PIPELINE_LABELS = ["Submitted", "Storekeeper", "Finance", "Owner", "Purchaser", "GRN Done"];

function getPipelineStep(status: PRStatus): number {
  switch (status) {
    case "pending": return 1;
    case "storekeeper_review": case "finance_review": return 2;
    case "finance_approved": return 3;
    case "owner_approved": case "sent_to_purchaser": return 4;
    case "grn_received": return 5;
    case "closed": return 5;
    case "finance_rejected": case "owner_rejected": return -1;
    default: return 0;
  }
}

export default function PurchaseRequestsPage() {
  const { user } = useAuth();
  const {
    requests, createPR, storekeeperForward, financeApprove, financeReject,
    ownerApprove, ownerReject, purchaserReceive,
    pendingForStorekeeper, pendingForFinance, pendingForOwner, pendingForPurchaser,
  } = usePurchaseRequests();
  const settings = Settings.get();

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PRStatus | "all">("all");

  // Form state
  const [formItems, setFormItems] = useState<PRItem[]>([]);
  const [formPurpose, setFormPurpose] = useState("");
  const [formDept, setFormDept] = useState("Kitchen");
  const [formUrgency, setFormUrgency] = useState<"normal" | "urgent">("normal");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");

  // Action modals
  const [actionPR, setActionPR] = useState<PurchaseRequest | null>(null);
  // actionStep: which role's action we are performing
  const [actionStep, setActionStep] = useState<"storekeeper" | "finance" | "owner" | "grn" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [grnRef, setGrnRef] = useState("");
  const [selectedPurchaser, setSelectedPurchaser] = useState("");
  const [rejecting, setRejecting] = useState(false);
  // Owner item qty adjustments
  const [ownerItemQtys, setOwnerItemQtys] = useState<Record<string, string>>({});
  const [ownerZeroed, setOwnerZeroed] = useState<Record<string, boolean>>({});

  const allUsers = Users.getAll();
  const purchasers = allUsers.filter(u => u.role === "purchaser");

  const role = user?.role ?? "";
  const isAdmin = role === "admin";

  // Admin can act at any step
  const canStorekeeperAct = isAdmin || role === "storekeeper";
  const canFinanceAct = isAdmin || role === "finance";
  const canOwnerAct = isAdmin || role === "owner";
  const canPurchaserAct = isAdmin || role === "purchaser";
  const canCreate = ["kitchen", "hod", "storekeeper", "admin", "manager"].includes(role);

  const myPendingCount =
    (canStorekeeperAct ? pendingForStorekeeper.length : 0) +
    (canFinanceAct ? pendingForFinance.length : 0) +
    (canOwnerAct ? pendingForOwner.length : 0) +
    (canPurchaserAct ? pendingForPurchaser.length : 0);

  // Determine which action button to show per PR — admin sees all applicable ones
  const getActionBtn = (pr: PurchaseRequest) => {
    const btns: { label: string; step: "storekeeper" | "finance" | "owner" | "grn"; color: string }[] = [];
    if (canStorekeeperAct && pr.status === "pending" && ["kitchen", "hod", "kitchen"].includes(pr.requestedByRole))
      btns.push({ label: "Forward →Finance", step: "storekeeper", color: "bg-blue-600 hover:bg-blue-700" });
    if (canFinanceAct && (pr.status === "storekeeper_review" || (pr.status === "pending" && pr.requestedByRole === "storekeeper") || (isAdmin && pr.status === "pending")))
      btns.push({ label: "Finance Review", step: "finance", color: "bg-purple-600 hover:bg-purple-700" });
    if (canOwnerAct && (pr.status === "finance_approved" || (isAdmin && ["finance_review","storekeeper_review","pending"].includes(pr.status))))
      btns.push({ label: "Owner Decision", step: "owner", color: "bg-green-600 hover:bg-green-700" });
    if (canPurchaserAct && pr.status === "sent_to_purchaser")
      btns.push({ label: "Record GRN", step: "grn", color: "bg-primary hover:bg-primary/90" });
    return btns;
  };

  const filtered = useMemo(() => {
    return requests
      .filter(r => statusFilter === "all" || r.status === statusFilter)
      .filter(r =>
        r.prNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.requestedByName.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase()) ||
        r.purpose.toLowerCase().includes(search.toLowerCase())
      );
  }, [requests, statusFilter, search]);

  const addFormItem = () => {
    if (!newItemName.trim()) { toast.error("Item name required"); return; }
    const qty = parseFloat(newItemQty);
    const cost = parseFloat(newItemCost);
    if (!qty || qty <= 0) { toast.error("Enter valid quantity"); return; }
    setFormItems(prev => [...prev, {
      id: generateId(), itemName: newItemName.trim(), unit: newItemUnit,
      requestedQty: qty, approvedQty: qty,
      estimatedUnitCost: cost || 0, estimatedTotalCost: (cost || 0) * qty,
      notes: newItemNotes, zeroed: false,
    }]);
    setNewItemName(""); setNewItemQty(""); setNewItemCost(""); setNewItemNotes("");
  };

  const removeFormItem = (id: string) => setFormItems(prev => prev.filter(i => i.id !== id));

  const handleSubmitPR = () => {
    if (formItems.length === 0) { toast.error("Add at least one item"); return; }
    if (!formPurpose.trim()) { toast.error("Purpose/reason required"); return; }
    const isStorekeeperReq = role === "storekeeper";
    const pr: PurchaseRequest = {
      id: generateId(),
      prNumber: `PR-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split("T")[0],
      requestedBy: user!.id,
      requestedByName: user!.name,
      requestedByRole: role,
      department: formDept,
      items: formItems,
      totalEstimatedCost: formItems.reduce((s, i) => s + i.estimatedTotalCost, 0),
      totalApprovedCost: formItems.reduce((s, i) => s + i.estimatedTotalCost, 0),
      // Storekeeper PRs go directly to finance, kitchen/hod/others go to storekeeper first
      status: isStorekeeperReq ? "finance_review" : "pending",
      urgency: formUrgency,
      purpose: formPurpose,
      createdAt: new Date().toISOString(),
    };
    createPR(pr);
    toast.success(`PR ${pr.prNumber} submitted — ${isStorekeeperReq ? "sent to Finance" : "sent to Storekeeper"}`);
    setShowForm(false);
    setFormItems([]); setFormPurpose(""); setFormDept("Kitchen"); setFormUrgency("normal");
  };

  const openAction = (pr: PurchaseRequest, step: "storekeeper" | "finance" | "owner" | "grn") => {
    setActionPR(pr);
    setActionStep(step);
    setActionNotes("");
    setGrnRef(`GRN-${Date.now().toString().slice(-6)}`);
    setRejecting(false);
    setSelectedPurchaser("");
    // Init owner qty adjustments
    if (step === "owner") {
      const initQtys: Record<string, string> = {};
      const initZeroed: Record<string, boolean> = {};
      pr.items.forEach(i => { initQtys[i.id] = String(i.approvedQty); initZeroed[i.id] = i.zeroed ?? false; });
      setOwnerItemQtys(initQtys);
      setOwnerZeroed(initZeroed);
    }
  };

  const handleAction = () => {
    if (!actionPR || !actionStep) return;
    if (rejecting && !actionNotes.trim()) { toast.error("Rejection reason required"); return; }

    if (actionStep === "storekeeper") {
      storekeeperForward(actionPR.id, user!.name, actionNotes);
      toast.success("PR forwarded to Finance");
    } else if (actionStep === "finance") {
      if (rejecting) { financeReject(actionPR.id, user!.name, actionNotes); toast.success("PR rejected by Finance"); }
      else { financeApprove(actionPR.id, user!.name, actionNotes); toast.success("PR approved — sent to Owner"); }
    } else if (actionStep === "owner") {
      if (rejecting) { ownerReject(actionPR.id, user!.name, actionNotes); toast.success("PR rejected by Owner"); }
      else {
        if (!selectedPurchaser) { toast.error("Select a purchaser"); return; }
        const purchaser = allUsers.find(u => u.id === selectedPurchaser);
        // Build adjusted items
        const adjustedItems: PRItem[] = actionPR.items.map(item => {
          if (ownerZeroed[item.id]) return { ...item, zeroed: true, approvedQty: 0, estimatedTotalCost: 0 };
          const qty = parseFloat(ownerItemQtys[item.id] ?? String(item.approvedQty));
          const safeQty = isNaN(qty) ? item.approvedQty : Math.min(qty, item.approvedQty);
          return { ...item, approvedQty: safeQty, estimatedTotalCost: safeQty * item.estimatedUnitCost };
        });
        ownerApprove(actionPR.id, user!.name, actionNotes, selectedPurchaser, purchaser?.name ?? "", adjustedItems);
        toast.success("PR approved — sent to Purchaser");
      }
    } else if (actionStep === "grn") {
      if (!grnRef.trim()) { toast.error("GRN reference required"); return; }
      purchaserReceive(actionPR.id, user!.name, grnRef, actionNotes);
      toast.success("GRN recorded — goods received");
    }
    setActionPR(null); setActionStep(null); setActionNotes(""); setGrnRef(""); setRejecting(false); setSelectedPurchaser("");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(37, 99, 235); doc.rect(0, 28, pw, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text(settings.hotelName, 14, 11);
    doc.setFontSize(9); doc.text("Purchase Requests Report", pw - 14, 11, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()} by ${user?.name}`, 14, 20);
    autoTable(doc, {
      startY: 36,
      head: [["PR No.", "Date", "Dept", "Requested By", "Purpose", "Items", "Approved Cost (ETB)", "Priority", "Status", "GRN Ref"]],
      body: filtered.map(r => [
        r.prNumber, r.date, r.department, r.requestedByName,
        r.purpose.slice(0, 50),
        r.items.map(i => `${i.itemName}: ${i.approvedQty} ${i.unit}`).join("; ").slice(0, 80),
        r.totalApprovedCost.toFixed(2), r.urgency.toUpperCase(),
        r.status.replace(/_/g, " ").toUpperCase(), r.grnReference ?? "—",
      ]),
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { cellWidth: 40 }, 5: { cellWidth: 60 } },
      margin: { left: 10, right: 10 },
    });
    doc.save(`PurchaseRequests_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exported");
  };

  return (
    <AppLayout>
      {/* Pipeline Info Banner */}
      <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 bg-muted/20 text-[10px] text-muted-foreground overflow-x-auto">
        {["Kitchen/Bar/HOD Submits PR", "→ Storekeeper Forwards", "→ Finance Approves", "→ Owner Decides (adjusts items)", "→ Purchaser Procures", "→ GRN Confirmed"].map((s, i) => (
          <span key={i} className={cn("whitespace-nowrap", i === 0 ? "font-semibold text-foreground" : "")}>{s}</span>
        ))}
        <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold whitespace-nowrap">⚠ No GRN without approved PR</span>
      </div>

      {myPendingCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm font-semibold text-amber-300">
            {myPendingCount} request{myPendingCount > 1 ? "s" : ""} awaiting your action ·
            {canStorekeeperAct && pendingForStorekeeper.length > 0 && ` ${pendingForStorekeeper.length} from Kitchen/Bar`}
            {canFinanceAct && pendingForFinance.length > 0 && ` · ${pendingForFinance.length} pending Finance`}
            {canOwnerAct && pendingForOwner.length > 0 && ` · ${pendingForOwner.length} pending Owner`}
            {canPurchaserAct && pendingForPurchaser.length > 0 && ` · ${pendingForPurchaser.length} for procurement`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total PRs", value: requests.length, color: "" },
          { label: "Pending", value: pendingForStorekeeper.length + pendingForFinance.length, color: "text-amber-400" },
          { label: "With Owner/Purchaser", value: pendingForOwner.length + pendingForPurchaser.length, color: "text-green-400" },
          { label: "GRN Complete", value: requests.filter(r => ["grn_received","closed"].includes(r.status)).length, color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <p className={cn("text-xl font-bold font-mono", s.color || "text-foreground")}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PR..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as PRStatus | "all")}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="all">All Status</option>
          {(Object.keys(STATUS_CONFIG) as PRStatus[]).map(k => <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canCreate && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> New PR
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ShoppingCart className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-foreground">No Purchase Requests</p>
          <p className="text-xs mt-2 text-amber-400">⚠️ No GRN can be processed without an approved PR.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pr => {
            const cfg = STATUS_CONFIG[pr.status];
            const step = getPipelineStep(pr.status);
            const isExpanded = expandedId === pr.id;
            const isRejected = pr.status === "finance_rejected" || pr.status === "owner_rejected";
            const actionBtns = getActionBtn(pr);

            return (
              <div key={pr.id} className={cn("rounded-xl border bg-card transition-all", cfg.border, isExpanded && "shadow-lg")}>
                <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : pr.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold font-mono text-foreground">{pr.prNumber}</span>
                      {pr.urgency === "urgent" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">🚨 URGENT</span>}
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", cfg.bg, cfg.color, cfg.border)}>{cfg.label}</span>
                      <span className="text-[10px] text-muted-foreground">{pr.department}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      By {pr.requestedByName} ({pr.requestedByRole}) · {formatDateTime(pr.createdAt)} · {pr.items.length} items · {pr.purpose.slice(0, 50)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono text-accent">{formatCurrency(pr.totalApprovedCost, "ETB")}</p>
                    <p className="text-[10px] text-muted-foreground">approved cost</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[280px]">
                    {actionBtns.map(btn => (
                      <button key={btn.step}
                        onClick={e => { e.stopPropagation(); openAction(pr, btn.step); }}
                        className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-[10px] font-semibold transition-colors", btn.color)}>
                        {btn.step === "grn" && <Truck className="w-3 h-3" />}
                        {btn.label}
                      </button>
                    ))}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/50 px-4 py-4 space-y-4">
                    {/* Pipeline */}
                    {!isRejected && (
                      <div className="flex items-center gap-1">
                        {PIPELINE_LABELS.map((s, idx) => (
                          <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
                            <div className={cn("flex items-center justify-center w-6 h-6 rounded-full border text-[9px] font-bold shrink-0",
                              idx < step ? "bg-green-500/20 border-green-500/50 text-green-400" :
                              idx === step ? "bg-primary/20 border-primary/50 text-primary" :
                              "bg-muted/30 border-border text-muted-foreground"
                            )}>{idx < step ? "✓" : idx + 1}</div>
                            <span className={cn("text-[9px] font-medium hidden sm:block",
                              idx < step ? "text-green-400" : idx === step ? "text-primary" : "text-muted-foreground"
                            )}>{s}</span>
                            {idx < PIPELINE_LABELS.length - 1 && (
                              <div className={cn("flex-1 h-px mx-1", idx < step ? "bg-green-500/40" : "bg-border")} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {isRejected && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-xs text-red-400 font-semibold">
                          Rejected by {pr.status === "finance_rejected" ? pr.financeReviewedBy : pr.ownerReviewedBy} — {pr.status === "finance_rejected" ? pr.financeNotes : pr.ownerNotes}
                        </p>
                      </div>
                    )}

                    {/* Items */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            {["Item", "Unit", "Requested", "Approved Qty", "Est. Unit Cost", "Est. Total", "Notes"].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pr.items.map(item => (
                            <tr key={item.id} className={cn("border-b border-border/50 last:border-0", item.zeroed && "opacity-50 line-through")}>
                              <td className="px-3 py-2 text-xs font-medium text-foreground">{item.itemName}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{item.unit}</td>
                              <td className="px-3 py-2 text-xs font-mono">{item.requestedQty}</td>
                              <td className="px-3 py-2 text-xs font-bold font-mono text-foreground">
                                {item.zeroed ? <span className="text-red-400 text-[10px] no-underline">ZEROED</span> : item.approvedQty}
                              </td>
                              <td className="px-3 py-2 text-xs font-mono">{item.estimatedUnitCost > 0 ? formatCurrency(item.estimatedUnitCost, "ETB") : "—"}</td>
                              <td className="px-3 py-2 text-xs font-mono text-accent">{!item.zeroed && item.estimatedTotalCost > 0 ? formatCurrency(item.estimatedTotalCost, "ETB") : "—"}</td>
                              <td className="px-3 py-2 text-[10px] text-muted-foreground">{item.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Approval Trail */}
                    <div className="space-y-1 text-[10px]">
                      {pr.storekeeperNotes && <p className="text-blue-400"><strong>Storekeeper ({pr.storekeeperReviewedBy}):</strong> {pr.storekeeperNotes}</p>}
                      {pr.financeNotes && <p className="text-purple-400"><strong>Finance ({pr.financeReviewedBy}):</strong> {pr.financeNotes}</p>}
                      {pr.ownerNotes && <p className="text-green-400"><strong>Owner ({pr.ownerReviewedBy}):</strong> {pr.ownerNotes}</p>}
                      {pr.purchaserAssignedName && <p className="text-primary"><strong>Assigned Purchaser:</strong> {pr.purchaserAssignedName}</p>}
                      {pr.grnReference && <p className="text-emerald-400"><strong>GRN Reference:</strong> {pr.grnReference}</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New PR Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">New Purchase Request</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Kitchen/Bar/HOD → Storekeeper → Finance → Owner → Purchaser</p>
                <p className="text-xs text-amber-400 mt-0.5">⚠️ No GRN will be accepted without an approved PR</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Department</label>
                  <select value={formDept} onChange={e => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {["Kitchen", "Bar", "Store", "F&B", "Events", "Other"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
                  <div className="flex gap-2">
                    {(["normal", "urgent"] as const).map(u => (
                      <button key={u} onClick={() => setFormUrgency(u)}
                        className={cn("flex-1 py-2 rounded-lg border text-xs font-semibold capitalize",
                          formUrgency === u
                            ? u === "urgent" ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-muted border-border text-foreground"
                            : "bg-muted/30 border-border text-muted-foreground"
                        )}>{u === "urgent" ? "🚨 Urgent" : "Normal"}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Purpose / Reason *</label>
                  <input value={formPurpose} onChange={e => setFormPurpose(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Monthly kitchen restock" />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Add Items</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Item name *"
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                      {["kg", "g", "liter", "ml", "pcs", "bottle", "box", "bag", "dozen"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <input type="text" inputMode="decimal" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} placeholder="Qty *"
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input type="text" inputMode="decimal" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} placeholder="Est. Unit Cost (ETB)"
                    className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input value={newItemNotes} onChange={e => setNewItemNotes(e.target.value)} placeholder="Notes (brand, spec...)"
                    className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={addFormItem}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {formItems.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Item", "Unit", "Qty", "Est. Cost", "Total", ""].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map(item => (
                        <tr key={item.id} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2 text-xs font-medium text-foreground">{item.itemName}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{item.unit}</td>
                          <td className="px-3 py-2 text-xs font-mono">{item.requestedQty}</td>
                          <td className="px-3 py-2 text-xs font-mono">{item.estimatedUnitCost > 0 ? formatCurrency(item.estimatedUnitCost, "ETB") : "—"}</td>
                          <td className="px-3 py-2 text-xs font-mono text-accent">{item.estimatedTotalCost > 0 ? formatCurrency(item.estimatedTotalCost, "ETB") : "—"}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeFormItem(item.id)} className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 bg-muted/20 text-right">
                    <span className="text-xs font-semibold">Total: </span>
                    <span className="text-xs font-bold font-mono text-accent">{formatCurrency(formItems.reduce((s, i) => s + i.estimatedTotalCost, 0), "ETB")}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSubmitPR} disabled={formItems.length === 0}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                Submit PR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionPR && actionStep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">
                  {actionStep === "storekeeper" && "Forward to Finance"}
                  {actionStep === "finance" && `Finance ${rejecting ? "Rejection" : "Approval"}`}
                  {actionStep === "owner" && `Owner ${rejecting ? "Rejection" : "Review & Approval"}`}
                  {actionStep === "grn" && "Record GRN"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{actionPR.prNumber} · {actionPR.department} · {actionPR.purpose}</p>
              </div>
              <button onClick={() => { setActionPR(null); setActionStep(null); setRejecting(false); }} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Items summary / owner edit */}
              {actionStep === "owner" && !rejecting ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Adjust Items (Owner can reduce or zero)</p>
                  </div>
                  {actionPR.items.map(item => (
                    <div key={item.id} className={cn("flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-0", ownerZeroed[item.id] && "opacity-50")}>
                      <div className="flex-1">
                        <p className={cn("text-xs font-medium", ownerZeroed[item.id] ? "line-through text-muted-foreground" : "text-foreground")}>{item.itemName}</p>
                        <p className="text-[10px] text-muted-foreground">Requested: {item.requestedQty} {item.unit}</p>
                      </div>
                      <div className="w-20">
                        <input
                          type="text" inputMode="decimal"
                          disabled={ownerZeroed[item.id]}
                          value={ownerZeroed[item.id] ? "0" : (ownerItemQtys[item.id] ?? String(item.approvedQty))}
                          onChange={e => setOwnerItemQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-full px-2 py-1 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center font-mono disabled:opacity-50"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8">{item.unit}</span>
                      <button
                        onClick={() => setOwnerZeroed(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className={cn("px-2 py-1 rounded text-[10px] font-bold border transition-all",
                          ownerZeroed[item.id]
                            ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : "bg-muted/30 border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30"
                        )}>
                        {ownerZeroed[item.id] ? "↩ Restore" : "Zero"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs space-y-1">
                  {actionPR.items.slice(0, 6).map(i => (
                    <div key={i.id} className="flex justify-between">
                      <span className="text-foreground">{i.itemName}</span>
                      <span className="text-muted-foreground font-mono">{i.approvedQty} {i.unit}</span>
                    </div>
                  ))}
                  {actionPR.items.length > 6 && <p className="text-muted-foreground">+ {actionPR.items.length - 6} more items</p>}
                  <div className="border-t border-border pt-1 flex justify-between font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-accent font-mono">{formatCurrency(actionPR.totalApprovedCost, "ETB")}</span>
                  </div>
                </div>
              )}

              {actionStep === "owner" && !rejecting && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Assign Purchaser *</label>
                  <select value={selectedPurchaser} onChange={e => setSelectedPurchaser(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Select purchaser...</option>
                    {purchasers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {actionStep === "grn" && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">GRN Reference *</label>
                  <input value={grnRef} onChange={e => setGrnRef(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="GRN-2025-001" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {rejecting ? "Rejection Reason *" : "Notes (optional)"}
                </label>
                <textarea value={actionNotes} onChange={e => setActionNotes(e.target.value)} rows={2}
                  placeholder={rejecting ? "Explain why..." : "Any conditions or notes..."}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => { setActionPR(null); setActionStep(null); setRejecting(false); }} className="py-2.5 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              {actionStep !== "storekeeper" && actionStep !== "grn" && (
                <button onClick={() => setRejecting(!rejecting)}
                  className={cn("py-2.5 px-4 rounded-lg border text-sm font-semibold",
                    rejecting ? "bg-red-600/20 border-red-500/40 text-red-400" : "bg-muted/30 border-border text-muted-foreground"
                  )}>
                  {rejecting ? "Cancel" : "Reject"}
                </button>
              )}
              <button onClick={handleAction}
                className={cn("flex-1 py-2.5 rounded-lg text-white text-sm font-semibold",
                  rejecting ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                )}>
                {rejecting ? "Confirm Reject"
                  : actionStep === "storekeeper" ? "Forward to Finance →"
                  : actionStep === "grn" ? "Record GRN Received"
                  : "Approve →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
