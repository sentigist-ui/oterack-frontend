// Core entity types for F&B Management System

export type UserRole = "admin" | "manager" | "storekeeper" | "kitchen" | "cashier" | "finance" | "owner" | "purchaser" | "collector" | "hod" | "audit";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username: string;
  password: string;
  email: string;
  active: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // kg, liter, pcs, g, ml, bottle
  costPerUnit: number;
  currentQuantity: number;
  minQuantity: number; // low stock threshold
  category: string; // "dry", "fresh", "beverage", "dairy", etc.
  supplierId?: string;
  lastUpdated: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: "Food" | "Beverage";
  subCategory: string;
  portionSize: string;
  sellingPrice: number;
  ingredients: RecipeIngredient[];
  totalCost: number;
  foodCostPercent: number;
  suggestedPrice: number;
  preparationTime: number; // minutes
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType =
  | "GRN"       // Goods Receiving
  | "ISSUE"     // Issue to kitchen/bar
  | "TRANSFER"  // Store to store transfer
  | "ADJUSTMENT"// Waste, damage, correction
  | "RETURN";   // Return from kitchen

export interface StockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientUnit: string;
  quantity: number;
  type: StockMovementType;
  userId: string;
  userName: string;
  approvedBy?: string;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  reference?: string; // GRN number, order number, etc.
  timestamp: string;
  unitCost: number;
  totalCost: number;
  isFlagged?: boolean;
  flagReason?: string;
}

export interface SaleItem {
  recipeId: string;
  recipeName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  recordedBy: string;
  shift: "Morning" | "Afternoon" | "Evening" | "Night";
  notes?: string;
}

export interface VarianceItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  expectedConsumption: number;
  actualConsumption: number;
  variance: number;
  variancePercent: number;
  status: "ok" | "warning" | "critical";
  potentialLoss: number; // in currency
  period: string;
}

export interface Alert {
  id: string;
  type: "low_stock" | "high_variance" | "suspicious_movement" | "cost_overrun";
  severity: "info" | "warning" | "critical";
  message: string;
  ingredientId?: string;
  ingredientName?: string;
  timestamp: string;
  isRead: boolean;
}

export interface DashboardStats {
  todayRevenue: number;
  todayCost: number;
  todayProfit: number;
  foodCostPercent: number;
  targetFoodCostPercent: number;
  lowStockCount: number;
  criticalVarianceCount: number;
  topSellingItems: { name: string; qty: number; revenue: number }[];
  revenueByCategory: { category: string; amount: number }[];
  recentAlerts: Alert[];
}

export interface GRNItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  totalCost: number;
}

export interface GRN {
  id: string;
  date: string;
  supplier: string;
  invoiceNumber: string;
  items: GRNItem[];
  totalAmount: number;
  receivedBy: string;
  approvedBy?: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
}

export interface AppSettings {
  hotelName: string;
  currency: string;
  currencySymbol: string;
  targetFoodCostPercent: number;
  targetBeverageCostPercent: number;
  varianceWarningPercent: number;
  varianceCriticalPercent: number;
  waterPerGuestBottles: number;
  lowStockAlertEnabled: boolean;
  varianceAlertEnabled: boolean;
  theme: "dark" | "light";
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

// Ingredient batch for FIFO tracking
export interface IngredientBatch {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  batchNumber: string;
  supplier: string;
  quantity: number;          // remaining quantity in this batch
  originalQuantity: number;  // quantity when received
  costPerUnit: number;
  receivedDate: string;      // ISO date string
  expiryDate: string;        // ISO date string
  receivedBy: string;
  grnReference: string;
  isExpired: boolean;
  isExpiringSoon: boolean;   // within 7 days
  location: "main" | "kitchen" | "bar";
}

// Store Request — kitchen/bar requests items from main store
export type StoreRequestStatus =
  | "pending"           // created by kitchen/bar
  | "manager_approved"  // F&B manager approved (may adjust qty)
  | "manager_rejected"  // F&B manager rejected
  | "finance_approved"  // Finance head approved (may adjust qty)
  | "finance_rejected"  // Finance head rejected
  | "fulfilled"         // Storekeeper sent to kitchen/bar
  | "partially_fulfilled"; // Storekeeper sent partial

export interface StoreRequestItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  requestedQty: number;
  managerAdjustedQty?: number;  // if manager reduced
  financeAdjustedQty?: number;  // if finance reduced
  approvedQty: number;          // final approved quantity
  fulfilledQty: number;         // actually sent
  unitCost: number;
  totalCost: number;
  notes?: string;
  zeroed?: boolean;             // manager/finance zeroed this item
}

