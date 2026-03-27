/**
 * PDF Export Utility — Grar F&B Management System
 * Uses jsPDF + jspdf-autotable for structured table exports
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND_COLOR: [number, number, number] = [37, 99, 235];   // Blue-600
const HEADER_BG: [number, number, number] = [15, 23, 42];       // Slate-900
const SUBHEADER: [number, number, number] = [30, 41, 59];       // Slate-800
const TEXT_DARK: [number, number, number] = [15, 23, 42];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];   // Slate-500
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [22, 163, 74];

function addDocHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  hotelName: string,
  exportedBy: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Dark header bar
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, pageWidth, 30, "F");

  // Brand accent line
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 30, pageWidth, 2, "F");

  // Hotel name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text(hotelName, 14, 12);

  // System name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("F&B Control — Pro Management System", 14, 20);

  // Report title (right side)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(title, pageWidth - 14, 12, { align: "right" });

  // Date
  const now = new Date();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${now.toLocaleString()}`, pageWidth - 14, 20, { align: "right" });

  // Subtitle bar
  doc.setFillColor(...SUBHEADER);
  doc.rect(0, 32, pageWidth, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(subtitle, 14, 38.5);
  doc.text(`Exported by: ${exportedBy}`, pageWidth - 14, 38.5, { align: "right" });

  return 50; // y position after header
}

function addSummaryRow(
  doc: jsPDF,
  y: number,
  items: { label: string; value: string; color?: "red" | "green" | "amber" | "normal" }[],
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - 28) / items.length;
  const boxH = 16;

  items.forEach((item, i) => {
    const x = 14 + i * colWidth;
    doc.setFillColor(248, 250, 252); // gray-50
    doc.setDrawColor(226, 232, 240); // gray-200
    doc.roundedRect(x, y, colWidth - 4, boxH, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const color =
      item.color === "red" ? RED :
      item.color === "green" ? GREEN :
      item.color === "amber" ? AMBER :
      TEXT_DARK;
    doc.setTextColor(...color);
    doc.text(item.value, x + (colWidth - 4) / 2, y + 7, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(item.label, x + (colWidth - 4) / 2, y + 13, { align: "center" });
  });

  return y + boxH + 6;
}

function addFooter(doc: jsPDF): void {
  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Grar F&B Control — Confidential", 14, pageHeight - 3.5);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 3.5, { align: "right" });
  }
}

// ─── MAIN STORE INVENTORY ───────────────────────────────────────────────────
export function exportInventoryPDF(
  ingredients: {
    name: string; category: string; unit: string; costPerUnit: number;
    currentQuantity: number; minQuantity: number; lastUpdated: string;
  }[],
  hotelName: string,
  exportedBy: string,
  physicalCount?: { ingredientId?: string; ingredientName: string; theoreticalQty: number; physicalQty: number; variance: number; varianceCost: number }[],
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Main Store Inventory", "Complete stock listing with theoretical quantities", hotelName, exportedBy);

  const totalValue = ingredients.reduce((s, i) => s + i.currentQuantity * i.costPerUnit, 0);
  const lowCount = ingredients.filter(i => i.currentQuantity <= i.minQuantity).length;
  const outCount = ingredients.filter(i => i.currentQuantity === 0).length;
  const totalVarianceCost = physicalCount?.reduce((s, e) => s + e.varianceCost, 0) ?? 0;

  y = addSummaryRow(doc, y, [
    { label: "Total Items", value: String(ingredients.length) },
    { label: "Low Stock", value: String(lowCount), color: lowCount > 0 ? "amber" : "normal" },
    { label: "Out of Stock", value: String(outCount), color: outCount > 0 ? "red" : "normal" },
    { label: "Total Value (ETB)", value: totalValue.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    ...(physicalCount ? [{ label: "Variance Cost (ETB)", value: totalVarianceCost.toFixed(2), color: totalVarianceCost > 0 ? "red" as const : "normal" as const }] : []),
  ]);

  const columns = physicalCount
    ? ["Item", "Category", "Unit", "Cost/Unit (ETB)", "Min Stock", "Theoretical", "Physical Count", "Variance", "Var. Cost (ETB)", "Status"]
    : ["Item", "Category", "Unit", "Cost/Unit (ETB)", "Min Stock", "Current Stock", "Stock Value (ETB)", "Status"];

  autoTable(doc, {
    startY: y,
    head: [columns],
    body: ingredients.map(i => {
      const pc = physicalCount?.find(e => e.ingredientName === i.name);
      const isOut = i.currentQuantity === 0;
      const isLow = i.currentQuantity <= i.minQuantity;
      const status = isOut ? "OUT" : isLow ? "LOW" : "OK";
      if (physicalCount) {
        return [
          i.name, i.category, i.unit,
          i.costPerUnit.toFixed(2),
          `${i.minQuantity} ${i.unit}`,
          `${i.currentQuantity.toFixed(3)} ${i.unit}`,
          pc ? `${pc.physicalQty.toFixed(3)} ${i.unit}` : "—",
          pc ? (pc.variance > 0 ? `+${pc.variance.toFixed(3)}` : pc.variance.toFixed(3)) : "—",
          pc && pc.varianceCost > 0 ? pc.varianceCost.toFixed(2) : "—",
          status,
        ];
      }
      return [
        i.name, i.category, i.unit,
        i.costPerUnit.toFixed(2),
        `${i.minQuantity} ${i.unit}`,
        `${i.currentQuantity.toFixed(3)} ${i.unit}`,
        (i.currentQuantity * i.costPerUnit).toFixed(2),
        status,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 3, textColor: TEXT_DARK },
    headStyles: { fillColor: HEADER_BG, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body") {
        const statusCol = physicalCount ? 9 : 7;
        const varCol = physicalCount ? 7 : -1;
        if (data.column.index === statusCol) {
          const val = String(data.cell.raw);
          if (val === "OUT") data.cell.styles.textColor = RED;
          else if (val === "LOW") data.cell.styles.textColor = AMBER;
          else data.cell.styles.textColor = GREEN;
          data.cell.styles.fontStyle = "bold";
        }
        if (varCol >= 0 && data.column.index === varCol) {
          const val = String(data.cell.raw);
          if (val.startsWith("-")) data.cell.styles.textColor = RED;
          else if (val.startsWith("+")) data.cell.styles.textColor = AMBER;
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`Inventory_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── KITCHEN STORE ──────────────────────────────────────────────────────────
export function exportKitchenStorePDF(
  kitchenStock: { ingredientName: string; unit: string; costPerUnit: number; currentQuantity: number; lastUpdated: string }[],
  hotelName: string,
  exportedBy: string,
  physicalCount?: { ingredientName: string; theoreticalQty: number; physicalQty: number; variance: number; varianceCost: number }[],
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Kitchen Store Report", `Physical count & stock levels — ${new Date().toLocaleDateString()}`, hotelName, exportedBy);

  const totalValue = kitchenStock.reduce((s, i) => s + i.currentQuantity * i.costPerUnit, 0);
  const outCount = kitchenStock.filter(i => i.currentQuantity === 0).length;
  const totalVarianceCost = physicalCount?.reduce((s, e) => s + e.varianceCost, 0) ?? 0;
  const shortages = physicalCount?.filter(e => e.variance < 0).length ?? 0;

  y = addSummaryRow(doc, y, [
    { label: "Total Items", value: String(kitchenStock.length) },
    { label: "Out of Stock", value: String(outCount), color: outCount > 0 ? "red" : "normal" },
    { label: "Kitchen Value (ETB)", value: totalValue.toFixed(2) },
    ...(physicalCount ? [
      { label: "Shortages", value: String(shortages), color: shortages > 0 ? "red" as const : "normal" as const },
      { label: "Variance Cost (ETB)", value: totalVarianceCost.toFixed(2), color: totalVarianceCost > 0 ? "red" as const : "normal" as const },
    ] : []),
  ]);

  const cols = physicalCount
    ? ["Ingredient", "Unit", "Cost/Unit (ETB)", "Theoretical Stock", "Physical Count", "Variance", "Variance Cost (ETB)", "Status"]
    : ["Ingredient", "Unit", "Cost/Unit (ETB)", "Kitchen Stock", "Stock Value (ETB)", "Status", "Last Updated"];

  autoTable(doc, {
    startY: y,
    head: [cols],
    body: kitchenStock.map(i => {
      const pc = physicalCount?.find(e => e.ingredientName === i.ingredientName);
      const isOut = i.currentQuantity === 0;
      const isCritical = i.currentQuantity > 0 && i.currentQuantity < 1;
      const status = isOut ? "OUT" : isCritical ? "LOW" : "OK";
      if (physicalCount) {
        return [
          i.ingredientName, i.unit, i.costPerUnit.toFixed(2),
          `${i.currentQuantity.toFixed(3)} ${i.unit}`,
          pc ? `${pc.physicalQty.toFixed(3)} ${i.unit}` : "—",
          pc ? (pc.variance > 0 ? `+${pc.variance.toFixed(3)}` : pc.variance.toFixed(3)) : "—",
          pc && pc.varianceCost > 0 ? pc.varianceCost.toFixed(2) : "—",
          status,
        ];
      }
      return [
        i.ingredientName, i.unit, i.costPerUnit.toFixed(2),
        `${i.currentQuantity.toFixed(3)} ${i.unit}`,
        (i.currentQuantity * i.costPerUnit).toFixed(2),
        status,
        new Date(i.lastUpdated).toLocaleString(),
      ];
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [5, 78, 26], textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    didParseCell: (data) => {
      if (data.section === "body") {
        const statusIdx = physicalCount ? 7 : 5;
        const varIdx = physicalCount ? 5 : -1;
        if (data.column.index === statusIdx) {
          const v = String(data.cell.raw);
          if (v === "OUT") data.cell.styles.textColor = RED;
          else if (v === "LOW") data.cell.styles.textColor = AMBER;
          else data.cell.styles.textColor = GREEN;
          data.cell.styles.fontStyle = "bold";
        }
        if (varIdx >= 0 && data.column.index === varIdx) {
          const v = String(data.cell.raw);
          if (v.startsWith("-")) data.cell.styles.textColor = RED;
          else if (v.startsWith("+")) data.cell.styles.textColor = AMBER;
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`KitchenStore_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── BAR STORE ──────────────────────────────────────────────────────────────
export function exportBarStorePDF(
  barStock: { ingredientName: string; unit: string; costPerUnit: number; currentQuantity: number; lastUpdated: string }[],
  hotelName: string,
  exportedBy: string,
  physicalCount?: { ingredientName: string; theoreticalQty: number; physicalQty: number; variance: number; varianceCost: number }[],
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Bar Store Report", `Physical count & stock levels — ${new Date().toLocaleDateString()}`, hotelName, exportedBy);

  const totalValue = barStock.reduce((s, i) => s + i.currentQuantity * i.costPerUnit, 0);
  const outCount = barStock.filter(i => i.currentQuantity === 0).length;
  const totalVarianceCost = physicalCount?.reduce((s, e) => s + e.varianceCost, 0) ?? 0;
  const shortages = physicalCount?.filter(e => e.variance < 0).length ?? 0;

  y = addSummaryRow(doc, y, [
    { label: "Total Items", value: String(barStock.length) },
    { label: "Out of Stock", value: String(outCount), color: outCount > 0 ? "red" : "normal" },
    { label: "Bar Value (ETB)", value: totalValue.toFixed(2) },
    ...(physicalCount ? [
      { label: "Shortages", value: String(shortages), color: shortages > 0 ? "red" as const : "normal" as const },
      { label: "Variance Cost (ETB)", value: totalVarianceCost.toFixed(2), color: totalVarianceCost > 0 ? "red" as const : "normal" as const },
    ] : []),
  ]);

  const cols = physicalCount
    ? ["Ingredient", "Unit", "Cost/Unit (ETB)", "Theoretical Stock", "Physical Count", "Variance", "Variance Cost (ETB)", "Status"]
    : ["Ingredient", "Unit", "Cost/Unit (ETB)", "Bar Stock", "Stock Value (ETB)", "Status", "Last Updated"];

  autoTable(doc, {
    startY: y,
    head: [cols],
    body: barStock.map(i => {
      const pc = physicalCount?.find(e => e.ingredientName === i.ingredientName);
      const isOut = i.currentQuantity === 0;
      const isCritical = i.currentQuantity > 0 && i.currentQuantity < 1;
      const status = isOut ? "OUT" : isCritical ? "LOW" : "OK";
      if (physicalCount) {
        return [
          i.ingredientName, i.unit, i.costPerUnit.toFixed(2),
          `${i.currentQuantity.toFixed(3)} ${i.unit}`,
          pc ? `${pc.physicalQty.toFixed(3)} ${i.unit}` : "—",
          pc ? (pc.variance > 0 ? `+${pc.variance.toFixed(3)}` : pc.variance.toFixed(3)) : "—",
          pc && pc.varianceCost > 0 ? pc.varianceCost.toFixed(2) : "—",
          status,
        ];
      }
      return [
        i.ingredientName, i.unit, i.costPerUnit.toFixed(2),
        `${i.currentQuantity.toFixed(3)} ${i.unit}`,
        (i.currentQuantity * i.costPerUnit).toFixed(2),
        status,
        new Date(i.lastUpdated).toLocaleString(),
      ];
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [88, 28, 135], textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 245, 255] },
    didParseCell: (data) => {
      if (data.section === "body") {
        const statusIdx = physicalCount ? 7 : 5;
        const varIdx = physicalCount ? 5 : -1;
        if (data.column.index === statusIdx) {
          const v = String(data.cell.raw);
          if (v === "OUT") data.cell.styles.textColor = RED;
          else if (v === "LOW") data.cell.styles.textColor = AMBER;
          else data.cell.styles.textColor = GREEN;
          data.cell.styles.fontStyle = "bold";
        }
        if (varIdx >= 0 && data.column.index === varIdx) {
          const v = String(data.cell.raw);
          if (v.startsWith("-")) data.cell.styles.textColor = RED;
          else if (v.startsWith("+")) data.cell.styles.textColor = AMBER;
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`BarStore_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── SALES REPORT ───────────────────────────────────────────────────────────
export function exportSalesPDF(
  sales: {
    date: string; shift: string; recordedBy: string;
    totalRevenue: number; totalCost: number; grossProfit: number; grossMargin: number;
    items: { recipeName: string; quantity: number; unitPrice: number; totalPrice: number; category: string }[];
  }[],
  hotelName: string,
  exportedBy: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Sales Report", `Sales records with cost & margin analysis`, hotelName, exportedBy);

  const totalRev = sales.reduce((s, r) => s + r.totalRevenue, 0);
  const totalCost = sales.reduce((s, r) => s + r.totalCost, 0);
  const totalProfit = sales.reduce((s, r) => s + r.grossProfit, 0);
  const avgMargin = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;

  y = addSummaryRow(doc, y, [
    { label: "Total Transactions", value: String(sales.length) },
    { label: "Total Revenue (ETB)", value: totalRev.toFixed(2), color: "green" },
    { label: "Total Cost (ETB)", value: totalCost.toFixed(2), color: "red" },
    { label: "Gross Profit (ETB)", value: totalProfit.toFixed(2), color: totalProfit >= 0 ? "green" : "red" },
    { label: "Avg Margin", value: `${avgMargin.toFixed(1)}%`, color: avgMargin >= 60 ? "green" : "amber" },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Shift", "Recorded By", "Items Sold", "Revenue (ETB)", "Cost (ETB)", "Profit (ETB)", "Margin %"]],
    body: sales.map(s => [
      s.date,
      s.shift,
      s.recordedBy,
      s.items.map(i => `${i.recipeName} ×${i.quantity}`).join(", "),
      s.totalRevenue.toFixed(2),
      s.totalCost.toFixed(2),
      s.grossProfit.toFixed(2),
      `${s.grossMargin.toFixed(1)}%`,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: HEADER_BG, textColor: WHITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 3: { cellWidth: 70 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const v = parseFloat(String(data.cell.raw));
        data.cell.styles.textColor = v >= 0 ? GREEN : RED;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`Sales_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── STOCK MOVEMENTS ────────────────────────────────────────────────────────
export function exportStockMovementsPDF(
  movements: {
    type: string; ingredientName: string; ingredientUnit: string; quantity: number;
    fromLocation?: string; toLocation?: string; userName: string; timestamp: string;
    unitCost: number; totalCost: number; isFlagged?: boolean; flagReason?: string; reference?: string;
  }[],
  hotelName: string,
  exportedBy: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Stock Movements", `All inventory movement records`, hotelName, exportedBy);

  const flagged = movements.filter(m => m.isFlagged).length;
  const totalValue = movements.reduce((s, m) => s + m.totalCost, 0);
  const grns = movements.filter(m => m.type === "GRN").length;
  const issues = movements.filter(m => m.type === "ISSUE").length;

  y = addSummaryRow(doc, y, [
    { label: "Total Movements", value: String(movements.length) },
    { label: "GRN Receipts", value: String(grns), color: "green" },
    { label: "Issues", value: String(issues) },
    { label: "Flagged", value: String(flagged), color: flagged > 0 ? "red" : "normal" },
    { label: "Total Value (ETB)", value: totalValue.toFixed(2) },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Type", "Ingredient", "Qty", "From → To", "Ref.", "By", "Date & Time", "Value (ETB)", "Status"]],
    body: movements.map(m => [
      m.type,
      m.ingredientName,
      `${m.quantity} ${m.ingredientUnit}`,
      `${m.fromLocation ?? "—"} → ${m.toLocation ?? "—"}`,
      m.reference ?? "—",
      m.userName,
      new Date(m.timestamp).toLocaleString(),
      m.totalCost.toFixed(2),
      m.isFlagged ? `FLAGGED: ${m.flagReason ?? ""}` : "Clear",
    ]),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: HEADER_BG, textColor: WHITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 8) {
        const v = String(data.cell.raw);
        if (v.startsWith("FLAGGED")) {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = GREEN;
        }
      }
      if (data.section === "body" && data.column.index === 0) {
        const v = String(data.cell.raw);
        if (v === "GRN") data.cell.styles.textColor = GREEN;
        else if (v === "ISSUE") data.cell.styles.textColor = BRAND_COLOR;
        else if (v === "ADJUSTMENT") data.cell.styles.textColor = AMBER;
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`StockMovements_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── STORE REQUESTS ─────────────────────────────────────────────────────────
export function exportStoreRequestsPDF(
  requests: {
    requestNumber: string; date: string; destination: string; requestedByName: string;
    status: string; totalRequestedCost: number; totalApprovedCost: number;
    urgency: string; items: { ingredientName: string; unit: string; requestedQty: number; approvedQty: number; fulfilledQty: number; zeroed?: boolean }[];
    managerReviewedBy?: string; financeReviewedBy?: string; fulfilledBy?: string;
  }[],
  hotelName: string,
  exportedBy: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Store Requests Report", `Multi-stage approval pipeline records`, hotelName, exportedBy);

  const fulfilled = requests.filter(r => r.status === "fulfilled").length;
  const pending = requests.filter(r => r.status === "pending").length;
  const totalApproved = requests.reduce((s, r) => s + r.totalApprovedCost, 0);

  y = addSummaryRow(doc, y, [
    { label: "Total Requests", value: String(requests.length) },
    { label: "Pending", value: String(pending), color: pending > 0 ? "amber" : "normal" },
    { label: "Fulfilled", value: String(fulfilled), color: fulfilled > 0 ? "green" : "normal" },
    { label: "Total Approved Cost (ETB)", value: totalApproved.toFixed(2) },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Req. No.", "Date", "Destination", "Requested By", "Items", "Requested (ETB)", "Approved (ETB)", "Status", "Priority"]],
    body: requests.map(r => [
      r.requestNumber,
      r.date,
      r.destination,
      r.requestedByName,
      r.items.map(i => `${i.ingredientName}: ${i.approvedQty} ${i.unit}`).join("; "),
      r.totalRequestedCost.toFixed(2),
      r.totalApprovedCost.toFixed(2),
      r.status.replace(/_/g, " ").toUpperCase(),
      r.urgency.toUpperCase(),
    ]),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: HEADER_BG, textColor: WHITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 4: { cellWidth: 70 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        const v = String(data.cell.raw);
        if (v.includes("REJECTED")) data.cell.styles.textColor = RED;
        else if (v === "FULFILLED") data.cell.styles.textColor = GREEN;
        else if (v.includes("APPROVED")) data.cell.styles.textColor = BRAND_COLOR;
        else data.cell.styles.textColor = AMBER;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 8) {
        if (String(data.cell.raw) === "URGENT") data.cell.styles.textColor = RED;
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`StoreRequests_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── BATCH EXPIRY ────────────────────────────────────────────────────────────
export function exportBatchExpiryPDF(
  batches: {
    batchNumber: string; ingredientName: string; supplier: string; location: string;
    receivedDate: string; expiryDate: string; quantity: number; originalQuantity: number;
    unit: string; costPerUnit: number; isExpired: boolean; isExpiringSoon: boolean;
  }[],
  hotelName: string,
  exportedBy: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Batch Expiry Report", `FIFO batch tracking — expiry dates and at-risk stock`, hotelName, exportedBy);

  const expired = batches.filter(b => b.isExpired);
  const expiringSoon = batches.filter(b => b.isExpiringSoon && !b.isExpired);
  const expiredValue = expired.reduce((s, b) => s + b.quantity * b.costPerUnit, 0);
  const riskValue = expiredValue + expiringSoon.reduce((s, b) => s + b.quantity * b.costPerUnit, 0);

  y = addSummaryRow(doc, y, [
    { label: "Total Batches", value: String(batches.length) },
    { label: "Expired", value: String(expired.length), color: expired.length > 0 ? "red" : "normal" },
    { label: "Expiring This Week", value: String(expiringSoon.length), color: expiringSoon.length > 0 ? "amber" : "normal" },
    { label: "Expired Value (ETB)", value: expiredValue.toFixed(2), color: expiredValue > 0 ? "red" : "normal" },
    { label: "At-Risk Value (ETB)", value: riskValue.toFixed(2), color: riskValue > 0 ? "amber" : "normal" },
  ]);

  const today = new Date().toISOString().split("T")[0];
  const sorted = [...batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  autoTable(doc, {
    startY: y,
    head: [["Batch No.", "Ingredient", "Supplier", "Location", "Received", "Expiry Date", "Days Left", "Remaining", "Original", "Stock Value (ETB)", "Status"]],
    body: sorted.map(b => {
      const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86400000);
      return [
        b.batchNumber,
        b.ingredientName,
        b.supplier,
        b.location.toUpperCase(),
        b.receivedDate,
        b.expiryDate,
        days <= 0 ? "EXPIRED" : `${days}d`,
        `${b.quantity.toFixed(3)} ${b.unit}`,
        `${b.originalQuantity.toFixed(3)} ${b.unit}`,
        (b.quantity * b.costPerUnit).toFixed(2),
        b.isExpired ? "EXPIRED" : b.isExpiringSoon ? "EXPIRING SOON" : "GOOD",
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: HEADER_BG, textColor: WHITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.column.index === 10) {
          const v = String(data.cell.raw);
          if (v === "EXPIRED") data.cell.styles.textColor = RED;
          else if (v === "EXPIRING SOON") data.cell.styles.textColor = AMBER;
          else data.cell.styles.textColor = GREEN;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 6) {
          const v = String(data.cell.raw);
          if (v === "EXPIRED") data.cell.styles.textColor = RED;
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`BatchExpiry_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── CONSUMPTION RECORDS ──────────────────────────────────────────────────────
export function exportConsumptionPDF(
  records: {
    date: string; ingredientName: string; unit: string; quantity: number;
    unitCost: number; totalCost: number; category: string; shift: string;
    recordedByName: string; approved: boolean; approvedBy?: string; notes: string;
  }[],
  hotelName: string,
  exportedBy: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, "Consumption Records", `Manual consumption log with approval status`, hotelName, exportedBy);

  const totalCost = records.reduce((s, r) => s + r.totalCost, 0);
  const approved = records.filter(r => r.approved).length;
  const pending = records.filter(r => !r.approved).length;

  y = addSummaryRow(doc, y, [
    { label: "Total Records", value: String(records.length) },
    { label: "Approved", value: String(approved), color: "green" },
    { label: "Pending Approval", value: String(pending), color: pending > 0 ? "amber" : "normal" },
    { label: "Total Cost (ETB)", value: totalCost.toFixed(2), color: "red" },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Ingredient", "Qty", "Unit Cost (ETB)", "Total Cost (ETB)", "Category", "Shift", "Recorded By", "Approved By", "Notes"]],
    body: records.map(r => [
      r.date, r.ingredientName,
      `${r.quantity.toFixed(3)} ${r.unit}`,
      r.unitCost.toFixed(2),
      r.totalCost.toFixed(2),
      r.category, r.shift, r.recordedByName,
      r.approved ? (r.approvedBy ?? "Yes") : "Pending",
      r.notes || "—",
    ]),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: HEADER_BG, textColor: WHITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 8) {
        const v = String(data.cell.raw);
        data.cell.styles.textColor = v === "Pending" ? AMBER : GREEN;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`Consumption_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── PHYSICAL COUNT (Main Store) ─────────────────────────────────────────────
export function exportPhysicalCountPDF(
  count: {
    date: string; countedByName: string;
    entries: {
      ingredientName: string; unit: string; theoreticalQty: number; physicalQty: number;
      variance: number; varianceCost: number; costPerUnit: number; notes: string;
    }[];
    totalVarianceCost: number; shortageCount: number; overageCount: number;
  },
  hotelName: string,
  exportedBy: string,
  storeType: "Main Store" | "Kitchen Store" | "Bar Store" = "Main Store",
) {
  const doc = new jsPDF({ orientation: "landscape" });
  let y = addDocHeader(doc, `${storeType} Physical Count`, `Morning physical count — ${count.date} · Counted by: ${count.countedByName}`, hotelName, exportedBy);

  y = addSummaryRow(doc, y, [
    { label: "Items Counted", value: String(count.entries.length) },
    { label: "Shortages", value: String(count.shortageCount), color: count.shortageCount > 0 ? "red" : "normal" },
    { label: "Overages", value: String(count.overageCount), color: count.overageCount > 0 ? "amber" : "normal" },
    { label: "Total Variance Cost (ETB)", value: count.totalVarianceCost.toFixed(2), color: count.totalVarianceCost > 0 ? "red" : "normal" },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Ingredient", "Unit", "Theoretical", "Physical Count", "Variance", "Cost/Unit (ETB)", "Variance Cost (ETB)", "Notes"]],
    body: count.entries.map(e => [
      e.ingredientName,
      e.unit,
      e.theoreticalQty.toFixed(3),
      e.physicalQty.toFixed(3),
      e.variance > 0 ? `+${e.variance.toFixed(3)}` : e.variance.toFixed(3),
      e.costPerUnit.toFixed(2),
      e.varianceCost > 0 ? e.varianceCost.toFixed(2) : "—",
      e.notes || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: HEADER_BG, textColor: WHITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const v = String(data.cell.raw);
        if (v.startsWith("-")) data.cell.styles.textColor = RED;
        else if (v.startsWith("+")) data.cell.styles.textColor = AMBER;
        else data.cell.styles.textColor = GREEN;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`PhysicalCount_${storeType.replace(" ", "")}_${count.date}.pdf`);
}

// ─── SYSTEM DOCUMENTATION (Full Export) ─────────────────────────────────────
export function exportSystemDocsPDF(hotelName: string, exportedBy: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const usableWidth = pageWidth - 2 * margin;
  let y = 20;

  // Cover page
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...WHITE);
  doc.text("Grar F&B", pageWidth / 2, 80, { align: "center" });
  
  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.text("Complete System Documentation", pageWidth / 2, 95, { align: "center" });
  
  doc.setFontSize(12);
  doc.setTextColor(200, 200, 255);
  doc.text(hotelName, pageWidth / 2, 110, { align: "center" });
  
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 255);
  doc.text("Food & Beverage Management System v5.0", pageWidth / 2, 120, { align: "center" });
  doc.text(new Date().toLocaleDateString(), pageWidth / 2, 130, { align: "center" });
  
  doc.setFontSize(8);
  doc.text(`Exported by: ${exportedBy}`, pageWidth / 2, pageHeight - 20, { align: "center" });

  // New page for content
  doc.addPage();
  y = margin;

  // Helper functions
  const addH1 = (text: string) => {
    if (y > pageHeight - 40) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...TEXT_DARK);
    doc.text(text, margin, y);
    y += 8;
    doc.setDrawColor(...BRAND_COLOR);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const addH2 = (text: string) => {
    if (y > pageHeight - 30) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BRAND_COLOR);
    doc.text(text, margin, y);
    y += 5;
  };

  const addH3 = (text: string) => {
    if (y > pageHeight - 25) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_DARK);
    doc.text(text, margin, y);
    y += 4;
  };

  const addPara = (text: string) => {
    if (y > pageHeight - 20) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    const lines = doc.splitTextToSize(text, usableWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  };

  const addBullet = (text: string) => {
    if (y > pageHeight - 20) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("•", margin + 2, y);
    const lines = doc.splitTextToSize(text, usableWidth - 8);
    doc.text(lines, margin + 8, y);
    y += lines.length * 4 + 1;
  };

  const addBox = (title: string, desc: string, color: [number, number, number] = BRAND_COLOR) => {
    if (y > pageHeight - 25) { doc.addPage(); y = margin; }
    doc.setFillColor(color[0] + 20, color[1] + 20, color[2] + 20, 0.1);
    doc.setDrawColor(...color);
    doc.roundedRect(margin, y - 2, usableWidth, 12, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...color);
    doc.text(title, margin + 3, y + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    const lines = doc.splitTextToSize(desc, usableWidth - 10);
    doc.text(lines, margin + 3, y + 6.5);
    y += 14;
  };

  const addStep = (n: number, label: string, desc: string) => {
    if (y > pageHeight - 20) { doc.addPage(); y = margin; }
    doc.setFillColor(...BRAND_COLOR);
    doc.circle(margin + 3, y, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(String(n), margin + 3, y + 1.5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    doc.text(label, margin + 10, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    const lines = doc.splitTextToSize(desc, usableWidth - 15);
    doc.text(lines, margin + 10, y + 5);
    y += lines.length * 3 + 6;
  };

  // Content
  addH1("System Overview");
  addH2("What is Grar F&B?");
  addPara("Grar F&B is a comprehensive Food & Beverage Management System designed for hotels and restaurants. It provides end-to-end control over inventory, recipes, sales, cost analysis, payroll, accounts, and procurement — all accessible through a browser with real-time Supabase database sync and offline localStorage fallback.");
  
  addH2("Core Capabilities");
  addBox("Cost Control", "Recipe costing, food cost %, variance alerts, target benchmarking", BRAND_COLOR);
  addBox("Inventory Tracking", "3-store inventory (Main, Kitchen, Bar) with FIFO batch management", GREEN);
  addBox("Recipe Standardization", "Chef-managed recipe library with auto cost calculation", AMBER);
  addBox("Theft Detection", "Variance analysis comparing expected vs actual consumption", RED);
  addBox("Daily Operations", "GRN, stock issues, transfers, consumption records, daily physical counts");
  addBox("Financial Reporting", "P&L reports (monthly/quarterly/6-month/annual), payroll, AR/AP aging");
  addBox("Procurement Control", "6-stage PR workflow — no GRN without approved PR");
  addBox("Role-Based Access", "11 user roles with configurable permission matrix");

  addH2("How to Get Started");
  addStep(1, "Log in with your account", "Use username + password credentials provided by the admin");
  addStep(2, "Set up ingredients in Main Store", "Navigate to Main Store → Add ingredients with unit, cost, and minimum quantity");
  addStep(3, "Create recipes (Chef only)", "Navigate to Recipes → Add recipes with ingredient quantities");
  addStep(4, "Record a GRN (storekeeper)", "Navigate to Stock Movements → New GRN → Enter supplier, invoice, items received");
  addStep(5, "Issue stock to Kitchen/Bar", "Use Stock Movements → ISSUE type and set destination to Kitchen or Bar");
  addStep(6, "Record daily sales (cashier)", "Navigate to Sales Entry → Select recipes → Enter quantities sold");
  addStep(7, "Run daily variance report (manager)", "Navigate to Reports → View ingredient variance per day/week to detect shortages or theft");

  doc.addPage();
  y = margin;
  addH1("All System Modules");
  
  addH3("📦 Main Store Inventory");
  addPara("Central ingredient registry. Add ingredients with unit, cost per unit, minimum quantity threshold, and category. Tracks live stock quantity. Low-stock alerts badge appears in sidebar when any ingredient falls below minimum.");
  
  addH3("🍳 Kitchen Store");
  addPara("Separate inventory for kitchen items transferred from Main Store. Items arrive here through stock issues/transfers. Daily physical count compares theoretical (system) vs actual (manual count) for shortage/overage detection. FIFO batch tracking enabled.");
  
  addH3("🍷 Bar Store");
  addPara("Separate inventory for bar/beverage items. Identical structure to Kitchen Store. When bar-categorized recipes are sold, the system deducts from Bar Stock first with fallback to Kitchen Stock.");
  
  addH3("📋 Store Requests (Kitchen/Bar → Main Store)");
  addPara("4-stage internal requisition workflow: Kitchen/Bar Head submits → F&B Manager reviews (can adjust/zero items) → Finance Head approves (can further adjust) → Storekeeper fulfills (deducts main, adds to kitchen/bar, FIFO batch transfer).");
  
  addH3("🛒 Purchase Requests (External Procurement)");
  addPara("7-stage procurement pipeline ensuring no GRN without an approved PR: Submit → Storekeeper Review → Finance Approval → Owner Decision → Purchaser Procures (with real qty + price) → Quality Check → Auto-Add to Main Store.");
  
  addH3("📊 Stock Movements");
  addPara("Audit trail of all inventory movements: GRN (goods received), ISSUE (to kitchen/bar), TRANSFER (store-to-store), ADJUSTMENT (waste/damage), RETURN. Each movement synced to Supabase. Suspicious movements can be flagged.");
  
  addH3("🧾 Sales Entry");
  addPara("Record daily sales by recipe and quantity. Revenue, COGS, and gross profit auto-calculated. Sales automatically deduct from Kitchen or Bar stock based on recipe category using FIFO batch logic.");
  
  addH3("📖 Recipe Management");
  addPara("Chef-managed recipe library. Recipes are created independently of stock levels — the chef can add any ingredient by name. Each recipe auto-calculates food cost %, suggests selling price, and tracks total cost per portion.");
  
  addH3("📈 Consumption Records");
  addPara("Manual recording of ingredient usage outside of sales (wastage, staff meals, events, testing). Each record requires category, quantity, and notes. Manager approval workflow for accountability.");
  
  addH3("📅 Daily Inventory");
  addPara("Physical count sheets for Main, Kitchen, and Bar stores. The system computes theoretical closing stock (opening + transfers − usage − consumption). Staff enters physical count and the system calculates variance and variance cost.");
  
  addH3("⏰ Batch Expiry Report");
  addPara("All FIFO batch records across all 3 stores displayed with expiry status: Active (green), Expiring Soon within 7 days (amber), Expired (red). Days until expiry countdown shown.");
  
  addH3("📉 Reports & Analytics");
  addPara("Revenue by category charts, food cost % trends, top-selling items, stock movement history. 7-day daily trend with profit line.");
  
  addH3("📊 Profit & Loss Report");
  addPara("Executive P&L filterable by period (Monthly/Quarterly/6-Month/Annual), year, and department. Shows Revenue, COGS, Gross Profit, Labor Cost, Net Income, and margins. Recharts area/bar charts. Branded PDF export.");
  
  addH3("👷 Payroll Management");
  addPara("Monthly payroll processing with Ethiopian Income Tax brackets (0%–35%), 7% employee pension, 11% employer pension, and 10% service charge distribution from total sales. Bank of Abyssinia account tracking.");
  
  addH3("💰 Accounts Receivable");
  addPara("Track client invoices (travel agents, corporate) with 0-30, 31-60, 61+ day aging buckets. Assign to Collector role with in-app notification. Payment history recording.");
  
  addH3("📑 Accounts Payable");
  addPara("Track supplier invoices with same aging bucket system. Payment recording with reference numbers.");

  doc.addPage();
  y = margin;
  addH1("User Roles & Access");
  addPara("All 11 roles are configurable by Admin via the Settings → Role Permissions matrix.");
  
  const roles = [
    ["admin", "Admin", "Full system access, can bypass any approval step, manages users and permissions"],
    ["manager", "F&B Manager", "Approves store requests, consumption, daily inventory, views reports and P&L"],
    ["storekeeper", "Storekeeper", "GRN, stock movements, store request fulfillment, PR quality check"],
    ["kitchen", "Kitchen Head", "Submits store requests, records consumption, views kitchen stock"],
    ["cashier", "Cashier", "Records daily sales"],
    ["finance", "Finance Head", "Approves store requests and purchase requests, views payroll/AR/AP"],
    ["owner", "Owner / Director", "Final PR approval, can adjust/zero items, assigns to purchaser"],
    ["purchaser", "Purchaser", "Receives assigned PRs, confirms goods with real qty+price, triggers quality check"],
    ["collector", "AR Collector", "Receives AR assignments, confirms collection of client payments"],
    ["hod", "Dept. Head (HOD)", "Views own department P&L, submits store/purchase requests for their dept"],
    ["audit", "Internal Auditor", "Read-only access to sales, stock movements, AR/AP, payroll, reports"],
  ];
  
  roles.forEach(([role, label, resp]) => {
    addBullet(`${label} (${role}): ${resp}`);
  });

  doc.addPage();
  y = margin;
  addH1("Key Operational Workflows");
  
  addH2("Store Request Flow (Internal — Kitchen/Bar to Main Store)");
  addStep(1, "Kitchen/Bar Head submits request", "Lists items needed with quantities and urgency. Auto-calculated total cost shown.");
  addStep(2, "F&B Manager reviews", "Can approve as-is, reduce quantities on individual items, or zero specific items.");
  addStep(3, "Finance Head reviews", "Can further reduce quantities (cannot exceed manager-approved qty) or zero items.");
  addStep(4, "Storekeeper fulfills", "Enters actual fulfilled quantities. Main Store deducts, Kitchen/Bar stock adds. FIFO batch transfer triggered.");
  
  addH2("Purchase Request Flow (External — Procurement)");
  addStep(1, "Department submits PR", "Kitchen/Bar/HOD/Storekeeper creates PR with items, estimated costs, urgency, and purpose.");
  addStep(2, "Storekeeper forwards (if submitted by dept head)", "Storekeeper reviews and forwards to Finance. Storekeeper PRs go directly to Finance.");
  addStep(3, "Finance Head approves", "Finance reviews budget alignment and approves or rejects with notes.");
  addStep(4, "Owner/Admin final approval", "Owner can adjust or zero individual item quantities, then assigns to a Purchaser.");
  addStep(5, "Purchaser confirms receipt", "Enters REAL received quantities and ACTUAL unit prices per item (not estimates). Adds supplier name and invoice number.");
  addStep(6, "Quality Check (Storekeeper/F&B Manager)", "Inspect received goods for quality. Approve to automatically add items to Main Store inventory with actual prices.");
  addStep(7, "GRN complete → Items in Main Store", "Approved items automatically create or update ingredients in Main Store. Actual cost updates ingredient cost per unit.");
  
  addH2("Daily Operations Flow");
  addStep(1, "Morning physical count", "F&B Manager or Storekeeper counts physical stock in each store and submits Daily Inventory sheet.");
  addStep(2, "Issue stock to Kitchen/Bar", "Storekeeper creates ISSUE or TRANSFER movement. Stock moves from Main Store to Kitchen/Bar.");
  addStep(3, "Sales recording", "Cashier records sales by recipe. System auto-deducts from Kitchen or Bar stock using FIFO.");
  addStep(4, "Consumption recording", "Kitchen Head records wastage, staff meals, testing. Manager approves.");
  addStep(5, "Variance review", "F&B Manager reviews variance report to identify unexpected consumption or potential theft.");
  addStep(6, "Batch expiry check", "Storekeeper checks batch expiry report and flags near-expiry items for priority use.");
  
  addH2("FIFO Batch Logic");
  addPara("Every GRN creates an IngredientBatch record with batch number, supplier, received date, expiry date, quantity, and location. When stock is consumed (via sales, consumption records, or store request fulfillment), the oldest batch is depleted first. When stock is transferred between stores, batch records are cloned to the destination maintaining FIFO continuity.");
  
  addH2("Variance Detection Logic");
  addPara("Expected consumption = Sum of (recipe ingredient quantity × recipe sales quantity) for each ingredient. Actual consumption = consumption records + sales-triggered deductions. Variance = Expected − Actual. Warning threshold: >10%. Critical threshold: >25%. Variance cost = |variance| × ingredient cost per unit.");

  doc.addPage();
  y = margin;
  addH1("Data Architecture");
  
  addH2("Supabase Database (Live — Core Tables)");
  addBullet("ingredients — Main Store ingredient catalog — synced in real-time");
  addBullet("recipes — Recipe library with ingredient JSON — chef managed");
  addBullet("sales — Daily sales records with item JSON");
  addBullet("stock_movements — Full audit trail of all GRN/ISSUE/TRANSFER/ADJUSTMENT/RETURN");
  
  addH2("localStorage Stores (Operational/FIFO)");
  addBullet("fnb_users — All system user accounts with roles and credentials");
  addBullet("fnb_kitchen_stock — Kitchen sub-inventory (real-time quantities)");
  addBullet("fnb_bar_stock — Bar sub-inventory (real-time quantities)");
  addBullet("fnb_batches — FIFO batch records across all 3 stores");
  addBullet("fnb_store_requests — 4-stage internal store request pipeline");
  addBullet("fnb_purchase_requests — 7-stage external purchase request pipeline");
  addBullet("fnb_employees — Employee roster with payroll data");
  addBullet("fnb_payroll — Monthly payroll records");
  addBullet("fnb_accounts_receivable — Client invoice aging and collection");
  addBullet("fnb_accounts_payable — Supplier invoice aging and payment");
  addBullet("fnb_notifications — In-app notification feed");
  addBullet("fnb_daily_inventory — Physical count sheets");
  addBullet("fnb_activity_log — Full audit trail (500 entry cap)");
  
  addH2("Data Sync Strategy");
  addPara("Core tables (ingredients, recipes, sales, stock_movements) read from Supabase first. If Supabase returns data, localStorage is kept in sync for offline access and FIFO/batch operations. If Supabase is unavailable, the app falls back to localStorage seamlessly. Complex FIFO deduction logic (batch records, kitchen/bar stock updates) remains in localStorage for performance and atomicity.");

  doc.addPage();
  y = margin;
  addH1("Financial Modules");
  
  addH2("Ethiopian Payroll Tax Brackets (2025/2026)");
  addBullet("0 – 2,000 ETB: 0% tax, 0 deduction");
  addBullet("2,001 – 4,000 ETB: 15% tax, 300 deduction");
  addBullet("4,001 – 7,000 ETB: 20% tax, 500 deduction");
  addBullet("7,001 – 10,000 ETB: 25% tax, 850 deduction");
  addBullet("10,001 – 14,000 ETB: 30% tax, 1,350 deduction");
  addBullet("14,001+ ETB: 35% tax, 2,050 deduction");
  
  addH2("Payroll Calculation Formula");
  addPara("Service Charge = 10% of total monthly sales ÷ number of active employees");
  addPara("Employee Pension = Gross Salary × 7%");
  addPara("Employer Pension = Gross Salary × 11%");
  addPara("Taxable Income = Gross Salary (pension deducted before tax per Ethiopian law)");
  addPara("Income Tax = calculated via brackets above based on Gross Salary");
  addPara("Net Salary = (Gross Salary + Service Charge) − Employee Pension − Income Tax");
  
  addH2("P&L Report Metrics");
  addBullet("Revenue — Sum of all sale item total prices for the period");
  addBullet("COGS — Sum of total costs from sales records");
  addBullet("Gross Profit — Revenue − COGS");
  addBullet("Gross Margin % — (Gross Profit ÷ Revenue) × 100");
  addBullet("Labor Cost — Sum of (Net Salary + Employer Pension) from payroll records");
  addBullet("Net Income — Gross Profit − Labor Cost");
  addBullet("Net Margin % — (Net Income ÷ Revenue) × 100");
  addBullet("Food Cost % — (COGS ÷ Revenue) × 100");
  
  addH2("AR Aging Buckets");
  addBullet("0-30 days — Current or up to 30 days — Monitor, send reminder");
  addBullet("31-60 days — 31 to 60 days past due — Assign collector, escalate");
  addBullet("61+ days — More than 60 days — Urgent collection, possible legal action");

  doc.addPage();
  y = margin;
  addH1("Technical Stack");
  addBullet("React 18.3.1 — UI framework with hooks and components");
  addBullet("TypeScript 5.5.3 — Type safety across all files");
  addBullet("Vite 5.4.1 — Fast build tool and dev server");
  addBullet("Tailwind CSS 3.4.11 — Utility-first styling");
  addBullet("shadcn/ui — Component library (cards, dialogs, forms)");
  addBullet("Supabase — PostgreSQL database + authentication (OnSpace Cloud)");
  addBullet("React Router DOM 6.x — Client-side routing");
  addBullet("Recharts — Charts (AreaChart, BarChart, LineChart)");
  addBullet("jsPDF + autotable — Branded landscape PDF export");
  addBullet("Sonner — Toast notifications");
  addBullet("lucide-react — Icon library");
  addBullet("localStorage — FIFO batches, kitchen/bar stock, sessions");
  
  addH2("Supabase DB Tables");
  addPara("Tables created in OnSpace Cloud (Supabase-compatible). All tables have RLS enabled with open policies (since auth is handled by localStorage user system).");
  addBullet("ingredients — id (text), name, unit, cost_per_unit, current_quantity, min_quantity, category");
  addBullet("recipes — id (text), name, category, ingredients (jsonb), total_cost, selling_price, active");
  addBullet("sales — id (text), date, items (jsonb), total_revenue, total_cost, gross_profit, shift");
  addBullet("stock_movements — id (text), ingredient_id, quantity, type, user_id, timestamp, unit_cost, is_flagged");

  // Footer on all pages
  addFooter(doc);
  
  doc.save(`SystemDocumentation_${hotelName.replace(/\s+/g, "")}_${new Date().toISOString().split("T")[0]}.pdf`);
}
