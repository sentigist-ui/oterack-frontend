import { useState, useMemo } from "react";
import { CreditCard, Plus, Search, Edit2, Trash2, Download } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, cn } from "@/lib/utils";
import type { AccountPayable } from "@/types";
import { toast } from "sonner";
import { Settings } from "@/lib/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AGING_CONFIG = {
  "0-30":  { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30" },
  "31-60": { color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30" },
  "61+":   { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" },
};

const STATUS_CONFIG = {
  unpaid:         { color: "text-blue-400",    bg: "bg-blue-500/10",    label: "Unpaid" },
  partially_paid: { color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Partial" },
  overdue:        { color: "text-red-400",      bg: "bg-red-500/10",     label: "Overdue" },
  paid:           { color: "text-green-400",    bg: "bg-green-500/10",   label: "Paid" },
};

const CATEGORIES: AccountPayable["category"][] = ["food_supplier", "beverage_supplier", "equipment", "utilities", "other"];
const CAT_LABELS: Record<string, string> = {
  food_supplier: "Food Supplier", beverage_supplier: "Beverage Supplier",
  equipment: "Equipment", utilities: "Utilities", other: "Other",
};

export default function AccountsPayablePage() {
  const { apRecords, apStats, addAP, updateAP, deleteAP, recordAPPayment } = useAccounts();
  const { user } = useAuth();
  const settings = Settings.get();

  const [search, setSearch] = useState("");
  const [agingFilter, setAgingFilter] = useState<"all" | "0-30" | "31-60" | "61+">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountPayable["status"]>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingAP, setEditingAP] = useState<Partial<AccountPayable> | null>(null);
  const [paymentModal, setPaymentModal] = useState<AccountPayable | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");

  const canEdit = user && ["admin", "finance"].includes(user.role);

  const filtered = useMemo(() => {
    return apRecords.filter(r => {
      const matchSearch = r.supplierName.toLowerCase().includes(search.toLowerCase()) || r.invoiceNumber.toLowerCase().includes(search.toLowerCase());
      const matchAging = agingFilter === "all" || r.agingBucket === agingFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchAging && matchStatus;
    });
  }, [apRecords, search, agingFilter, statusFilter]);

  const handleSaveAP = () => {
    if (!editingAP?.supplierName?.trim()) { toast.error("Supplier name required"); return; }
    if (!editingAP.invoiceNumber?.trim()) { toast.error("Invoice number required"); return; }
    if (!editingAP.totalAmount || editingAP.totalAmount <= 0) { toast.error("Amount required"); return; }
    if (editingAP.id) {
      updateAP(editingAP as AccountPayable);
      toast.success("AP record updated");
    } else {
      addAP({
        invoiceNumber: editingAP.invoiceNumber!,
        supplierName: editingAP.supplierName!,
        category: editingAP.category || "food_supplier",
        invoiceDate: editingAP.invoiceDate || new Date().toISOString().split("T")[0],
        dueDate: editingAP.dueDate || new Date().toISOString().split("T")[0],
        totalAmount: editingAP.totalAmount!,
        notes: editingAP.notes,
        createdBy: user!.name,
      } as Parameters<typeof addAP>[0]);
      toast.success("AP record added");
    }
    setShowForm(false); setEditingAP(null);
  };

  const handlePayment = () => {
    if (!paymentModal) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter valid amount"); return; }
    if (amount > paymentModal.outstandingAmount) { toast.error("Exceeds outstanding amount"); return; }
    recordAPPayment(paymentModal.id, amount, payRef || `PMT-${Date.now()}`, user!.name);
    toast.success("Payment recorded");
    setPaymentModal(null); setPayAmount(""); setPayRef("");
  };

  const exportAPPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(37, 99, 235); doc.rect(0, 28, pw, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text(settings.hotelName, 14, 11);
    doc.setFontSize(9); doc.text("Accounts Payable Report", pw - 14, 11, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()} by ${user?.name}`, 14, 20);
    autoTable(doc, {
      startY: 36,
      head: [["Invoice", "Supplier", "Category", "Invoice Date", "Due Date", "Total (ETB)", "Paid (ETB)", "Outstanding (ETB)", "Aging", "Status"]],
      body: filtered.map(r => [
        r.invoiceNumber, r.supplierName, CAT_LABELS[r.category] ?? r.category,
        r.invoiceDate, r.dueDate,
        r.totalAmount.toFixed(2), r.paidAmount.toFixed(2), r.outstandingAmount.toFixed(2),
        r.agingBucket + " days", r.status.replace(/_/g, " ").toUpperCase(),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
    doc.save(`AP_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("AP report exported");
  };

  return (
    <AppLayout>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(apStats.totalOutstanding, "ETB")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Payable</p>
        </div>
        <div className={cn("stat-card text-center", apStats.overdue.length && "border-red-500/30")}>
          <p className={cn("text-xl font-bold font-mono", apStats.overdue.length ? "text-red-400" : "text-foreground")}>{apStats.overdue.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Overdue</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{apRecords.filter(r => r.status !== "paid").length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Open Invoices</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-green-400">{formatCurrency(apRecords.reduce((s, r) => s + r.paidAmount, 0), "ETB")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Paid</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44" />
        </div>
        <select value={agingFilter} onChange={e => setAgingFilter(e.target.value as typeof agingFilter)}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="all">All Aging</option>
          <option value="0-30">0–30 days</option>
          <option value="31-60">31–60 days</option>
          <option value="61+">61+ days</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="all">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportAPPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canEdit && (
            <button onClick={() => { setEditingAP({}); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Invoice
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Invoice No.", "Supplier", "Category", "Invoice Date", "Due Date", "Total (ETB)", "Paid (ETB)", "Outstanding", "Aging", "Status", "Actions"].map(h => (
                <th key={h} className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const aging = AGING_CONFIG[r.agingBucket];
              const status = STATUS_CONFIG[r.status];
              return (
                <tr key={r.id} className={cn("table-row-hover border-b border-border/50 last:border-0",
                  r.agingBucket === "61+" && r.status !== "paid" && "border-l-2 border-l-red-500/50 bg-red-500/3",
                  r.agingBucket === "31-60" && r.status !== "paid" && "border-l-2 border-l-amber-500/50"
                )}>
                  <td className="px-3 py-3 text-xs font-mono font-semibold text-foreground">{r.invoiceNumber}</td>
                  <td className="px-3 py-3">
                    <p className="text-xs font-semibold text-foreground">{r.supplierName}</p>
                    {r.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">{r.notes}</p>}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{CAT_LABELS[r.category]}</td>
                  <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{r.invoiceDate}</td>
                  <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{r.dueDate}</td>
                  <td className="px-3 py-3 text-xs font-mono">{formatCurrency(r.totalAmount, "ETB")}</td>
                  <td className="px-3 py-3 text-xs font-mono text-green-400">{r.paidAmount > 0 ? formatCurrency(r.paidAmount, "ETB") : "—"}</td>
                  <td className="px-3 py-3">
                    <span className="text-sm font-bold font-mono text-accent">{formatCurrency(r.outstandingAmount, "ETB")}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", aging.bg, aging.color, aging.border)}>
                      {r.agingBucket} days
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", status.bg, status.color)}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      {canEdit && r.status !== "paid" && (
                        <button onClick={() => setPaymentModal(r)}
                          className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20">Pay</button>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => { setEditingAP(r); setShowForm(true); }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm("Delete?")) { deleteAP(r.id); toast.success("Deleted"); } }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold text-foreground">No AP records found</p>
          </div>
        )}
      </div>

      {/* AP Form Modal */}
      {showForm && editingAP !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{editingAP.id ? "Edit AP Record" : "New AP Invoice"}</h2>
              <button onClick={() => { setShowForm(false); setEditingAP(null); }} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice Number *</label>
                  <input value={editingAP.invoiceNumber || ""} onChange={e => setEditingAP(p => ({ ...p!, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="SUPP-INV-0001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                  <select value={editingAP.category || "food_supplier"} onChange={e => setEditingAP(p => ({ ...p!, category: e.target.value as AccountPayable["category"] }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Supplier Name *</label>
                <input value={editingAP.supplierName || ""} onChange={e => setEditingAP(p => ({ ...p!, supplierName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Addis Meats Co." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Amount (ETB) *</label>
                  <input type="text" inputMode="decimal" value={editingAP.totalAmount || ""} onChange={e => setEditingAP(p => ({ ...p!, totalAmount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice Date</label>
                  <input type="date" value={editingAP.invoiceDate || new Date().toISOString().split("T")[0]} onChange={e => setEditingAP(p => ({ ...p!, invoiceDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Due Date</label>
                  <input type="date" value={editingAP.dueDate || ""} onChange={e => setEditingAP(p => ({ ...p!, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <textarea value={editingAP.notes || ""} onChange={e => setEditingAP(p => ({ ...p!, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" placeholder="Description of goods/services..." />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => { setShowForm(false); setEditingAP(null); }} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSaveAP} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">{editingAP.id ? "Update" : "Add Invoice"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Record Payment</h2>
              <button onClick={() => setPaymentModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs">
                <p className="font-semibold text-foreground">{paymentModal.supplierName}</p>
                <p className="text-muted-foreground">Invoice: {paymentModal.invoiceNumber}</p>
                <p className="text-muted-foreground">Outstanding: <strong className="text-accent">{formatCurrency(paymentModal.outstandingAmount, "ETB")}</strong></p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Payment Amount (ETB) *</label>
                <input type="text" inputMode="decimal" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Payment Reference</label>
                <input value={payRef} onChange={e => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Bank receipt no..." />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setPaymentModal(null)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handlePayment} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
