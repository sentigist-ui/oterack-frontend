import { useState, useCallback } from "react";
import { Employees, PayrollStore } from "@/lib/storage";
import { Sales } from "@/lib/storage";
import { calcEthiopianTax } from "@/types";
import type { Employee, PayrollRecord } from "@/types";
import { generateId } from "@/lib/utils";

export function usePayroll() {
  const [employees, setEmployees] = useState<Employee[]>(() => Employees.getAll());
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => PayrollStore.getAll());

  const refresh = useCallback(() => {
    setEmployees(Employees.getAll());
    setPayrollRecords(PayrollStore.getAll());
  }, []);

  const addEmployee = useCallback((emp: Employee) => {
    Employees.upsert(emp);
    setEmployees(Employees.getAll());
  }, []);

  const updateEmployee = useCallback((emp: Employee) => {
    Employees.upsert(emp);
    setEmployees(Employees.getAll());
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    Employees.delete(id);
    setEmployees(Employees.getAll());
  }, []);

  // Calculate monthly service charge per employee (10% of total sales / employee count)
  const calcServiceCharge = useCallback((month: string): number => {
    const [year, mon] = month.split("-");
    const from = `${year}-${mon}-01`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const to = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;
    const allSales = Sales.getDateRange(from, to);
    const totalRevenue = allSales.reduce((s, sale) => s + sale.totalRevenue, 0);
    const serviceChargePool = totalRevenue * 0.10;
    const activeCount = Employees.getAll().filter(e => e.active).length;
    return activeCount > 0 ? serviceChargePool / activeCount : 0;
  }, []);

  // Process payroll for a given month
  const processMonthlyPayroll = useCallback((month: string, processedBy: string) => {
    const allEmps = Employees.getAll().filter(e => e.active);
    const serviceCharge = calcServiceCharge(month);

    const records: PayrollRecord[] = allEmps.map(emp => {
      const gross = emp.grossSalary;
      const sc = serviceCharge;
      const totalIncome = gross + sc;
      const employeePension = gross * 0.07;
      const employerPension = gross * 0.11;
      // In ET law, taxable income is gross salary (before service charge, after employee pension in some interpretations)
      // We'll use gross salary as taxable base
      const taxableIncome = gross;
      const incomeTax = calcEthiopianTax(taxableIncome);
      const totalDeductions = employeePension + incomeTax;
      const netSalary = totalIncome - totalDeductions;

      return {
        id: generateId(),
        month,
        employeeId: emp.id,
        employeeName: emp.name,
        hotelRole: emp.hotelRole,
        department: emp.department,
        grossSalary: gross,
        serviceCharge: sc,
        totalIncome,
        employeePension,
        employerPension,
        taxableIncome,
        incomeTax,
        totalDeductions,
        netSalary,
        bankAccount: emp.bankAccount,
        processedBy,
        processedAt: new Date().toISOString(),
        status: "processed",
      };
    });

    PayrollStore.saveAll(records);
    setPayrollRecords(PayrollStore.getAll());
    return records;
  }, [calcServiceCharge]);

  const getMonthlyPayroll = useCallback((month: string): PayrollRecord[] => {
    return PayrollStore.getByMonth(month);
  }, []);

  const markPaid = useCallback((id: string) => {
    const all = PayrollStore.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx >= 0) {
      all[idx].status = "paid";
      PayrollStore.saveAll(all);
      setPayrollRecords(PayrollStore.getAll());
    }
  }, []);

  const deleteRecord = useCallback((id: string) => {
    PayrollStore.delete(id);
    setPayrollRecords(PayrollStore.getAll());
  }, []);

  return {
    employees,
    payrollRecords,
    refresh,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    processMonthlyPayroll,
    getMonthlyPayroll,
    calcServiceCharge,
    markPaid,
    deleteRecord,
  };
}
