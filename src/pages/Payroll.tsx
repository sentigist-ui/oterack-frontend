import { useState, useMemo } from "react";
import {
  Users, Plus, Edit2, Trash2, Search, Download, Calculator,
  Building2, CreditCard, CheckCircle, Clock, TrendingUp,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { usePayroll } from "@/hooks/usePayroll";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, generateId, cn } from "@/lib/utils";
import type { Employee, PayrollRecord } from "@/types";
import { ET_TAX_BRACKETS, calcEthiopianTax } from "@/types";
import { toast } from "sonner";
import { Settings } from "@/lib/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DEPARTMENTS = ["Management", "F&B", "Kitchen", "Bar", "Store", "Finance", "Procurement", "Audit", "Front Office", "Housekeeping", "Other"];
const SYSTEM_ROLES = ["admin", "manager", "storekeeper", "kitchen", "cashier", "finance", "owner", "purchaser", "collector", "hod", "audit"];

const EMPTY_EMP: Partial<Employee> = {
  name: "", hotelRole: "", department: "Kitchen", systemRole: "kitchen",
  grossSalary: 0, bankAccount: "", hiredDate: new Date().toISOString().split("T")[0], active: true,
};

function calcPayroll(emp: Employee, serviceCharge: number) {
  const gross = emp.grossSalary;
  const sc = serviceCharge;
  const totalIncome = gross + sc;
  const employeePension = gross * 0.07;
  const employerPension = gross * 0.11;
  const taxableIncome = gross;
  const incomeTax = calcEthiopianTax(taxableIncome);
  const totalDeductions = employeePension + incomeTax;
  const netSalary = totalIncome - totalDeductions;
  const bracket = ET_TAX_BRACKETS.find(b => taxableIncome >= b.min && taxableIncome <= b.max) ?? ET_TAX_BRACKETS[ET_TAX_BRACKETS.length - 1];
  return { sc, totalIncome, employeePension, employerPension, taxableIncome, incomeTax, totalDeductions, netSalary, bracket };
}