export interface StoreRequest {
  id: string;
  requestNumber: string;
  date: string;
  destination: "Kitchen" | "Bar";
  requestedBy: string;
  requestedByName: string;
  items: StoreRequestItem[];
  totalRequestedCost: number;
  totalApprovedCost: number;
  status: StoreRequestStatus;
  managerNotes?: string;
  managerReviewedBy?: string;
  managerReviewedAt?: string;
  financeNotes?: string;
  financeReviewedBy?: string;
  financeReviewedAt?: string;
  fulfilledBy?: string;
  fulfilledAt?: string;
  createdAt: string;
  urgency: "normal" | "urgent";
}

// Bar Store - separate stock held in bar
export interface BarStockItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  costPerUnit: number;
  currentQuantity: number;
  lastUpdated: string;
}

// Kitchen Store - separate stock held in kitchen/bar
export interface KitchenStockItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  costPerUnit: number;
  currentQuantity: number;
  lastUpdated: string;
}

// Daily Inventory count entry
export type DailyInventoryStatus = "shortage" | "overage" | "ok";

export interface DailyInventoryEntry {
  id: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  openingStock: number;       // from kitchen store at start of day
  transferredIn: number;      // transfers from main store during day
  theoreticalUsage: number;   // from sales (recipe × qty)
  manualConsumption: number;  // from consumption records
  theoreticalClosing: number; // openingStock + transferredIn - theoreticalUsage - manualConsumption
  physicalCount: number;      // manually entered actual count
  variance: number;           // physicalCount - theoreticalClosing (+overage / -shortage)
  status: DailyInventoryStatus;
  costPerUnit: number;
  varianceCost: number;       // Math.abs(variance) * costPerUnit
  notes: string;
  recordedBy: string;
  recordedByName: string;
  isShortageReported: boolean;
}

export interface DailyInventorySheet {
  id: string;
  date: string;
  entries: DailyInventoryEntry[];
  totalVarianceCost: number;
  shortageCount: number;
  overageCount: number;
  status: "draft" | "submitted" | "approved";
  submittedBy?: string;
  approvedBy?: string;
  createdAt: string;
}

export type ConsumptionCategory = "Kitchen" | "Bar" | "Events" | "Staff Meal" | "Wastage" | "Testing" | "Other";

// ─── Employee & Payroll ─────────────────────────────────────────────────────
export interface Employee {
  id: string;
  name: string;
  hotelRole: string;         // Their role in the hotel (e.g., Waiter, Chef, Manager)
  department: string;        // Kitchen, Bar, Front Office, etc.
  systemRole: UserRole;      // login role
  grossSalary: number;       // monthly gross in ETB
  bankAccount: string;       // Bank of Abyssinia account number
  hiredDate: string;
  active: boolean;
  email?: string;
  phone?: string;
}

export interface PayrollRecord {
  id: string;
  month: string;             // YYYY-MM
  employeeId: string;
  employeeName: string;
  hotelRole: string;
  department: string;
  grossSalary: number;
  serviceCharge: number;     // 10% of monthly total sales ÷ employee count
  totalIncome: number;       // grossSalary + serviceCharge
  employeePension: number;   // 7% of grossSalary
  employerPension: number;   // 11% of grossSalary
  taxableIncome: number;     // grossSalary (pension deducted before tax in ET law)
  incomeTax: number;         // computed via Ethiopian tax brackets
  totalDeductions: number;   // employeePension + incomeTax
  netSalary: number;         // totalIncome - totalDeductions
  bankAccount: string;
  processedBy: string;
  processedAt: string;
  status: "draft" | "processed" | "paid";
}

