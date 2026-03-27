import { useState, useMemo } from "react";
import {
  DollarSign, Plus, Search, AlertTriangle, CheckCircle, Clock,
  Bell, BellOff, Edit2, Trash2, Download, Send, CreditCard,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, generateId, cn } from "@/lib/utils";
import type { AccountReceivable, AccountPayable } from "@/types";
import { toast } from "sonner";
import { Users } from "@/lib/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Settings } from "@/lib/storage";

const AGING_CONFIG = {
  "0-30":  { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  label: "Current (0-30 days)" },
  "31-60": { color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30",  label: "Late (31-60 days)" },
  "61+":   { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    label: "Critical (61+ days)" },
};

const STATUS_CONFIG = {
  outstanding:       { color: "text-blue-400",    bg: "bg-blue-500/10",    label: "Outstanding" },
  partially_paid:    { color: "text-amber-400",   bg: "bg-amber-500/10",   label: "Partial" },
  overdue:           { color: "text-red-400",      bg: "bg-red-500/10",     label: "Overdue" },
  paid:              { color: "text-green-400",    bg: "bg-green-500/10",   label: "Paid" },
};

const CLIENT_TYPES = ["travel_agent", "corporate", "group", "other"] as const;
const CLIENT_LABELS: Record<string, string> = {
  travel_agent: "Travel Agent", corporate: "Corporate", group: "Group Booking", other: "Other",
};

export default function AccountsReceivablePage() {
  const { arRecords, arStats, addAR, updateAR, deleteAR, recordARPayment, sendToCollector, collectorConfirm, getUserNotifications, markNotificationRead } = useAccounts();
  const { user } = useAuth();
  const settings = Settings.get();

  const [search, setSearch] = useState("");
  const [agingFilter, setAgingFilter] = useState<"all" | "0-30" | "31-60" | "61+">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountReceivable["status"]>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingAR, setEditingAR] = useState<Partial<AccountReceivable> | null>(null);
  const [paymentModal, setPaymentModal] = useState<AccountReceivable | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");

  const allUsers = Users.getAll();
  const collectors = allUsers.filter(u => u.role === "collector");

  const canEdit = user && ["admin", "finance"].includes(user.role);
  const isCollector = user?.role === "collector";

  // Notifications for current user
  const myNotifs = user ? getUserNotifications(user.id, user.role) : [];
  const unreadNotifCount = myNotifs.filter(n => !n.isRead).length;

  const filtered = useMemo(() => {
    return arRecords.filter(r => {
      const matchSearch = r.clientName.toLowerCase().includes(search.toLowerCase()) || r.invoiceNumber.toLowerCase().includes(search.toLowerCase());
      const matchAging = agingFilter === "all" || r.agingBucket === agingFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchAging && matchStatus;
    });
  }, [arRecords, search, agingFilter, statusFilter]);

  const handleAddAR = () => {
    if (!editingAR?.clientName?.trim()) { toast.error("Client name required"); return; }
    if (!editingAR.invoiceNumber?.trim()) { toast.error("Invoice number required"); return; }
    if (!editingAR.totalAmount || editingAR.totalAmount <= 0) { toast.error("Amount required"); return; }
    if (editingAR.id) {
      updateAR(editingAR as AccountReceivable);
      toast.success("AR record updated");
    } else {
      addAR({
        invoiceNumber: editingAR.invoiceNumber!,
        clientName: editingAR.clientName!,
        clientType: editingAR.clientType || "corporate",
        invoiceDate: editingAR.invoiceDate || new Date().toISOString().split("T")[0],
        dueDate: editingAR.dueDate || new Date().toISOString().split("T")[0],
        totalAmount: editingAR.totalAmount!,
        outstandingAmount: editingAR.totalAmount!,
        notes: editingAR.notes,
        createdBy: user!.name,
      } as Parameters<typeof addAR>[0]);
      toast.success("AR record added");
    }
    setShowForm(false);
    setEditingAR(null);
  };

  const handlePayment = () => {
    if (!paymentModal) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter valid amount"); return; }
    if (amount > paymentModal.outstandingAmount) { toast.error("Exceeds outstanding amount"); return; }
    recordARPayment(paymentModal.id, amount, payRef || `PAY-${Date.now()}`, user!.name);
    toast.success("Payment recorded");
    setPaymentModal(null);
    setPayAmount("");
    setPayRef("");
  };

  const handleSendToCollector = (arId: string, collectorId: string) => {
    const collector = allUsers.find(u => u.id === collectorId);
    if (!collector) return;
    sendToCollector(arId, collectorId, collector.name, user!.name);
    toast.success(`Collection document sent to ${collector.name}`);
  };

  const exportARPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(37, 99, 235); doc.rect(0, 28, pw, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text(settings.hotelName, 14, 11);
    doc.setFontSize(9); doc.text("Accounts Receivable Report", pw - 14, 11, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()} by ${user?.name}`, 14, 20);
    autoTable(doc, {
      startY: 36,
      head: [["Invoice", "Client", "Type", "Invoice Date", "Due Date", "Total (ETB)", "Paid (ETB)", "Outstanding (ETB)", "Aging", "Status", "Collector"]],
      body: filtered.map(r => [
        r.invoiceNumber, r.clientName, CLIENT_LABELS[r.clientType] ?? r.clientType,
        r.invoiceDate, r.dueDate,
        r.totalAmount.toFixed(2), r.paidAmount.toFixed(2), r.outstandingAmount.toFixed(2),
        r.agingBucket + " days", r.status.replace(/_/g, " ").toUpperCase(),
        r.collectorName ?? "—",
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
    doc.save(`AR_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("AR report exported");
  };

  return (
    <AppLayout>
      {/* Collector Notifications */}
      {isCollector && unreadNotifCount > 0 && (
        <div className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-semibold text-blue-300">{unreadNotifCount} new collection assignment{unreadNotifCount > 1 ? "s" : ""}</p>
          </div>
          {myNotifs.filter(n => !n.isRead).map(n => (
            <div key={n.id} className="flex items-start gap-2 mb-2 last:mb-0">
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
              </div>
              <button onClick={() => { markNotificationRead(n.id); }} className="text-[10px] text-blue-400 hover:underline shrink-0">Mark read</button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="stat-card text-center">
          <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(arStats.totalOutstanding, "ETB")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Outstanding</p>
        </div>
        <div className={cn("stat-card text-center", arStats.aging0_30.length && "border-green-500/30")}>
          <p className={cn("text-xl font-bold font-mono", arStats.aging0_30.length ? "text-green-400" : "text-foreground")}>{arStats.aging0_30.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Current (0–30 days)</p>
          <p className="text-[10px] text-green-400">{formatCurrency(arStats.aging0_30.reduce((s, r) => s + r.outstandingAmount, 0), "ETB")}</p>
        </div>
        <div className={cn("stat-card text-center", arStats.aging31_60.length && "border-amber-500/30")}>
          <p className={cn("text-xl font-bold font-mono", arStats.aging31_60.length ? "text-amber-400" : "text-foreground")}>{arStats.aging31_60.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Late (31–60 days)</p>
          <p className="text-[10px] text-amber-400">{formatCurrency(arStats.aging31_60.reduce((s, r) => s + r.outstandingAmount, 0), "ETB")}</p>
        </div>
        <div className={cn("stat-card text-center", arStats.aging61plus.length && "border-red-500/30")}>
          <p className={cn("text-xl font-bold font-mono", arStats.aging61plus.length ? "text-red-400" : "text-foreground")}>{arStats.aging61plus.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Critical (61+ days)</p>
          <p className="text-[10px] text-red-400">{formatCurrency(arStats.aging61plus.reduce((s, r) => s + r.outstandingAmount, 0), "ETB")}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, invoice..."
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
          <option value="outstanding">Outstanding</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportARPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          {canEdit && (
            <button onClick={() => { setEditingAR({}); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Invoice
            </button>
          )}
        </div>
      </div>

      {/* AR Table */}
      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Invoice No.", "Client", "Type", "Invoice Date", "Due Date", "Total (ETB)", "Paid (ETB)", "Outstanding", "Aging", "Status", "Collector", "Actions"].map(h => (
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
                    <p className="text-xs font-semibold text-foreground">{r.clientName}</p>
                    {r.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{r.notes}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {CLIENT_LABELS[r.clientType]}
                    </span>
                  </td>
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
                    {r.collectorName ? (
                      <div>
                        <p className="text-xs text-foreground">{r.collectorName}</p>
                        {r.collectorConfirmed
                          ? <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Confirmed</span>
                          : <span className="text-[10px] text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Notified</span>
                        }
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {canEdit && r.status !== "paid" && (
                        <button onClick={() => setPaymentModal(r)}
                          className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Pay
                        </button>
                      )}
                      {canEdit && r.status !== "paid" && collectors.length > 0 && !r.collectorNotified && (
                        <select onChange={e => { if (e.target.value) handleSendToCollector(r.id, e.target.value); e.target.value = ""; }}
                          className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 focus:outline-none max-w-[100px]">
                          <option value="">Assign Collector</option>
                          {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      {isCollector && r.assignedCollector === user?.id && !r.collectorConfirmed && (
                        <button onClick={() => { collectorConfirm(r.id, user!.id); toast.success("Confirmed receipt"); }}
                          className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                          Confirm
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => { setEditingAR(r); setShowForm(true); }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm("Delete?")) { deleteAR(r.id); toast.success("Deleted"); } }}
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
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold text-foreground">No AR records found</p>
          </div>
        )}
      </div>

      {/* AR Form Modal */}
      {showForm && editingAR !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{editingAR.id ? "Edit Invoice" : "New AR Invoice"}</h2>
              <button onClick={() => { setShowForm(false); setEditingAR(null); }} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice Number *</label>
                  <input value={editingAR.invoiceNumber || ""} onChange={e => setEditingAR(p => ({ ...p!, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="INV-2025-0001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Client Type</label>
                  <select value={editingAR.clientType || "corporate"} onChange={e => setEditingAR(p => ({ ...p!, clientType: e.target.value as AccountReceivable["clientType"] }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {CLIENT_TYPES.map(t => <option key={t} value={t}>{CLIENT_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Client Name *</label>
                <input value={editingAR.clientName || ""} onChange={e => setEditingAR(p => ({ ...p!, clientName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Ethiopian Airlines Corporate" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Amount (ETB) *</label>
                  <input type="text" inputMode="decimal" value={editingAR.totalAmount || ""} onChange={e => setEditingAR(p => ({ ...p!, totalAmount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Invoice Date</label>
                  <input type="date" value={editingAR.invoiceDate || new Date().toISOString().split("T")[0]} onChange={e => setEditingAR(p => ({ ...p!, invoiceDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Due Date</label>
                  <input type="date" value={editingAR.dueDate || ""} onChange={e => setEditingAR(p => ({ ...p!, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <textarea value={editingAR.notes || ""} onChange={e => setEditingAR(p => ({ ...p!, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" placeholder="Description of services..." />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => { setShowForm(false); setEditingAR(null); }} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleAddAR} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
                {editingAR.id ? "Update" : "Add Invoice"}
              </button>
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
                <p className="font-semibold text-foreground">{paymentModal.clientName}</p>
                <p className="text-muted-foreground mt-0.5">Invoice: {paymentModal.invoiceNumber}</p>
                <p className="text-muted-foreground">Outstanding: <strong className="text-accent">{formatCurrency(paymentModal.outstandingAmount, "ETB")}</strong></p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Payment Amount (ETB) *</label>
                <input type="text" inputMode="decimal" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Reference No.</label>
                <input value={payRef} onChange={e => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Bank transfer ref, receipt no..." />
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
