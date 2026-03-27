import type { User, Ingredient, Recipe, StockMovement, Sale, GRN, AppSettings, ActivityLog, ConsumptionRecord, Employee, AccountReceivable, AccountPayable } from "@/types";
import { daysAgo } from "@/lib/utils";

export const MOCK_USERS: User[] = [
  { id: "u1", name: "Sentayehu Berhanu", role: "admin", username: "admin", password: "admin123", email: "Sentayehuberhanu12@gmail.com", active: true },
  { id: "u2", name: "Selamawit Haile", role: "manager", username: "manager", password: "manager123", email: "manager@hotel.com", active: true },
  { id: "u3", name: "Dawit Bekele", role: "storekeeper", username: "storekeeper", password: "store123", email: "store@hotel.com", active: true },
  { id: "u4", name: "Yonas Tadesse", role: "kitchen", username: "kitchen", password: "kitchen123", email: "kitchen@hotel.com", active: true },
  { id: "u5", name: "Tigist Alemu", role: "cashier", username: "cashier", password: "cashier123", email: "cashier@hotel.com", active: true },
  { id: "u6", name: "Mekdes Girma", role: "finance", username: "finance", password: "finance123", email: "finance@hotel.com", active: true },
  { id: "u7", name: "Abebe Worku", role: "owner", username: "owner", password: "owner123", email: "owner@hotel.com", active: true },
  { id: "u8", name: "Fekadu Assefa", role: "purchaser", username: "purchaser", password: "purchase123", email: "purchaser@hotel.com", active: true },
  { id: "u9", name: "Hiwot Negash", role: "collector", username: "collector", password: "collect123", email: "collector@hotel.com", active: true },
  { id: "u10", name: "Biruk Tesfaye", role: "hod", username: "hod", password: "hod123", email: "hod@hotel.com", active: true },
  { id: "u11", name: "Alem Bekele", role: "audit", username: "audit", password: "audit123", email: "audit@hotel.com", active: true },
];

// ─── All operational data starts empty — enter real data via the app ──────────
export const MOCK_INGREDIENTS: Ingredient[] = [];
export const MOCK_RECIPES: Recipe[] = [];
export const MOCK_STOCK_MOVEMENTS: StockMovement[] = [];
export const MOCK_SALES: Sale[] = [];
export const MOCK_GRNS: GRN[] = [];
export const MOCK_ACTIVITY_LOGS: ActivityLog[] = [];
export const MOCK_CONSUMPTION_RECORDS: ConsumptionRecord[] = [];
export const MOCK_AR: AccountReceivable[] = [];
export const MOCK_AP: AccountPayable[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  hotelName: "Haile Grand Hotel",
  currency: "ETB",
  currencySymbol: "ETB",
  targetFoodCostPercent: 35,
  targetBeverageCostPercent: 30,
  varianceWarningPercent: 10,
  varianceCriticalPercent: 25,
  waterPerGuestBottles: 2,
  lowStockAlertEnabled: true,
  varianceAlertEnabled: true,
  theme: "dark",
};

// ─── Employees — mirrors the system user accounts ────────────────────────────
export const MOCK_EMPLOYEES: Employee[] = [
  { id: "e1", name: "Sentayehu Berhanu", hotelRole: "General Manager",     department: "Management",   systemRole: "admin",       grossSalary: 0, bankAccount: "", hiredDate: "2020-01-01", active: true },
  { id: "e2", name: "Selamawit Haile",   hotelRole: "F&B Manager",         department: "F&B",          systemRole: "manager",     grossSalary: 0, bankAccount: "", hiredDate: "2020-03-15", active: true },
  { id: "e3", name: "Dawit Bekele",      hotelRole: "Head Storekeeper",    department: "Store",        systemRole: "storekeeper", grossSalary: 0, bankAccount: "", hiredDate: "2021-05-01", active: true },
  { id: "e4", name: "Yonas Tadesse",     hotelRole: "Head Chef",           department: "Kitchen",      systemRole: "kitchen",     grossSalary: 0, bankAccount: "", hiredDate: "2020-09-01", active: true },
  { id: "e5", name: "Tigist Alemu",      hotelRole: "Senior Cashier",      department: "Finance",      systemRole: "cashier",     grossSalary: 0, bankAccount: "", hiredDate: "2022-01-15", active: true },
  { id: "e6", name: "Mekdes Girma",      hotelRole: "Finance Head",        department: "Finance",      systemRole: "finance",     grossSalary: 0, bankAccount: "", hiredDate: "2021-02-01", active: true },
  { id: "e7", name: "Abebe Worku",       hotelRole: "Owner / Director",    department: "Management",   systemRole: "owner",       grossSalary: 0, bankAccount: "", hiredDate: "2019-01-01", active: true },
  { id: "e8", name: "Fekadu Assefa",     hotelRole: "Procurement Officer", department: "Procurement",  systemRole: "purchaser",   grossSalary: 0, bankAccount: "", hiredDate: "2022-06-01", active: true },
  { id: "e9", name: "Hiwot Negash",      hotelRole: "AR Collector",        department: "Finance",      systemRole: "collector",   grossSalary: 0, bankAccount: "", hiredDate: "2023-03-01", active: true },
  { id: "e10", name: "Biruk Tesfaye",    hotelRole: "Bar Manager (HOD)",   department: "Bar",          systemRole: "hod",         grossSalary: 0, bankAccount: "", hiredDate: "2021-07-01", active: true },
  { id: "e11", name: "Alem Bekele",      hotelRole: "Internal Auditor",    department: "Audit",        systemRole: "audit",       grossSalary: 0, bankAccount: "", hiredDate: "2022-11-01", active: true },
];