export default function PayrollPage() {
  const { employees, payrollRecords, addEmployee, updateEmployee, deleteEmployee, processMonthlyPayroll, getMonthlyPayroll, calcServiceCharge, markPaid, deleteRecord } = usePayroll();
  const { user } = useAuth();
  const settings = Settings.get();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"employees" | "payroll" | "tax_table">("employees");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Partial<Employee>>(EMPTY_EMP);
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = user && ["admin", "finance"].includes(user.role);
  const serviceCharge = calcServiceCharge(selectedMonth);
  const monthlyPayroll = getMonthlyPayroll(selectedMonth);

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.hotelRole.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  const activeEmps = employees.filter(e => e.active);
  const totalGross = activeEmps.reduce((s, e) => s + e.grossSalary, 0);
  const totalEmployerPension = activeEmps.reduce((s, e) => s + e.grossSalary * 0.11, 0);
  const totalNetPayable = activeEmps.reduce((s, e) => {
    const c = calcPayroll(e, serviceCharge);
    return s + c.netSalary;
  }, 0);

  const handleSaveEmp = () => {
    if (!editingEmp.name?.trim()) { toast.error("Name required"); return; }
    if (!editingEmp.bankAccount?.trim()) { toast.error("Bank account required"); return; }
    const emp: Employee = {
      id: isEditing ? editingEmp.id! : generateId(),
      name: editingEmp.name!,
      hotelRole: editingEmp.hotelRole || "Staff",
      department: editingEmp.department || "Other",
      systemRole: editingEmp.systemRole as Employee["systemRole"] || "cashier",
      grossSalary: editingEmp.grossSalary || 0,
      bankAccount: editingEmp.bankAccount!,
      hiredDate: editingEmp.hiredDate || new Date().toISOString().split("T")[0],
      active: editingEmp.active ?? true,
      email: editingEmp.email,
      phone: editingEmp.phone,
    };
    if (isEditing) updateEmployee(emp); else addEmployee(emp);
    toast.success(`Employee ${isEditing ? "updated" : "added"}`);
    setShowEmpForm(false);
    setEditingEmp(EMPTY_EMP);
  };

  const handleProcessPayroll = () => {
    if (!canEdit) { toast.error("Access denied"); return; }
    if (monthlyPayroll.length > 0) {
      if (!confirm(`Payroll for ${selectedMonth} already exists. Reprocess?`)) return;
    }
    const records = processMonthlyPayroll(selectedMonth, user!.name);
    toast.success(`Payroll processed for ${records.length} employees — ${selectedMonth}`);
  };

  const exportPayrollPDF = () => {
    if (monthlyPayroll.length === 0) { toast.error("Process payroll first"); return; }
    const doc = new jsPDF({ orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 28, "F");
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 28, pw, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(settings.hotelName, 14, 11);
    doc.setFontSize(9);
    doc.text(`Monthly Payroll — ${selectedMonth}`, pw - 14, 11, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Processed by: ${user?.name} · ${new Date().toLocaleString()}`, 14, 20);

    const totalNet = monthlyPayroll.reduce((s, r) => s + r.netSalary, 0);
    const totalGrossP = monthlyPayroll.reduce((s, r) => s + r.grossSalary, 0);
    const totalTax = monthlyPayroll.reduce((s, r) => s + r.incomeTax, 0);
    const totalEmpPension = monthlyPayroll.reduce((s, r) => s + r.employeePension, 0);
    const totalEmrPension = monthlyPayroll.reduce((s, r) => s + r.employerPension, 0);

    autoTable(doc, {
      startY: 38,
      head: [["#", "Employee", "Department", "Role", "Gross (ETB)", "Svc Chg", "Emp Pension 7%", "Emr Pension 11%", "Tax Rate", "Income Tax", "Total Deduct.", "Net Salary (ETB)", "Bank Account", "Status"]],
      body: monthlyPayroll.map((r, i) => {
        const bracket = ET_TAX_BRACKETS.find(b => r.taxableIncome >= b.min && r.taxableIncome <= b.max) ?? ET_TAX_BRACKETS[ET_TAX_BRACKETS.length - 1];
        return [
          i + 1, r.employeeName, r.department, r.hotelRole,
          r.grossSalary.toFixed(2), r.serviceCharge.toFixed(2),
          r.employeePension.toFixed(2), r.employerPension.toFixed(2),
          `${(bracket.rate * 100).toFixed(0)}%`,
          r.incomeTax.toFixed(2), r.totalDeductions.toFixed(2),
          r.netSalary.toFixed(2), r.bankAccount, r.status.toUpperCase(),
        ];
      }),
      foot: [["", "TOTALS", "", "", totalGrossP.toFixed(2), "", totalEmpPension.toFixed(2), totalEmrPension.toFixed(2), "", totalTax.toFixed(2), "", totalNet.toFixed(2), "", ""]],
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    });

    const pgCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    const ph = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pgCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text("Grar F&B Control — Confidential Payroll Document", 14, ph - 4);
      doc.text(`Page ${i} of ${pgCount}`, pw - 14, ph - 4, { align: "right" });
    }
    doc.save(`Payroll_${selectedMonth}.pdf`);
    toast.success("Payroll PDF exported");
  };

  return (
    <AppLayout>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border mb-5 w-fit">
        {([["employees", "Employees"], ["payroll", "Monthly Payroll"], ["tax_table", "Tax Table"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("px-4 py-2 text-xs font-semibold rounded-lg transition-all",
              tab === key ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {/* ── EMPLOYEES TAB ──────────────────────────────────────────────────────── */}
      {tab === "employees" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="stat-card text-center">
              <p className="text-xl font-bold font-mono text-foreground">{activeEmps.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Active Employees</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xl font-bold font-mono text-accent">{formatCurrency(totalGross, "ETB")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Gross Salaries</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xl font-bold font-mono text-amber-400">{formatCurrency(totalEmployerPension, "ETB")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Employer Pension (11%)</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xl font-bold font-mono text-green-400">{formatCurrency(totalNetPayable, "ETB")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Est. Net Payable</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            {canEdit && (
              <button onClick={() => { setEditingEmp({ ...EMPTY_EMP }); setIsEditing(false); setShowEmpForm(true); }}
                className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
                <Plus className="w-3.5 h-3.5" /> Add Employee
              </button>
            )}
          </div>

          {/* Employee Table */}
          <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Name", "Role in Hotel", "Department", "Gross Salary", "Svc Charge (Est.)", "Emp Pension 7%", "Emr Pension 11%", "Tax Rate", "Income Tax", "Net Salary", "Bank Account (BoA)", "Status", ...(canEdit ? ["Actions"] : [])].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmps.map(emp => {
                  const c = calcPayroll(emp, serviceCharge);
                  return (
                    <tr key={emp.id} className={cn("table-row-hover border-b border-border/50 last:border-0", !emp.active && "opacity-50")}>
                      <td className="px-3 py-3">
                        <p className="text-xs font-semibold text-foreground">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.systemRole}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-foreground">{emp.hotelRole}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{emp.department}</td>
                      <td className="px-3 py-3 text-xs font-mono font-semibold text-foreground">{formatCurrency(emp.grossSalary, "ETB")}</td>
                      <td className="px-3 py-3 text-xs font-mono text-blue-400">{formatCurrency(c.sc, "ETB")}</td>
                      <td className="px-3 py-3 text-xs font-mono text-amber-400">{formatCurrency(c.employeePension, "ETB")}</td>
                      <td className="px-3 py-3 text-xs font-mono text-orange-400">{formatCurrency(c.employerPension, "ETB")}</td>
                      <td className="px-3 py-3">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          c.bracket.rate === 0 ? "bg-green-500/15 text-green-400" :
                          c.bracket.rate <= 0.15 ? "bg-blue-500/15 text-blue-400" :
                          c.bracket.rate <= 0.20 ? "bg-amber-500/15 text-amber-400" :
                          c.bracket.rate <= 0.25 ? "bg-orange-500/15 text-orange-400" :
                          "bg-red-500/15 text-red-400"
                        )}>
                          {(c.bracket.rate * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-red-400">{formatCurrency(c.incomeTax, "ETB")}</td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold font-mono text-green-400">{formatCurrency(c.netSalary, "ETB")}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono text-foreground flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-muted-foreground" />
                          {emp.bankAccount}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                          emp.active ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"
                        )}>{emp.active ? "Active" : "Inactive"}</span>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingEmp({ ...emp }); setIsEditing(true); setShowEmpForm(true); }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { if (confirm(`Delete ${emp.name}?`)) { deleteEmployee(emp.id); toast.success("Deleted"); } }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredEmps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No employees found</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MONTHLY PAYROLL TAB ────────────────────────────────────────────────── */}
      {tab === "payroll" && (
        <>
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground mr-2">Select Month</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={exportPayrollPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-muted border border-border">
                <Download className="w-3.5 h-3.5" /> Export PDF
              </button>
              {canEdit && (
                <button onClick={handleProcessPayroll}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
                  <Calculator className="w-3.5 h-3.5" /> Process Payroll
                </button>
              )}
            </div>
          </div>

          {monthlyPayroll.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Calculator className="w-14 h-14 mx-auto mb-3 opacity-30" />
              <p className="text-base font-semibold text-foreground">No payroll for {selectedMonth}</p>
              <p className="text-sm mt-2">Click "Process Payroll" to calculate salaries for this month.</p>
              {serviceCharge > 0 && <p className="text-xs mt-1 text-blue-400">Est. service charge per employee: {formatCurrency(serviceCharge, "ETB")}</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Employees", value: String(monthlyPayroll.length) },
                  { label: "Total Gross", value: formatCurrency(monthlyPayroll.reduce((s, r) => s + r.grossSalary, 0), "ETB"), color: "text-foreground" },
                  { label: "Total Tax", value: formatCurrency(monthlyPayroll.reduce((s, r) => s + r.incomeTax, 0), "ETB"), color: "text-red-400" },
                  { label: "Total Net Payable", value: formatCurrency(monthlyPayroll.reduce((s, r) => s + r.netSalary, 0), "ETB"), color: "text-green-400" },
                ].map(s => (
                  <div key={s.label} className="stat-card text-center">
                    <p className={cn("text-xl font-bold font-mono", s.color ?? "text-foreground")}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Employee", "Dept", "Gross", "Svc Charge", "Total Income", "Emp Pension 7%", "Emr Pension 11%", "Income Tax", "Total Deduct.", "Net Salary", "Bank Account", "Status", ...(canEdit ? [""] : [])].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyPayroll.map(r => (
                      <tr key={r.id} className="table-row-hover border-b border-border/50 last:border-0">
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-semibold text-foreground">{r.employeeName}</p>
                          <p className="text-[10px] text-muted-foreground">{r.hotelRole}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.department}</td>
                        <td className="px-3 py-2.5 text-xs font-mono">{formatCurrency(r.grossSalary, "ETB")}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-blue-400">{formatCurrency(r.serviceCharge, "ETB")}</td>
                        <td className="px-3 py-2.5 text-xs font-mono font-semibold">{formatCurrency(r.totalIncome, "ETB")}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-amber-400">{formatCurrency(r.employeePension, "ETB")}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-orange-400">{formatCurrency(r.employerPension, "ETB")}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-red-400">{formatCurrency(r.incomeTax, "ETB")}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-red-400/80">{formatCurrency(r.totalDeductions, "ETB")}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-sm font-bold font-mono text-green-400">{formatCurrency(r.netSalary, "ETB")}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{r.bankAccount}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                            r.status === "paid" ? "bg-green-500/15 text-green-400" :
                            r.status === "processed" ? "bg-blue-500/15 text-blue-400" :
                            "bg-muted text-muted-foreground"
                          )}>{r.status.toUpperCase()}</span>
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              {r.status === "processed" && (
                                <button onClick={() => { markPaid(r.id); toast.success("Marked as paid"); }}
                                  className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20">
                                  <CheckCircle className="w-3 h-3 inline mr-1" />Mark Paid
                                </button>
                              )}
                              <button onClick={() => { deleteRecord(r.id); toast.success("Record deleted"); }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ── TAX TABLE TAB ─────────────────────────────────────────────────────── */}
      {tab === "tax_table" && (
        <div className="max-w-2xl">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Ethiopian Income Tax Brackets (2025/2026)</h3>
            <p className="text-xs text-muted-foreground mt-1">Tax = (Gross × Rate) − Deduction. Employee pension: 7%. Employer pension: 11%. Service charge: 10% of monthly sales ÷ staff count.</p>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Monthly Income Range (ETB)", "Tax Rate", "Deduction (ETB)", "Example: 8,000 ETB"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ET_TAX_BRACKETS.map((b, i) => {
                  const eg = 8000;
                  const tax = eg >= b.min && eg <= b.max ? Math.max(0, eg * b.rate - b.deduction) : null;
                  return (
                    <tr key={i} className={cn("border-b border-border/50 last:border-0", eg >= b.min && eg <= b.max && "bg-primary/5 border-l-2 border-l-primary/50")}>
                      <td className="px-4 py-3 text-xs font-mono text-foreground">
                        {b.min.toLocaleString()} – {b.max === Infinity ? "∞" : b.max.toLocaleString()} ETB
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                          b.rate === 0 ? "bg-green-500/15 text-green-400" :
                          b.rate <= 0.15 ? "bg-blue-500/15 text-blue-400" :
                          b.rate <= 0.20 ? "bg-amber-500/15 text-amber-400" :
                          b.rate <= 0.25 ? "bg-orange-500/15 text-orange-400" :
                          "bg-red-500/15 text-red-400"
                        )}>{(b.rate * 100).toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {b.deduction.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {tax !== null ? (
                          <span className="text-xs font-mono text-red-400 font-semibold">
                            {formatCurrency(tax, "ETB")} tax
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2 text-xs text-blue-300/80">
            <p><strong>Pension:</strong> Employee pays 7% of gross | Employer pays additional 11% of gross</p>
            <p><strong>Service Charge:</strong> 10% of monthly total sales revenue ÷ number of active employees</p>
            <p><strong>Net Salary Formula:</strong> (Gross + Service Charge) − Employee Pension (7%) − Income Tax</p>
            <p><strong>Note:</strong> Service charge is not taxable. Income tax is calculated on gross salary only.</p>
          </div>
        </div>
      )}

      {/* Employee Form Modal */}
      {showEmpForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{isEditing ? "Edit Employee" : "Add Employee"}</h2>
              <button onClick={() => setShowEmpForm(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Full Name *</label>
                  <input value={editingEmp.name || ""} onChange={e => setEditingEmp(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Almaz Girma" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Role in Hotel *</label>
                  <input value={editingEmp.hotelRole || ""} onChange={e => setEditingEmp(p => ({ ...p, hotelRole: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Head Chef" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Department</label>
                  <select value={editingEmp.department || "Kitchen"} onChange={e => setEditingEmp(p => ({ ...p, department: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">System Role</label>
                  <select value={editingEmp.systemRole || "kitchen"} onChange={e => setEditingEmp(p => ({ ...p, systemRole: e.target.value as Employee["systemRole"] }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {SYSTEM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Gross Salary (ETB) *</label>
                  <input type="text" inputMode="decimal" value={editingEmp.grossSalary || ""} onChange={e => setEditingEmp(p => ({ ...p, grossSalary: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. 12000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Hire Date</label>
                  <input type="date" value={editingEmp.hiredDate || ""} onChange={e => setEditingEmp(p => ({ ...p, hiredDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Bank of Abyssinia Account No. *</label>
                <input value={editingEmp.bankAccount || ""} onChange={e => setEditingEmp(p => ({ ...p, bankAccount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. 100200300401" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                  <input type="email" value={editingEmp.email || ""} onChange={e => setEditingEmp(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="email@hotel.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Phone</label>
                  <input value={editingEmp.phone || ""} onChange={e => setEditingEmp(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="+251 9XX XXX XXX" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={editingEmp.active ?? true} onChange={e => setEditingEmp(p => ({ ...p, active: e.target.checked }))} className="rounded" />
                <span className="text-foreground">Active Employee</span>
              </label>
              {editingEmp.grossSalary ? (
                <div className="rounded-lg bg-muted/50 border border-border p-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="font-bold font-mono text-amber-400">{formatCurrency((editingEmp.grossSalary || 0) * 0.07, "ETB")}</p>
                    <p className="text-muted-foreground">Emp Pension 7%</p>
                  </div>
                  <div>
                    <p className="font-bold font-mono text-red-400">{formatCurrency(calcEthiopianTax(editingEmp.grossSalary || 0), "ETB")}</p>
                    <p className="text-muted-foreground">Income Tax</p>
                  </div>
                  <div>
                    <p className="font-bold font-mono text-green-400">{formatCurrency((editingEmp.grossSalary || 0) - (editingEmp.grossSalary || 0) * 0.07 - calcEthiopianTax(editingEmp.grossSalary || 0), "ETB")}</p>
                    <p className="text-muted-foreground">Est. Net (no svc chg)</p>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setShowEmpForm(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={handleSaveEmp} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">{isEditing ? "Update" : "Add Employee"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