// Ethiopian Income Tax Brackets (2025/2026)
export const ET_TAX_BRACKETS = [
  { min: 0,      max: 2000,  rate: 0,    deduction: 0 },
  { min: 2001,   max: 4000,  rate: 0.15, deduction: 300 },
  { min: 4001,   max: 7000,  rate: 0.20, deduction: 500 },
  { min: 7001,   max: 10000, rate: 0.25, deduction: 850 },
  { min: 10001,  max: 14000, rate: 0.30, deduction: 1350 },
  { min: 14001,  max: Infinity, rate: 0.35, deduction: 2050 },
];

export function calcEthiopianTax(taxableIncome: number): number {
  const bracket = ET_TAX_BRACKETS.find(b => taxableIncome >= b.min && taxableIncome <= b.max)
    ?? ET_TAX_BRACKETS[ET_TAX_BRACKETS.length - 1];
  return Math.max(0, taxableIncome * bracket.rate - bracket.deduction);
}

// ─── Accounts Receivable & Payable ──────────────────────────────────────────
export type ARStatus = "outstanding" | "partially_paid" | "paid" | "overdue";
export type APStatus = "unpaid" | "partially_paid" | "paid" | "overdue";

export interface AccountReceivable {
  id: string;
  invoiceNumber: string;
  clientName: string;        // Travel Agent, Corporate account, etc.
  clientType: "travel_agent" | "corporate" | "group" | "other";
  invoiceDate: string;       // ISO date
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: ARStatus;
  agingBucket: "0-30" | "31-60" | "61+"; // days overdue
  notes?: string;
  createdBy: string;
  assignedCollector?: string;   // collector user id
  collectorName?: string;
  collectorNotified: boolean;
  collectorConfirmed: boolean;
  collectorConfirmedAt?: string;
  payments: { date: string; amount: number; reference: string; recordedBy: string }[];
}

export interface AccountPayable {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  category: "food_supplier" | "beverage_supplier" | "equipment" | "utilities" | "other";
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: APStatus;
  agingBucket: "0-30" | "31-60" | "61+";
  notes?: string;
  createdBy: string;
  payments: { date: string; amount: number; reference: string; recordedBy: string }[];
}

// ─── Purchase Request (PR) ──────────────────────────────────────────────────
export type PRStatus =
  | "pending"              // created by Kitchen/Bar Head or Storekeeper
  | "storekeeper_review"   // storekeeper forwarded to finance (if submitted by dept head)
  | "finance_review"       // finance reviewing
  | "finance_approved"     // finance approved → goes to owner
  | "finance_rejected"
  | "owner_approved"       // owner/admin approved → goes to purchaser
  | "owner_rejected"
  | "sent_to_purchaser"    // owner sent to purchaser — purchaser procures and confirms
  | "purchaser_confirmed"  // purchaser entered real qty + price → awaiting quality check
  | "quality_check"        // storekeeper/F&B inspecting received goods
  | "grn_received"         // quality approved → items auto-added to main store
  | "closed";

export interface PRItem {
  id: string;
  ingredientId?: string;
  itemName: string;
  unit: string;
  requestedQty: number;
  approvedQty: number;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  notes?: string;
  zeroed?: boolean;
}

