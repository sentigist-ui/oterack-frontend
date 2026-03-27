import { useState, useMemo } from "react";
import {
  ShoppingBag, Plus, Search, XCircle, AlertTriangle,
  Clock, Truck, ChevronDown, ChevronUp, DollarSign, Trash2,
  ChefHat, Wine, Shield, PackageCheck, Download,
} from "lucide-react";
import { exportStoreRequestsPDF } from "@/lib/pdfExport";
import AppLayout from "@/components/layout/AppLayout";
import { useStoreRequests } from "@/hooks/useStoreRequests";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDateTime, generateId, cn } from "@/lib/utils";
import type { StoreRequest, StoreRequestItem, StoreRequestStatus } from "@/types";
import { toast } from "sonner";
import { Settings } from "@/lib/storage";

const STATUS_CONFIG: Record<StoreRequestStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:              { label: "Pending Review",    color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30" },
  manager_approved:     { label: "Manager Approved",  color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30" },
  manager_rejected:     { label: "Manager Rejected",  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" },
  finance_approved:     { label: "Finance Approved",  color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30" },
  finance_rejected:     { label: "Finance Rejected",  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" },
  fulfilled:            { label: "Fulfilled",          color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/30" },
  partially_fulfilled:  { label: "Partially Fulfilled",color: "text-cyan-400",  bg: "bg-cyan-500/10",   border: "border-cyan-500/30" },
};

// Approval pipeline steps
const PIPELINE_STEPS = ["Requested", "Manager Review", "Finance Approval", "Storekeeper Fulfillment", "Done"];

function getPipelineStep(status: StoreRequestStatus): number {
  switch (status) {
    case "pending": return 1;
    case "manager_approved": return 2;
    case "manager_rejected": return -1;
    case "finance_approved": return 3;
    case "finance_rejected": return -1;
    case "fulfilled":
    case "partially_fulfilled": return 4;
    default: return 0;
  }
}

// ─── Request Form ─────────────────────────────────────────────────────────────
function RequestForm({
  ingredients,
  onSubmit,
  onClose,
  userRole,
  userName,
  userId,
}: {
  ingredients: ReturnType<typeof useInventory>["ingredients"];
  onSubmit: (req: StoreRequest) => void;
  onClose: () => void;
  userRole: string;
  userName: string;
  userId: string;
}) {
  const [destination, setDestination] = useState<"Kitchen" | "Bar">("Kitchen");
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");
  const [items, setItems] = useState<StoreRequestItem[]>([]);
  const [selIngredient, setSelIngredient] = useState("");
  const [selQty, setSelQty] = useState("");
  const [selNotes, setSelNotes] = useState("");

  const addItem = () => {
    const ing = ingredients.find(i => i.id === selIngredient);
    const qty = parseFloat(selQty);
    if (!ing) { toast.error("Select an ingredient"); return; }
    if (!qty || qty <= 0) { toast.error("Enter valid quantity"); return; }
    if (items.find(i => i.ingredientId === ing.id)) { toast.error("Item already in request"); return; }
    setItems(prev => [...prev, {
      ingredientId: ing.id,
      ingredientName: ing.name,
      unit: ing.unit,
      requestedQty: qty,
      approvedQty: qty,
      fulfilledQty: 0,
      unitCost: ing.costPerUnit,
      totalCost: qty * ing.costPerUnit,
      notes: selNotes,
      zeroed: false,
    }]);
    setSelIngredient(""); setSelQty(""); setSelNotes("");
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    const req: StoreRequest = {
      id: generateId(),
      requestNumber: `REQ-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split("T")[0],
      destination,
      requestedBy: userId,
      requestedByName: userName,
      items,
      totalRequestedCost: items.reduce((s, i) => s + i.totalCost, 0),
      totalApprovedCost: items.reduce((s, i) => s + i.totalCost, 0),
      status: "pending",
      createdAt: new Date().toISOString(),
      urgency,
    };
    onSubmit(req);
    toast.success(`Store request ${req.requestNumber} submitted`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">New Store Request</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Request items from main store → Manager → Finance → Storekeeper</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Destination + Urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Destination *</label>
              <div className="flex gap-2">
                {(["Kitchen", "Bar"] as const).map(d => (
                  <button key={d} onClick={() => setDestination(d)}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                      destination === d ? "bg-primary/20 border-primary/50 text-primary" : "bg-muted/30 border-border text-muted-foreground"
                    )}>
                    {d === "Kitchen" ? <ChefHat className="w-3.5 h-3.5" /> : <Wine className="w-3.5 h-3.5" />}
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Priority</label>
              <div className="flex gap-2">
                {(["normal", "urgent"] as const).map(u => (
                  <button key={u} onClick={() => setUrgency(u)}
                    className={cn("flex-1 py-2.5 rounded-lg border text-xs font-semibold capitalize transition-all",
                      urgency === u
                        ? u === "urgent" ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-muted border-border text-foreground"
                        : "bg-muted/30 border-border text-muted-foreground"
                    )}>
                    {u === "urgent" ? "🚨 Urgent" : "Normal"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add Item */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Add Items to Request</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Ingredient</label>
                <select value={selIngredient} onChange={e => setSelIngredient(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select ingredient...</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.currentQuantity} {i.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Quantity Needed</label>
                <input type="text" inputMode="decimal" value={selQty} onChange={e => setSelQty(e.target.value)}
                  placeholder="e.g. 5.5"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
              <input value={selNotes} onChange={e => setSelNotes(e.target.value)} placeholder="Reason for request..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <button onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Ingredient", "Qty", "Unit", "Est. Cost", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.ingredientId} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-xs font-medium text-foreground">{item.ingredientName}</td>
                      <td className="px-3 py-2 text-xs font-mono text-foreground">{item.requestedQty}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.unit}</td>
                      <td className="px-3 py-2 text-xs font-mono text-accent">{formatCurrency(item.totalCost, "ETB")}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-muted/20 text-right">
                <span className="text-xs font-semibold text-foreground">Total Est. Cost: </span>
                <span className="text-xs font-bold font-mono text-accent">{formatCurrency(items.reduce((s, i) => s + i.totalCost, 0), "ETB")}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={handleSubmit} disabled={items.length === 0}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Review Modal (Manager / Finance) ─────────────────────────────────────────
function ReviewModal({
  req,
  reviewerRole,
  reviewerName,
  onApprove,
  onReject,
  onClose,
}: {
  req: StoreRequest;
  reviewerRole: "manager" | "finance";
  reviewerName: string;
  onApprove: (adjustments: Record<string, number | "zero">, notes: string) => void;
  onReject: (notes: string) => void;
  onClose: () => void;
}) {
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [zeroed, setZeroed] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = () => {
    const adjMap: Record<string, number | "zero"> = {};
    req.items.forEach(item => {
      if (zeroed[item.ingredientId]) { adjMap[item.ingredientId] = "zero"; return; }
      const val = parseFloat(adjustments[item.ingredientId] ?? String(item.approvedQty));
      if (!isNaN(val)) adjMap[item.ingredientId] = val;
    });
    onApprove(adjMap, notes);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">
              {reviewerRole === "manager" ? "Manager Review" : "Finance Review"} — {req.requestNumber}
            </h2>
            <p className="text-xs text-muted-foreground">
              {reviewerRole === "manager" ? "Approve, adjust quantities, or zero items. Then send to Finance." : "Final approval. Adjust or zero items before storekeeper fulfills."}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Request Info */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="stat-card">
              <p className="text-muted-foreground">Requested by</p>
              <p className="font-semibold text-foreground">{req.requestedByName}</p>
            </div>
            <div className="stat-card">
              <p className="text-muted-foreground">Destination</p>
              <p className="font-semibold text-foreground">{req.destination}</p>
            </div>
            <div className={cn("stat-card", req.urgency === "urgent" && "border-red-500/30 bg-red-500/5")}>
              <p className="text-muted-foreground">Priority</p>
              <p className={cn("font-semibold", req.urgency === "urgent" ? "text-red-400" : "text-foreground")}>{req.urgency.toUpperCase()}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Ingredient</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Requested</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Adjust Qty</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Zero Item</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {req.items.map(item => {
                  const isZeroed = zeroed[item.ingredientId] || item.zeroed;
                  const adjVal = adjustments[item.ingredientId] ?? String(item.approvedQty);
                  const cost = isZeroed ? 0 : (parseFloat(adjVal) || item.approvedQty) * item.unitCost;
                  return (
                    <tr key={item.ingredientId} className={cn("border-b border-border/50 last:border-0", isZeroed && "opacity-50 bg-muted/20")}>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-foreground">{item.ingredientName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.unit}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-foreground">{item.requestedQty}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text" inputMode="decimal" disabled={isZeroed || item.zeroed}
                          value={isZeroed ? "0" : adjVal}
                          onChange={e => setAdjustments(prev => ({ ...prev, [item.ingredientId]: e.target.value }))}
                          className="w-20 px-2 py-1 text-xs font-mono rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" disabled={item.zeroed}
                            checked={isZeroed}
                            onChange={e => setZeroed(prev => ({ ...prev, [item.ingredientId]: e.target.checked }))}
                            className="rounded border-border"
                          />
                          <span className="text-[10px] text-muted-foreground">Zero</span>
                        </label>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-accent">{formatCurrency(cost, "ETB")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {rejecting ? "Rejection Reason *" : "Review Notes (optional)"}
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={rejecting ? "Explain why this request is rejected..." : "Add any notes or conditions..."}
              className="w-full px-3 py-2 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="py-2.5 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() => { setRejecting(true); if (rejecting) { if (!notes.trim()) { toast.error("Provide rejection reason"); return; } onReject(notes); } }}
            className="py-2.5 px-4 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-600/30">
            {rejecting ? "Confirm Reject" : "Reject"}
          </button>
          <button onClick={handleApprove}
            className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
            {reviewerRole === "manager" ? "Approve → Send to Finance" : "Approve → Send to Storekeeper"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fulfill Modal (Storekeeper) ──────────────────────────────────────────────
function FulfillModal({
  req,
  onFulfill,
  onClose,
}: {
  req: StoreRequest;
  onFulfill: (qtys: Record<string, number>) => void;
  onClose: () => void;
}) {
  const [qtys, setQtys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    req.items.forEach(i => { if (!i.zeroed) init[i.ingredientId] = String(i.approvedQty); });
    return init;
  });

  const handleFulfill = () => {
    const map: Record<string, number> = {};
    req.items.forEach(item => {
      if (item.zeroed) return;
      const val = parseFloat(qtys[item.ingredientId] ?? "0");
      if (val > item.approvedQty) { toast.error(`Cannot exceed approved qty for ${item.ingredientName}`); return; }
      map[item.ingredientId] = val;
    });
    onFulfill(map);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl fade-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Fulfill Request — {req.requestNumber}</h2>
            <p className="text-xs text-muted-foreground">Send items to {req.destination}. Items deducted from Main Store.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 flex items-start gap-3">
            <PackageCheck className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <p className="text-xs text-green-300">Finance has approved this request. Enter the actual quantity you are sending to {req.destination}.</p>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Ingredient</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Approved</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase">Send Qty</th>
                </tr>
              </thead>
              <tbody>
                {req.items.map(item => (
                  <tr key={item.ingredientId} className={cn("border-b border-border/50 last:border-0", item.zeroed && "opacity-40")}>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium text-foreground">{item.ingredientName}</p>
                      <p className="text-[10px] text-muted-foreground">{item.unit}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-green-400">{item.zeroed ? "Zeroed" : item.approvedQty}</td>
                    <td className="px-3 py-2.5">
                      {item.zeroed ? (
                        <span className="text-[10px] text-muted-foreground">N/A</span>
                      ) : (
                        <input
                          type="text" inputMode="decimal"
                          value={qtys[item.ingredientId] ?? ""}
                          onChange={e => setQtys(prev => ({ ...prev, [item.ingredientId]: e.target.value }))}
                          className="w-24 px-2 py-1 text-xs font-mono rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={handleFulfill}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
            <Truck className="w-4 h-4 inline mr-2" />Send to {req.destination}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StoreRequestsPage() {
  const { user } = useAuth();
  const { ingredients } = useInventory();
  const {
    requests, createRequest,
    managerApprove, managerReject,
    financeApprove, financeReject,
    fulfill,
    pendingForManager, pendingForFinance, pendingForStorekeeper,
  } = useStoreRequests();
  const settings = Settings.get();

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingReq, setReviewingReq] = useState<StoreRequest | null>(null);
  const [fulfillingReq, setFulfillingReq] = useState<StoreRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<StoreRequestStatus | "all">("all");
  const [search, setSearch] = useState("");

  const role = user?.role ?? "";
  const canCreate = ["kitchen", "admin", "manager", "finance"].includes(role);
  const canManagerReview = ["admin", "manager"].includes(role);
  const canFinanceReview = ["admin", "finance"].includes(role);
  const canFulfill = ["admin", "storekeeper"].includes(role);

  const filtered = useMemo(() => {
    return requests
      .filter(r => statusFilter === "all" || r.status === statusFilter)
      .filter(r =>
        r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.requestedByName.toLowerCase().includes(search.toLowerCase()) ||
        r.destination.toLowerCase().includes(search.toLowerCase())
      );
  }, [requests, statusFilter, search]);

  const myPendingCount =
    (canManagerReview ? pendingForManager.length : 0) +
    (canFinanceReview ? pendingForFinance.length : 0) +
    (canFulfill ? pendingForStorekeeper.length : 0);

  return (
    <AppLayout>
      {/* Urgent alert */}
      {myPendingCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {myPendingCount} request{myPendingCount > 1 ? "s" : ""} awaiting your action
            </p>
            <p className="text-xs text-amber-400/70">
              {canManagerReview && pendingForManager.length > 0 && `${pendingForManager.length} pending manager review · `}
              {canFinanceReview && pendingForFinance.length > 0 && `${pendingForFinance.length} pending finance approval · `}
              {canFulfill && pendingForStorekeeper.length > 0 && `${pendingForStorekeeper.length} ready to fulfill`}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Requests", value: requests.length, color: "text-foreground" },
          { label: "Pending Review", value: pendingForManager.length, color: pendingForManager.length > 0 ? "text-amber-400" : "text-foreground" },
          { label: "Pending Finance", value: pendingForFinance.length, color: pendingForFinance.length > 0 ? "text-blue-400" : "text-foreground" },
          { label: "Ready to Fulfill", value: pendingForStorekeeper.length, color: pendingForStorekeeper.length > 0 ? "text-green-400" : "text-foreground" },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <p className={cn("text-xl font-bold font-mono", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StoreRequestStatus | "all")}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => exportStoreRequestsPDF(requests.map(r => ({ requestNumber: r.requestNumber, date: r.date, destination: r.destination, requestedByName: r.requestedByName, status: r.status, totalRequestedCost: r.totalRequestedCost, totalApprovedCost: r.totalApprovedCost, urgency: r.urgency, items: r.items.map(i => ({ ingredientName: i.ingredientName, unit: i.unit, requestedQty: i.requestedQty, approvedQty: i.approvedQty, fulfilledQty: i.fulfilledQty, zeroed: i.zeroed })), managerReviewedBy: r.managerReviewedBy, financeReviewedBy: r.financeReviewedBy, fulfilledBy: r.fulfilledBy })), settings.currencySymbol, user?.name ?? 'System')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canCreate && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> New Request
            </button>
          )}
        </div>
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ShoppingBag className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-foreground">No Store Requests</p>
          <p className="text-sm mt-2">Kitchen or Bar teams can submit requests for ingredients from the main store.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const cfg = STATUS_CONFIG[req.status];
            const step = getPipelineStep(req.status);
            const isExpanded = expandedId === req.id;
            const isRejected = req.status === "manager_rejected" || req.status === "finance_rejected";

            return (
              <div key={req.id} className={cn("rounded-xl border bg-card transition-all", cfg.border, isExpanded && "shadow-lg")}>
                {/* Header Row */}
                <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold font-mono text-foreground">{req.requestNumber}</span>
                      {req.urgency === "urgent" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">🚨 URGENT</span>
                      )}
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", cfg.bg, cfg.color, cfg.border)}>{cfg.label}</span>
                      <span className="text-[10px] text-muted-foreground">{req.destination}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      By {req.requestedByName} · {formatDateTime(req.createdAt)} · {req.items.length} items
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold font-mono text-accent">{formatCurrency(req.totalApprovedCost, "ETB")}</p>
                    <p className="text-[10px] text-muted-foreground">approved cost</p>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {canManagerReview && req.status === "pending" && (
                      <button onClick={e => { e.stopPropagation(); setReviewingReq(req); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-semibold hover:bg-blue-700">
                        <Shield className="w-3 h-3" /> Review
                      </button>
                    )}
                    {canFinanceReview && req.status === "manager_approved" && (
                      <button onClick={e => { e.stopPropagation(); setReviewingReq(req); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-[10px] font-semibold hover:bg-green-700">
                        <DollarSign className="w-3 h-3" /> Finance
                      </button>
                    )}
                    {canFulfill && req.status === "finance_approved" && (
                      <button onClick={e => { e.stopPropagation(); setFulfillingReq(req); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90">
                        <Truck className="w-3 h-3" /> Fulfill
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 py-4 space-y-4">
                    {/* Pipeline */}
                    {!isRejected && (
                      <div className="flex items-center gap-1">
                        {PIPELINE_STEPS.map((s, idx) => (
                          <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
                            <div className={cn("flex items-center justify-center w-6 h-6 rounded-full border text-[9px] font-bold shrink-0",
                              idx < step ? "bg-green-500/20 border-green-500/50 text-green-400" :
                              idx === step ? "bg-primary/20 border-primary/50 text-primary" :
                              "bg-muted/30 border-border text-muted-foreground"
                            )}>
                              {idx < step ? "✓" : idx + 1}
                            </div>
                            <span className={cn("text-[9px] font-medium hidden sm:block",
                              idx < step ? "text-green-400" : idx === step ? "text-primary" : "text-muted-foreground"
                            )}>{s}</span>
                            {idx < PIPELINE_STEPS.length - 1 && (
                              <div className={cn("flex-1 h-px mx-1", idx < step ? "bg-green-500/40" : "bg-border")} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isRejected && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-red-400">Request Rejected</p>
                          <p className="text-[10px] text-red-400/70">
                            {req.status === "manager_rejected" ? `By ${req.managerReviewedBy}: ${req.managerNotes}` : `By ${req.financeReviewedBy}: ${req.financeNotes}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Items detail */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            {["Ingredient", "Requested", "Manager Adj.", "Finance Adj.", "Final Approved", "Fulfilled", "Notes"].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {req.items.map(item => (
                            <tr key={item.ingredientId} className={cn("border-b border-border/50 last:border-0", item.zeroed && "opacity-50")}>
                              <td className="px-3 py-2 text-xs font-medium text-foreground">{item.ingredientName} <span className="text-muted-foreground">({item.unit})</span></td>
                              <td className="px-3 py-2 text-xs font-mono">{item.requestedQty}</td>
                              <td className="px-3 py-2 text-xs font-mono text-blue-400">
                                {item.managerAdjustedQty !== undefined && item.managerAdjustedQty !== item.requestedQty ? item.managerAdjustedQty : "—"}
                              </td>
                              <td className="px-3 py-2 text-xs font-mono text-green-400">
                                {item.financeAdjustedQty !== undefined && item.financeAdjustedQty !== (item.managerAdjustedQty ?? item.requestedQty) ? item.financeAdjustedQty : "—"}
                              </td>
                              <td className="px-3 py-2 text-xs font-bold font-mono text-foreground">
                                {item.zeroed ? <span className="text-red-400 text-[10px]">ZEROED</span> : item.approvedQty}
                              </td>
                              <td className="px-3 py-2 text-xs font-mono text-emerald-400">
                                {item.fulfilledQty > 0 ? item.fulfilledQty : "—"}
                              </td>
                              <td className="px-3 py-2 text-[10px] text-muted-foreground">{item.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Approval Notes */}
                    {(req.managerNotes || req.financeNotes) && (
                      <div className="space-y-2">
                        {req.managerNotes && <p className="text-[10px] text-blue-400"><strong>Manager:</strong> {req.managerNotes}</p>}
                        {req.financeNotes && <p className="text-[10px] text-green-400"><strong>Finance:</strong> {req.financeNotes}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && user && (
        <RequestForm
          ingredients={ingredients}
          onSubmit={createRequest}
          onClose={() => setShowForm(false)}
          userRole={role}
          userName={user.name}
          userId={user.id}
        />
      )}

      {reviewingReq && user && (
        <ReviewModal
          req={reviewingReq}
          reviewerRole={canManagerReview && reviewingReq.status === "pending" ? "manager" : "finance"}
          reviewerName={user.name}
          onApprove={(adj, notes) => {
            if (reviewingReq.status === "pending") {
              managerApprove(reviewingReq.id, user.name, adj, notes);
              toast.success("Request approved and sent to Finance");
            } else {
              financeApprove(reviewingReq.id, user.name, adj, notes);
              toast.success("Request approved and sent to Storekeeper");
            }
            setReviewingReq(null);
          }}
          onReject={(notes) => {
            if (reviewingReq.status === "pending") {
              managerReject(reviewingReq.id, user.name, notes);
              toast.error("Request rejected by Manager");
            } else {
              financeReject(reviewingReq.id, user.name, notes);
              toast.error("Request rejected by Finance");
            }
            setReviewingReq(null);
          }}
          onClose={() => setReviewingReq(null)}
        />
      )}

      {fulfillingReq && user && (
        <FulfillModal
          req={fulfillingReq}
          onFulfill={(qtys) => {
            fulfill(fulfillingReq.id, user.name, qtys);
            toast.success(`Items sent to ${fulfillingReq.destination} store`);
            setFulfillingReq(null);
          }}
          onClose={() => setFulfillingReq(null)}
        />
      )}
    </AppLayout>
  );
}