// Items confirmed by purchaser with real quantities and prices
export interface PurchaserConfirmedItem {
  itemId: string;
  itemName: string;
  unit: string;
  orderedQty: number;       // what was approved
  receivedQty: number;      // what actually arrived
  unitPrice: number;        // real purchase price per unit
  totalPrice: number;       // receivedQty × unitPrice
  supplierName?: string;
  invoiceNumber?: string;
  notes?: string;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  date: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;   // kitchen, storekeeper, etc.
  department: string;        // Kitchen, Bar, Store
  items: PRItem[];
  totalEstimatedCost: number;
  totalApprovedCost: number;
  status: PRStatus;
  urgency: "normal" | "urgent";
  purpose: string;           // reason for purchase
  storekeeperNotes?: string;
  storekeeperReviewedBy?: string;
  storekeeperReviewedAt?: string;
  financeNotes?: string;
  financeReviewedBy?: string;
  financeReviewedAt?: string;
  ownerNotes?: string;
  ownerReviewedBy?: string;
  ownerReviewedAt?: string;
  purchaserNotes?: string;
  purchaserAssignedTo?: string;
  purchaserAssignedName?: string;
  sentToPurchaserAt?: string;
  grnCompletedAt?: string;
  grnReference?: string;
  // Purchaser confirmation fields
  purchaserConfirmedItems?: PurchaserConfirmedItem[];
  purchaserConfirmedAt?: string;
  purchaserInvoiceNumber?: string;
  purchaserSupplierName?: string;
  purchaserTotalActualCost?: number;
  // Quality check fields
  qualityCheckedBy?: string;
  qualityCheckedByName?: string;
  qualityCheckedAt?: string;
  qualityNotes?: string;
  createdAt: string;
}

// ─── Vendor Orders (PR split) ───────────────────────────────────────────────
export interface VendorOrder {
  id: string;
  vendorName: string;
  vendorContact?: string;
  items: { itemId: string; itemName: string; qty: number; unit: string }[];
  status: "ordered" | "partially_received" | "fully_received";
  createdAt: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  recipientUserId: string;
  recipientRole?: string;
  title: string;
  message: string;
  type: "ar_collection" | "pr_approval" | "pr_action" | "general" | "consumption_approval";
  relatedId?: string;        // AR id or PR id
  isRead: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ConsumptionRecord {
  id: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  category: ConsumptionCategory;
  notes: string;
  recordedBy: string;
  recordedByName: string;
  shift: "Morning" | "Afternoon" | "Evening" | "Night";
  approved: boolean;
  approvedBy?: string;
}

// ─── Fixed Assets Management ─────────────────────────────────────────────────────────────────────────────
export type FixedAssetCategory = "Furniture" | "Equipment" | "Electronics" | "Kitchen Appliances" | "Bar Appliances" | "HVAC" | "Plumbing" | "Other";
export type FixedAssetStatus = "active" | "maintenance" | "retired" | "disposed";

export interface FixedAsset {
  id: string;
  name: string;
  category: FixedAssetCategory;
  purchaseDate: string;           // ISO date
  purchasePrice: number;
  supplier: string;
  location: string;               // Kitchen, Bar, Main Store, Office, etc.
  serialNumber?: string;
  model?: string;
  condition: "excellent" | "good" | "fair" | "poor";
  depreciationRate?: number;      // annual % depreciation
  usefulLife?: number;            // years
  currentValue: number;           // calculated or manual
  status: FixedAssetStatus;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyAssetCount {
  id: string;
  month: string;                  // YYYY-MM
  countDate: string;              // ISO date
  countedBy: string;
  countedByName: string;
  entries: MonthlyAssetEntry[];
  totalAssets: number;
  missingAssets: number;          // assets from previous month not found
  newAssets: number;              // assets counted but not in previous
  totalValue: number;
  totalDepreciation: number;      // since purchase
  status: "draft" | "submitted" | "approved";
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface MonthlyAssetEntry {
  assetId: string;
  assetName: string;
  category: FixedAssetCategory;
  location: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  depreciation: number;           // total depreciation since purchase
  condition: "excellent" | "good" | "fair" | "poor";
  physicallyVerified: boolean;    // counted this month
  notes: string;
  previouslyExisted: boolean;     // was in last month's count
}
