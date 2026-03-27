import type {
  User, Ingredient, Recipe, StockMovement, Sale, GRN, AppSettings,
  Alert, ActivityLog, ConsumptionRecord, KitchenStockItem, BarStockItem,
  DailyInventorySheet, IngredientBatch, StoreRequest, StoreRequestItem,
  Employee, PayrollRecord, AccountReceivable, AccountPayable, PurchaseRequest, AppNotification,
} from "@/types";
import {
  MOCK_USERS, MOCK_INGREDIENTS, MOCK_RECIPES, MOCK_STOCK_MOVEMENTS,
  MOCK_SALES, MOCK_GRNS, DEFAULT_SETTINGS, MOCK_ACTIVITY_LOGS, MOCK_CONSUMPTION_RECORDS,
  MOCK_EMPLOYEES, MOCK_AR, MOCK_AP,
} from "@/constants/mockData";

export const KEYS = {
  USERS: "fnb_users",
  INGREDIENTS: "fnb_ingredients",
  RECIPES: "fnb_recipes",
  STOCK_MOVEMENTS: "fnb_stock_movements",
  SALES: "fnb_sales",
  GRNS: "fnb_grns",
  SETTINGS: "fnb_settings",
  ALERTS: "fnb_alerts",
  AUTH: "fnb_auth_user",
  INITIALIZED: "fnb_initialized",
  ACTIVITY_LOG: "fnb_activity_log",
  CONSUMPTION: "fnb_consumption",
  KITCHEN_STOCK: "fnb_kitchen_stock",
  BAR_STOCK: "fnb_bar_stock",
  DAILY_INVENTORY: "fnb_daily_inventory",
  BATCHES: "fnb_batches",
  STORE_REQUESTS: "fnb_store_requests",
  EMPLOYEES: "fnb_employees",
  PAYROLL: "fnb_payroll",
  ACCOUNTS_RECEIVABLE: "fnb_accounts_receivable",
  ACCOUNTS_PAYABLE: "fnb_accounts_payable",
  PURCHASE_REQUESTS: "fnb_purchase_requests",
  NOTIFICATIONS: "fnb_notifications",
};

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── FIFO Batch Deduction ─────────────────────────────────────────────────────
// Deducts qty from oldest batches first (FIFO) for the given ingredient & location
function deductBatchFIFO(ingredientId: string, qty: number, location: "main" | "kitchen" | "bar"): void {
  const all = get<IngredientBatch[]>(KEYS.BATCHES, []);
  // Sort by received date ascending (oldest first)
  const relevant = all
    .filter(b => b.ingredientId === ingredientId && b.location === location && b.quantity > 0)
    .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));

  let remaining = qty;
  for (const batch of relevant) {
    if (remaining <= 0) break;
    const idx = all.findIndex(b => b.id === batch.id);
    const deduct = Math.min(batch.quantity, remaining);
    all[idx].quantity = Math.max(0, all[idx].quantity - deduct);
    remaining -= deduct;
  }
  set(KEYS.BATCHES, all);
}

// ─── Users ────────────────────────────────────────────────────────────────────
export const Users = {
  getAll: () => get<User[]>(KEYS.USERS, []),
  getById: (id: string) => get<User[]>(KEYS.USERS, []).find(u => u.id === id),
  getByUsername: (username: string) => get<User[]>(KEYS.USERS, []).find(u => u.username === username),
  save: (users: User[]) => set(KEYS.USERS, users),
  upsert: (user: User) => {
    const all = get<User[]>(KEYS.USERS, []);
    const idx = all.findIndex(u => u.id === user.id);
    if (idx >= 0) all[idx] = user; else all.push(user);
    set(KEYS.USERS, all);
  },
  delete: (id: string) => set(KEYS.USERS, get<User[]>(KEYS.USERS, []).filter(u => u.id !== id)),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const Auth = {
  getUser: () => get<User | null>(KEYS.AUTH, null),
  setUser: (user: User | null) => set(KEYS.AUTH, user),
  login: (username: string, password: string): User | null => {
    const user = Users.getByUsername(username);
    if (user && user.password === password && user.active) {
      Auth.setUser(user);
      return user;
    }
    return null;
  },
  logout: () => localStorage.removeItem(KEYS.AUTH),
};

// ─── Ingredients ──────────────────────────────────────────────────────────────
export const Ingredients = {
  getAll: () => get<Ingredient[]>(KEYS.INGREDIENTS, []),
  getById: (id: string) => get<Ingredient[]>(KEYS.INGREDIENTS, []).find(i => i.id === id),
  save: (items: Ingredient[]) => set(KEYS.INGREDIENTS, items),
  upsert: (item: Ingredient) => {
    const all = get<Ingredient[]>(KEYS.INGREDIENTS, []);
    const idx = all.findIndex(i => i.id === item.id);
    if (idx >= 0) all[idx] = item; else all.push(item);
    set(KEYS.INGREDIENTS, all);
  },
  updateQuantity: (id: string, delta: number) => {
    const all = get<Ingredient[]>(KEYS.INGREDIENTS, []);
    const idx = all.findIndex(i => i.id === id);
    if (idx >= 0) {
      all[idx].currentQuantity = Math.max(0, all[idx].currentQuantity + delta);
      all[idx].lastUpdated = new Date().toISOString();
      set(KEYS.INGREDIENTS, all);
    }
  },
  delete: (id: string) => set(KEYS.INGREDIENTS, get<Ingredient[]>(KEYS.INGREDIENTS, []).filter(i => i.id !== id)),
};

// ─── Recipes ──────────────────────────────────────────────────────────────────
export const Recipes = {
  getAll: () => get<Recipe[]>(KEYS.RECIPES, []),
  getById: (id: string) => get<Recipe[]>(KEYS.RECIPES, []).find(r => r.id === id),
  upsert: (recipe: Recipe) => {
    const all = get<Recipe[]>(KEYS.RECIPES, []);
    const idx = all.findIndex(r => r.id === recipe.id);
    if (idx >= 0) all[idx] = recipe; else all.push(recipe);
    set(KEYS.RECIPES, all);
  },
  delete: (id: string) => set(KEYS.RECIPES, get<Recipe[]>(KEYS.RECIPES, []).filter(r => r.id !== id)),
};

// ─── Ingredient Batches (FIFO) ────────────────────────────────────────────────
export const Batches = {
  getAll: (): IngredientBatch[] => get<IngredientBatch[]>(KEYS.BATCHES, []),
  getByIngredient: (ingredientId: string): IngredientBatch[] =>
    get<IngredientBatch[]>(KEYS.BATCHES, []).filter(b => b.ingredientId === ingredientId),
  getActive: (): IngredientBatch[] => {
    const now = new Date().toISOString().split("T")[0];
    return get<IngredientBatch[]>(KEYS.BATCHES, []).filter(b => b.quantity > 0 && b.expiryDate >= now);
  },
  getExpiringSoon: (): IngredientBatch[] => {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];
    return get<IngredientBatch[]>(KEYS.BATCHES, []).filter(
      b => b.quantity > 0 && b.expiryDate >= today && b.expiryDate <= week
    );
  },
  getExpired: (): IngredientBatch[] => {
    const today = new Date().toISOString().split("T")[0];
    return get<IngredientBatch[]>(KEYS.BATCHES, []).filter(b => b.expiryDate < today && b.quantity > 0);
  },
  add: (batch: IngredientBatch) => {
    const all = get<IngredientBatch[]>(KEYS.BATCHES, []);
    all.unshift(batch);
    set(KEYS.BATCHES, all);
  },
  updateFlags: () => {
    const today = new Date().toISOString().split("T")[0];
    const week = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const all = get<IngredientBatch[]>(KEYS.BATCHES, []).map(b => ({
      ...b,
      isExpired: b.expiryDate < today,
      isExpiringSoon: b.expiryDate >= today && b.expiryDate <= week,
    }));
    set(KEYS.BATCHES, all);
  },
  transferToLocation: (ingredientId: string, qty: number, from: "main" | "kitchen" | "bar", to: "main" | "kitchen" | "bar", unitCost: number, ingredientName: string, unit: string) => {
    // FIFO deduct from source
    deductBatchFIFO(ingredientId, qty, from);
    // Add a new batch record at destination with same details (oldest batch ref)
    const all = get<IngredientBatch[]>(KEYS.BATCHES, []);
    const sourceBatches = all
      .filter(b => b.ingredientId === ingredientId && b.location === from)
      .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));
    const ref = sourceBatches[0];
    const newBatch: IngredientBatch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ingredientId,
      ingredientName,
      unit,
      batchNumber: ref ? `${ref.batchNumber}-T` : `TRF-${Date.now()}`,
      supplier: ref?.supplier ?? "Internal Transfer",
      quantity: qty,
      originalQuantity: qty,
      costPerUnit: unitCost,
      receivedDate: ref?.receivedDate ?? new Date().toISOString().split("T")[0],
      expiryDate: ref?.expiryDate ?? "2099-12-31",
      receivedBy: "Transfer",
      grnReference: ref?.grnReference ?? "",
      isExpired: false,
      isExpiringSoon: false,
      location: to,
    };
    all.push(newBatch);
    set(KEYS.BATCHES, all);
  },
};

// ─── Kitchen Stock ────────────────────────────────────────────────────────────
export const KitchenStock = {
  getAll: (): KitchenStockItem[] => get<KitchenStockItem[]>(KEYS.KITCHEN_STOCK, []),
  getById: (ingredientId: string): KitchenStockItem | undefined =>
    get<KitchenStockItem[]>(KEYS.KITCHEN_STOCK, []).find(k => k.ingredientId === ingredientId),
  save: (items: KitchenStockItem[]) => set(KEYS.KITCHEN_STOCK, items),
  addQty: (ingredientId: string, qty: number, ingredientName: string, unit: string, costPerUnit: number) => {
    const all = get<KitchenStockItem[]>(KEYS.KITCHEN_STOCK, []);
    const idx = all.findIndex(k => k.ingredientId === ingredientId);
    if (idx >= 0) {
      all[idx].currentQuantity = Math.max(0, all[idx].currentQuantity + qty);
      all[idx].lastUpdated = new Date().toISOString();
    } else {
      all.push({ ingredientId, ingredientName, unit, costPerUnit, currentQuantity: Math.max(0, qty), lastUpdated: new Date().toISOString() });
    }
    set(KEYS.KITCHEN_STOCK, all);
  },
  deductQty: (ingredientId: string, qty: number) => {
    const all = get<KitchenStockItem[]>(KEYS.KITCHEN_STOCK, []);
    const idx = all.findIndex(k => k.ingredientId === ingredientId);
    if (idx >= 0) {
      all[idx].currentQuantity = Math.max(0, all[idx].currentQuantity - qty);
      all[idx].lastUpdated = new Date().toISOString();
      set(KEYS.KITCHEN_STOCK, all);
      deductBatchFIFO(ingredientId, qty, "kitchen");
    }
  },
  setQty: (ingredientId: string, qty: number) => {
    const all = get<KitchenStockItem[]>(KEYS.KITCHEN_STOCK, []);
    const idx = all.findIndex(k => k.ingredientId === ingredientId);
    if (idx >= 0) {
      all[idx].currentQuantity = Math.max(0, qty);
      all[idx].lastUpdated = new Date().toISOString();
      set(KEYS.KITCHEN_STOCK, all);
    }
  },
};

// ─── Bar Stock ────────────────────────────────────────────────────────────────
export const BarStock = {
  getAll: (): BarStockItem[] => get<BarStockItem[]>(KEYS.BAR_STOCK, []),
  getById: (ingredientId: string): BarStockItem | undefined =>
    get<BarStockItem[]>(KEYS.BAR_STOCK, []).find(k => k.ingredientId === ingredientId),
  save: (items: BarStockItem[]) => set(KEYS.BAR_STOCK, items),
  addQty: (ingredientId: string, qty: number, ingredientName: string, unit: string, costPerUnit: number) => {
    const all = get<BarStockItem[]>(KEYS.BAR_STOCK, []);
    const idx = all.findIndex(k => k.ingredientId === ingredientId);
    if (idx >= 0) {
      all[idx].currentQuantity = Math.max(0, all[idx].currentQuantity + qty);
      all[idx].lastUpdated = new Date().toISOString();
    } else {
      all.push({ ingredientId, ingredientName, unit, costPerUnit, currentQuantity: Math.max(0, qty), lastUpdated: new Date().toISOString() });
    }
    set(KEYS.BAR_STOCK, all);
  },
  deductQty: (ingredientId: string, qty: number) => {
    const all = get<BarStockItem[]>(KEYS.BAR_STOCK, []);
    const idx = all.findIndex(k => k.ingredientId === ingredientId);
    if (idx >= 0) {
      all[idx].currentQuantity = Math.max(0, all[idx].currentQuantity - qty);
      all[idx].lastUpdated = new Date().toISOString();
      set(KEYS.BAR_STOCK, all);
      deductBatchFIFO(ingredientId, qty, "bar");
    }
  },
  setQty: (ingredientId: string, qty: number) => {
    const all = get<BarStockItem[]>(KEYS.BAR_STOCK, []);
    const idx = all.findIndex(k => k.ingredientId === ingredientId);
    if (idx >= 0) {
      all[idx].currentQuantity = Math.max(0, qty);
      all[idx].lastUpdated = new Date().toISOString();
      set(KEYS.BAR_STOCK, all);
    }
  },
};

// ─── Stock Movements ──────────────────────────────────────────────────────────
export const StockMovements = {
  getAll: () => get<StockMovement[]>(KEYS.STOCK_MOVEMENTS, []),
  add: (movement: StockMovement) => {
    const all = get<StockMovement[]>(KEYS.STOCK_MOVEMENTS, []);
    all.unshift(movement);
    set(KEYS.STOCK_MOVEMENTS, all);
    // Update main store ingredient quantity
    if (movement.type === "GRN" || movement.type === "RETURN") {
      Ingredients.updateQuantity(movement.ingredientId, movement.quantity);
    } else if (movement.type === "ISSUE" || movement.type === "ADJUSTMENT") {
      Ingredients.updateQuantity(movement.ingredientId, -movement.quantity);
      const dest = (movement.toLocation || "").toLowerCase();
      const ing = Ingredients.getById(movement.ingredientId);
      if (dest === "kitchen") {
        KitchenStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, ing?.costPerUnit ?? movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "kitchen", ing?.costPerUnit ?? movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      } else if (dest === "bar") {
        BarStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, ing?.costPerUnit ?? movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "bar", ing?.costPerUnit ?? movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      } else if (dest === "restaurant") {
        KitchenStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, ing?.costPerUnit ?? movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "kitchen", ing?.costPerUnit ?? movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      }
    } else if (movement.type === "TRANSFER") {
      Ingredients.updateQuantity(movement.ingredientId, -movement.quantity);
      const dest = (movement.toLocation || "").toLowerCase();
      const ing = Ingredients.getById(movement.ingredientId);
      if (dest === "kitchen" || dest === "restaurant") {
        KitchenStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, ing?.costPerUnit ?? movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "kitchen", ing?.costPerUnit ?? movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      } else if (dest === "bar") {
        BarStock.addQty(movement.ingredientId, movement.quantity, movement.ingredientName, movement.ingredientUnit, ing?.costPerUnit ?? movement.unitCost);
        Batches.transferToLocation(movement.ingredientId, movement.quantity, "main", "bar", ing?.costPerUnit ?? movement.unitCost, movement.ingredientName, movement.ingredientUnit);
      }
    }
  },
  flag: (id: string, reason: string) => {
    const all = get<StockMovement[]>(KEYS.STOCK_MOVEMENTS, []);
    const idx = all.findIndex(m => m.id === id);
    if (idx >= 0) { all[idx].isFlagged = true; all[idx].flagReason = reason; set(KEYS.STOCK_MOVEMENTS, all); }
  },
  getByIngredient: (ingredientId: string) => get<StockMovement[]>(KEYS.STOCK_MOVEMENTS, []).filter(m => m.ingredientId === ingredientId),
  getByType: (type: string) => get<StockMovement[]>(KEYS.STOCK_MOVEMENTS, []).filter(m => m.type === type),
  getFlagged: () => get<StockMovement[]>(KEYS.STOCK_MOVEMENTS, []).filter(m => m.isFlagged),
};

// ─── Store Requests ────────────────────────────────────────────────────────────
export const StoreRequests = {
  getAll: (): StoreRequest[] => get<StoreRequest[]>(KEYS.STORE_REQUESTS, []),
  getById: (id: string): StoreRequest | undefined =>
    get<StoreRequest[]>(KEYS.STORE_REQUESTS, []).find(r => r.id === id),
  getByStatus: (status: string): StoreRequest[] =>
    get<StoreRequest[]>(KEYS.STORE_REQUESTS, []).filter(r => r.status === status),
  getPendingForManager: (): StoreRequest[] =>
    get<StoreRequest[]>(KEYS.STORE_REQUESTS, []).filter(r => r.status === "pending"),
  getPendingForFinance: (): StoreRequest[] =>
    get<StoreRequest[]>(KEYS.STORE_REQUESTS, []).filter(r => r.status === "manager_approved"),
  getPendingForStorekeeper: (): StoreRequest[] =>
    get<StoreRequest[]>(KEYS.STORE_REQUESTS, []).filter(r => r.status === "finance_approved"),
  save: (req: StoreRequest) => {
    const all = get<StoreRequest[]>(KEYS.STORE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === req.id);
    if (idx >= 0) all[idx] = req; else all.unshift(req);
    set(KEYS.STORE_REQUESTS, all);
  },
  // Manager approves — can adjust or zero individual items
  managerApprove: (id: string, reviewedBy: string, adjustments: Record<string, number | "zero">, notes: string) => {
    const all = get<StoreRequest[]>(KEYS.STORE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    const req = { ...all[idx] };
    req.items = req.items.map(item => {
      const adj = adjustments[item.ingredientId];
      if (adj === "zero") return { ...item, zeroed: true, managerAdjustedQty: 0, approvedQty: 0 };
      const newQty = adj !== undefined ? adj : item.requestedQty;
      return { ...item, managerAdjustedQty: newQty, approvedQty: newQty, zeroed: false };
    });
    req.status = "manager_approved";
    req.managerNotes = notes;
    req.managerReviewedBy = reviewedBy;
    req.managerReviewedAt = new Date().toISOString();
    req.totalApprovedCost = req.items.reduce((s, i) => s + i.approvedQty * i.unitCost, 0);
    all[idx] = req;
    set(KEYS.STORE_REQUESTS, all);
  },
  managerReject: (id: string, reviewedBy: string, notes: string) => {
    const all = get<StoreRequest[]>(KEYS.STORE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], status: "manager_rejected", managerNotes: notes, managerReviewedBy: reviewedBy, managerReviewedAt: new Date().toISOString() };
    set(KEYS.STORE_REQUESTS, all);
  },
  // Finance approves — can further adjust or zero items
  financeApprove: (id: string, reviewedBy: string, adjustments: Record<string, number | "zero">, notes: string) => {
    const all = get<StoreRequest[]>(KEYS.STORE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    const req = { ...all[idx] };
    req.items = req.items.map(item => {
      if (item.zeroed) return item;
      const adj = adjustments[item.ingredientId];
      if (adj === "zero") return { ...item, zeroed: true, financeAdjustedQty: 0, approvedQty: 0 };
      const newQty = adj !== undefined ? Math.min(adj, item.approvedQty) : item.approvedQty;
      return { ...item, financeAdjustedQty: newQty, approvedQty: newQty };
    });
    req.status = "finance_approved";
    req.financeNotes = notes;
    req.financeReviewedBy = reviewedBy;
    req.financeReviewedAt = new Date().toISOString();
    req.totalApprovedCost = req.items.reduce((s, i) => s + i.approvedQty * i.unitCost, 0);
    all[idx] = req;
    set(KEYS.STORE_REQUESTS, all);
  },
  financeReject: (id: string, reviewedBy: string, notes: string) => {
    const all = get<StoreRequest[]>(KEYS.STORE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    all[idx] = { ...all[idx], status: "finance_rejected", financeNotes: notes, financeReviewedBy: reviewedBy, financeReviewedAt: new Date().toISOString() };
    set(KEYS.STORE_REQUESTS, all);
  },
  // Storekeeper fulfills — deducts from main store and sends to Kitchen/Bar
  fulfill: (id: string, fulfilledBy: string, fulfilledQtys: Record<string, number>) => {
    const all = get<StoreRequest[]>(KEYS.STORE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === id);
    if (idx < 0) return;
    const req = { ...all[idx] };
    let allFulfilled = true;
    req.items = req.items.map(item => {
      if (item.zeroed) return { ...item, fulfilledQty: 0 };
      const qty = fulfilledQtys[item.ingredientId] ?? item.approvedQty;
      if (qty < item.approvedQty) allFulfilled = false;
      return { ...item, fulfilledQty: qty };
    });
    // Deduct from main store and add to kitchen/bar
    const dest = req.destination.toLowerCase() as "kitchen" | "bar";
    req.items.forEach(item => {
      if (item.fulfilledQty <= 0) return;
      const ing = Ingredients.getById(item.ingredientId);
      Ingredients.updateQuantity(item.ingredientId, -item.fulfilledQty);
      if (dest === "kitchen") {
        KitchenStock.addQty(item.ingredientId, item.fulfilledQty, item.ingredientName, item.unit, item.unitCost);
      } else {
        BarStock.addQty(item.ingredientId, item.fulfilledQty, item.ingredientName, item.unit, item.unitCost);
      }
      Batches.transferToLocation(item.ingredientId, item.fulfilledQty, "main", dest, item.unitCost, item.ingredientName, item.unit);
    });
    req.status = allFulfilled ? "fulfilled" : "partially_fulfilled";
    req.fulfilledBy = fulfilledBy;
    req.fulfilledAt = new Date().toISOString();
    all[idx] = req;
    set(KEYS.STORE_REQUESTS, all);
  },
};

// ─── Role Permissions ─────────────────────────────────────────────────────────
export type RolePermissionMap = Record<string, string[]>;

const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  "dashboard":           ["admin", "manager", "storekeeper", "kitchen", "cashier", "finance"],
  "recipes_view":        ["admin", "manager", "kitchen"],
  "recipes_edit":        ["admin", "manager"],
  "inventory_view":      ["admin", "manager", "storekeeper"],
  "inventory_edit":      ["admin", "manager", "storekeeper"],
  "grn":                 ["admin", "manager", "storekeeper"],
  "issue_stock":         ["admin", "manager", "storekeeper"],
  "flag_movements":      ["admin", "manager"],
  "consumption_record":  ["admin", "manager", "kitchen", "storekeeper"],
  "consumption_approve": ["admin", "manager"],
  "sales_record":        ["admin", "manager", "cashier"],
  "reports_view":        ["admin", "manager"],
  "variance_reports":    ["admin", "manager"],
  "export_data":         ["admin"],
  "manage_users":        ["admin"],
  "system_settings":     ["admin"],
  "activity_log":        ["admin", "manager"],
  "approve_adjustments": ["admin", "manager"],
  "store_request":       ["kitchen", "admin", "manager"],
  "manager_review":      ["admin", "manager"],
  "finance_review":      ["admin", "finance"],
  "fulfill_request":     ["admin", "storekeeper"],
};

export const RolePermissions = {
  get: (): RolePermissionMap => get<RolePermissionMap>("fnb_role_permissions", DEFAULT_ROLE_PERMISSIONS),
  set: (p: RolePermissionMap) => set("fnb_role_permissions", p),
  reset: () => set("fnb_role_permissions", DEFAULT_ROLE_PERMISSIONS),
  hasAccess: (moduleKey: string, role: string): boolean => {
    const perms = get<RolePermissionMap>("fnb_role_permissions", DEFAULT_ROLE_PERMISSIONS);
    return (perms[moduleKey] || []).includes(role);
  },
};

// ─── Sales (deducts from KitchenStock or BarStock FIFO on add, based on recipe category) ──────────────────────────────────────────────────────────────────────
// Bar-linked ingredient IDs — beverages/alcohol go to bar stock
const BAR_CATEGORIES = ["Beverage", "beverage", "Alcohol", "alcohol", "Bar", "bar"];

export const Sales = {
  getAll: () => get<Sale[]>(KEYS.SALES, []),
  getByDate: (date: string) => get<Sale[]>(KEYS.SALES, []).filter(s => s.date === date),
  add: (sale: Sale) => {
    const all = get<Sale[]>(KEYS.SALES, []);
    all.unshift(sale);
    set(KEYS.SALES, all);
    const recipes = get<Recipe[]>(KEYS.RECIPES, []);
    sale.items.forEach(item => {
      const recipe = recipes.find(r => r.id === item.recipeId);
      if (recipe) {
        // Determine source store: Bar recipes deduct from BarStock, others from KitchenStock
        const isBarItem = BAR_CATEGORIES.includes(recipe.category) || BAR_CATEGORIES.includes(recipe.subCategory ?? "");
        recipe.ingredients.forEach(ing => {
          const qty = ing.quantity * item.quantity;
          if (isBarItem) {
            // Check if bar stock has this item; if not, fall back to kitchen stock
            const barItem = BarStock.getById(ing.ingredientId);
            if (barItem && barItem.currentQuantity > 0) {
              BarStock.deductQty(ing.ingredientId, qty);
            } else {
              KitchenStock.deductQty(ing.ingredientId, qty);
            }
          } else {
            KitchenStock.deductQty(ing.ingredientId, qty);
          }
        });
      }
    });
  },
  getDateRange: (from: string, to: string) => get<Sale[]>(KEYS.SALES, []).filter(s => s.date >= from && s.date <= to),
  clearAll: () => set(KEYS.SALES, []),
};

// ─── GRNs ─────────────────────────────────────────────────────────────────────
export const GRNs = {
  getAll: () => get<GRN[]>(KEYS.GRNS, []),
  add: (grn: GRN) => {
    const all = get<GRN[]>(KEYS.GRNS, []);
    all.unshift(grn);
    set(KEYS.GRNS, all);
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const Settings = {
  get: () => get<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS),
  set: (s: AppSettings) => set(KEYS.SETTINGS, s),
};

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const ActivityLogStore = {
  getAll: () => get<ActivityLog[]>(KEYS.ACTIVITY_LOG, []),
  add: (log: ActivityLog) => {
    const all = get<ActivityLog[]>(KEYS.ACTIVITY_LOG, []);
    all.unshift(log);
    if (all.length > 500) all.splice(500);
    set(KEYS.ACTIVITY_LOG, all);
  },
  clearAll: () => set(KEYS.ACTIVITY_LOG, []),
  getByUser: (userId: string) => get<ActivityLog[]>(KEYS.ACTIVITY_LOG, []).filter(l => l.userId === userId),
};

// ─── Daily Inventory ──────────────────────────────────────────────────────────
export const DailyInventory = {
  getAll: (): DailyInventorySheet[] => get<DailyInventorySheet[]>(KEYS.DAILY_INVENTORY, []),
  getByDate: (date: string): DailyInventorySheet | undefined =>
    get<DailyInventorySheet[]>(KEYS.DAILY_INVENTORY, []).find(s => s.date === date),
  save: (sheet: DailyInventorySheet) => {
    const all = get<DailyInventorySheet[]>(KEYS.DAILY_INVENTORY, []);
    const idx = all.findIndex(s => s.id === sheet.id);
    if (idx >= 0) all[idx] = sheet; else all.unshift(sheet);
    set(KEYS.DAILY_INVENTORY, all);
  },
  getRecent: (n = 7): DailyInventorySheet[] =>
    get<DailyInventorySheet[]>(KEYS.DAILY_INVENTORY, []).slice(0, n),
};

// ─── Consumption Records (deducts from KitchenStock FIFO on add) ──────────────
export const ConsumptionStore = {
  getAll: () => get<ConsumptionRecord[]>(KEYS.CONSUMPTION, []),
  getByDate: (date: string) => get<ConsumptionRecord[]>(KEYS.CONSUMPTION, []).filter(r => r.date === date),
  add: (record: ConsumptionRecord) => {
    const all = get<ConsumptionRecord[]>(KEYS.CONSUMPTION, []);
    all.unshift(record);
    set(KEYS.CONSUMPTION, all);
    KitchenStock.deductQty(record.ingredientId, record.quantity);
  },
  approve: (id: string, approverName: string) => {
    const all = get<ConsumptionRecord[]>(KEYS.CONSUMPTION, []);
    const idx = all.findIndex(r => r.id === id);
    if (idx >= 0) { all[idx].approved = true; all[idx].approvedBy = approverName; set(KEYS.CONSUMPTION, all); }
  },
  delete: (id: string) => set(KEYS.CONSUMPTION, get<ConsumptionRecord[]>(KEYS.CONSUMPTION, []).filter(r => r.id !== id)),
  getDateRange: (from: string, to: string) => get<ConsumptionRecord[]>(KEYS.CONSUMPTION, []).filter(r => r.date >= from && r.date <= to),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const Alerts = {
  getAll: () => get<Alert[]>(KEYS.ALERTS, []),
  getUnread: () => get<Alert[]>(KEYS.ALERTS, []).filter(a => !a.isRead),
  markRead: (id: string) => {
    const all = get<Alert[]>(KEYS.ALERTS, []);
    const idx = all.findIndex(a => a.id === id);
    if (idx >= 0) { all[idx].isRead = true; set(KEYS.ALERTS, all); }
  },
  markAllRead: () => {
    const all = get<Alert[]>(KEYS.ALERTS, []).map(a => ({ ...a, isRead: true }));
    set(KEYS.ALERTS, all);
  },
  add: (alert: Alert) => {
    const all = get<Alert[]>(KEYS.ALERTS, []);
    all.unshift(alert);
    set(KEYS.ALERTS, all);
  },
};

// ─── Physical Inventory Count (Manual daily count by F&B Manager) ────────────
export interface PhysicalCountEntry {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  theoreticalQty: number;   // system quantity
  physicalQty: number;      // manually counted
  variance: number;         // physical - theoretical
  varianceCost: number;     // Math.abs(variance) * costPerUnit
  costPerUnit: number;
  notes: string;
}

export interface PhysicalInventoryCount {
  id: string;
  date: string;             // ISO date
  countedBy: string;
  countedByName: string;
  entries: PhysicalCountEntry[];
  totalVarianceCost: number;
  shortageCount: number;
  overageCount: number;
  status: "draft" | "submitted" | "approved";
  submittedAt?: string;
  approvedBy?: string;
  createdAt: string;
}

export const PhysicalInventory = {
  getAll: (): PhysicalInventoryCount[] => get<PhysicalInventoryCount[]>("fnb_physical_inventory", []),
  getByDate: (date: string): PhysicalInventoryCount | undefined =>
    get<PhysicalInventoryCount[]>("fnb_physical_inventory", []).find(c => c.date === date),
  save: (count: PhysicalInventoryCount) => {
    const all = get<PhysicalInventoryCount[]>("fnb_physical_inventory", []);
    const idx = all.findIndex(c => c.id === count.id);
    if (idx >= 0) all[idx] = count; else all.unshift(count);
    set("fnb_physical_inventory", all);
  },
  getRecent: (n = 10): PhysicalInventoryCount[] =>
    get<PhysicalInventoryCount[]>("fnb_physical_inventory", []).slice(0, n),
  delete: (id: string) => set("fnb_physical_inventory", get<PhysicalInventoryCount[]>("fnb_physical_inventory", []).filter(c => c.id !== id)),
};

// ─── Employees ─────────────────────────────────────────────────────────────────────────────
export const Employees = {
  getAll: (): Employee[] => get<Employee[]>(KEYS.EMPLOYEES, []),
  getById: (id: string) => get<Employee[]>(KEYS.EMPLOYEES, []).find(e => e.id === id),
  upsert: (emp: Employee) => {
    const all = get<Employee[]>(KEYS.EMPLOYEES, []);
    const idx = all.findIndex(e => e.id === emp.id);
    if (idx >= 0) all[idx] = emp; else all.push(emp);
    set(KEYS.EMPLOYEES, all);
  },
  delete: (id: string) => set(KEYS.EMPLOYEES, get<Employee[]>(KEYS.EMPLOYEES, []).filter(e => e.id !== id)),
  save: (items: Employee[]) => set(KEYS.EMPLOYEES, items),
};

// ─── Payroll ─────────────────────────────────────────────────────────────────────────────
export const PayrollStore = {
  getAll: (): PayrollRecord[] => get<PayrollRecord[]>(KEYS.PAYROLL, []),
  getByMonth: (month: string): PayrollRecord[] => get<PayrollRecord[]>(KEYS.PAYROLL, []).filter(r => r.month === month),
  upsert: (record: PayrollRecord) => {
    const all = get<PayrollRecord[]>(KEYS.PAYROLL, []);
    const idx = all.findIndex(r => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.unshift(record);
    set(KEYS.PAYROLL, all);
  },
  saveAll: (records: PayrollRecord[]) => {
    const all = get<PayrollRecord[]>(KEYS.PAYROLL, []);
    records.forEach(record => {
      const idx = all.findIndex(r => r.id === record.id);
      if (idx >= 0) all[idx] = record; else all.unshift(record);
    });
    set(KEYS.PAYROLL, all);
  },
  delete: (id: string) => set(KEYS.PAYROLL, get<PayrollRecord[]>(KEYS.PAYROLL, []).filter(r => r.id !== id)),
};

// ─── Accounts Receivable ───────────────────────────────────────────────────────
export const ARStore = {
  getAll: (): AccountReceivable[] => get<AccountReceivable[]>(KEYS.ACCOUNTS_RECEIVABLE, []),
  getById: (id: string) => get<AccountReceivable[]>(KEYS.ACCOUNTS_RECEIVABLE, []).find(r => r.id === id),
  upsert: (record: AccountReceivable) => {
    const all = get<AccountReceivable[]>(KEYS.ACCOUNTS_RECEIVABLE, []);
    const idx = all.findIndex(r => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.unshift(record);
    set(KEYS.ACCOUNTS_RECEIVABLE, all);
  },
  delete: (id: string) => set(KEYS.ACCOUNTS_RECEIVABLE, get<AccountReceivable[]>(KEYS.ACCOUNTS_RECEIVABLE, []).filter(r => r.id !== id)),
  // Calculate aging bucket
  calcAging: (dueDate: string): AccountReceivable["agingBucket"] => {
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    if (days <= 30) return "0-30";
    if (days <= 60) return "31-60";
    return "61+";
  },
  recalcStatus: (record: AccountReceivable): AccountReceivable => {
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = record.dueDate < today && record.outstandingAmount > 0;
    let status: AccountReceivable["status"] = "outstanding";
    if (record.outstandingAmount <= 0) status = "paid";
    else if (record.paidAmount > 0) status = isOverdue ? "overdue" : "partially_paid";
    else if (isOverdue) status = "overdue";
    return { ...record, status, agingBucket: ARStore.calcAging(record.dueDate) };
  },
};

// ─── Accounts Payable ───────────────────────────────────────────────────────────
export const APStore = {
  getAll: (): AccountPayable[] => get<AccountPayable[]>(KEYS.ACCOUNTS_PAYABLE, []),
  getById: (id: string) => get<AccountPayable[]>(KEYS.ACCOUNTS_PAYABLE, []).find(r => r.id === id),
  upsert: (record: AccountPayable) => {
    const all = get<AccountPayable[]>(KEYS.ACCOUNTS_PAYABLE, []);
    const idx = all.findIndex(r => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.unshift(record);
    set(KEYS.ACCOUNTS_PAYABLE, all);
  },
  delete: (id: string) => set(KEYS.ACCOUNTS_PAYABLE, get<AccountPayable[]>(KEYS.ACCOUNTS_PAYABLE, []).filter(r => r.id !== id)),
  calcAging: (dueDate: string): AccountPayable["agingBucket"] => {
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    if (days <= 30) return "0-30";
    if (days <= 60) return "31-60";
    return "61+";
  },
};

// ─── Purchase Requests (PR) ──────────────────────────────────────────────────────
export const PRStore = {
  getAll: (): PurchaseRequest[] => get<PurchaseRequest[]>(KEYS.PURCHASE_REQUESTS, []),
  getById: (id: string) => get<PurchaseRequest[]>(KEYS.PURCHASE_REQUESTS, []).find(r => r.id === id),
  upsert: (pr: PurchaseRequest) => {
    const all = get<PurchaseRequest[]>(KEYS.PURCHASE_REQUESTS, []);
    const idx = all.findIndex(r => r.id === pr.id);
    if (idx >= 0) all[idx] = pr; else all.unshift(pr);
    set(KEYS.PURCHASE_REQUESTS, all);
  },
  getPendingForStorekeeper: (): PurchaseRequest[] =>
    get<PurchaseRequest[]>(KEYS.PURCHASE_REQUESTS, []).filter(r => r.status === "pending" && ["kitchen","bar"].includes(r.requestedByRole)),
  getPendingForFinance: (): PurchaseRequest[] =>
    get<PurchaseRequest[]>(KEYS.PURCHASE_REQUESTS, []).filter(r => r.status === "storekeeper_review" || (r.status === "pending" && r.requestedByRole === "storekeeper")),
  getPendingForOwner: (): PurchaseRequest[] =>
    get<PurchaseRequest[]>(KEYS.PURCHASE_REQUESTS, []).filter(r => r.status === "finance_approved"),
  getPendingForPurchaser: (): PurchaseRequest[] =>
    get<PurchaseRequest[]>(KEYS.PURCHASE_REQUESTS, []).filter(r => r.status === "sent_to_purchaser"),
};

// ─── Notifications ───────────────────────────────────────────────────────────────────
export const NotificationsStore = {
  getAll: (): AppNotification[] => get<AppNotification[]>(KEYS.NOTIFICATIONS, []),
  getForUser: (userId: string, role?: string): AppNotification[] =>
    get<AppNotification[]>(KEYS.NOTIFICATIONS, []).filter(n =>
      n.recipientUserId === userId || (role && n.recipientRole === role)
    ),
  getUnreadCount: (userId: string, role?: string): number =>
    NotificationsStore.getForUser(userId, role).filter(n => !n.isRead).length,
  add: (notif: AppNotification) => {
    const all = get<AppNotification[]>(KEYS.NOTIFICATIONS, []);
    all.unshift(notif);
    if (all.length > 200) all.splice(200);
    set(KEYS.NOTIFICATIONS, all);
  },
  markRead: (id: string) => {
    const all = get<AppNotification[]>(KEYS.NOTIFICATIONS, []);
    const idx = all.findIndex(n => n.id === id);
    if (idx >= 0) { all[idx].isRead = true; set(KEYS.NOTIFICATIONS, all); }
  },
  markAllRead: (userId: string, role?: string) => {
    const all = get<AppNotification[]>(KEYS.NOTIFICATIONS, []).map(n =>
      (n.recipientUserId === userId || (role && n.recipientRole === role)) ? { ...n, isRead: true } : n
    );
    set(KEYS.NOTIFICATIONS, all);
  },
};

// ─── Storage Init ─────────────────────────────────────────────────────────────
export function resetAdminAndSales(): void {
  const users = get<User[]>(KEYS.USERS, []);
  const adminIdx = users.findIndex(u => u.id === "u1");
  if (adminIdx >= 0) {
    users[adminIdx].name = "Sentayehu Berhanu";
    users[adminIdx].email = "Sentayehuberhanu12@gmail.com";
    set(KEYS.USERS, users);
    const authUser = get<User | null>(KEYS.AUTH, null);
    if (authUser?.id === "u1") {
      set(KEYS.AUTH, { ...authUser, name: "Sentayehu Berhanu", email: "Sentayehuberhanu12@gmail.com" });
    }
  }
  set(KEYS.SALES, []);
}

export function initializeStorage(): void {
  // Clear init flag to force re-check of new keys on first load after update
  const storedVersion = localStorage.getItem("fnb_version");
  const CURRENT_VERSION = "5"; // bumped to 5 to force full data reset — starts clean
  if (storedVersion !== CURRENT_VERSION) {
    // Full reset — clear all data except users and settings
    Object.values(KEYS).forEach(key => {
      if (key !== KEYS.USERS && key !== KEYS.SETTINGS && key !== KEYS.INITIALIZED) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem(KEYS.INITIALIZED); // force re-init
    localStorage.removeItem("fnb_physical_inventory");
    localStorage.removeItem("fnb_role_permissions");
    localStorage.setItem("fnb_version", CURRENT_VERSION);
  }
  if (localStorage.getItem(KEYS.INITIALIZED)) {
    resetAdminAndSales();
    if (!localStorage.getItem(KEYS.KITCHEN_STOCK)) set(KEYS.KITCHEN_STOCK, []);
    if (!localStorage.getItem(KEYS.BAR_STOCK)) set(KEYS.BAR_STOCK, []);
    if (!localStorage.getItem(KEYS.DAILY_INVENTORY)) set(KEYS.DAILY_INVENTORY, []);
    if (!localStorage.getItem(KEYS.BATCHES)) set(KEYS.BATCHES, []);
    if (!localStorage.getItem(KEYS.STORE_REQUESTS)) set(KEYS.STORE_REQUESTS, []);
    if (!localStorage.getItem(KEYS.EMPLOYEES)) set(KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    if (!localStorage.getItem(KEYS.PAYROLL)) set(KEYS.PAYROLL, []);
    if (!localStorage.getItem(KEYS.ACCOUNTS_RECEIVABLE)) set(KEYS.ACCOUNTS_RECEIVABLE, MOCK_AR);
    if (!localStorage.getItem(KEYS.ACCOUNTS_PAYABLE)) set(KEYS.ACCOUNTS_PAYABLE, MOCK_AP);
    if (!localStorage.getItem(KEYS.PURCHASE_REQUESTS)) set(KEYS.PURCHASE_REQUESTS, []);
    if (!localStorage.getItem(KEYS.NOTIFICATIONS)) set(KEYS.NOTIFICATIONS, []);
    Batches.updateFlags();
    return;
  }
  set(KEYS.USERS, MOCK_USERS);
  set(KEYS.INGREDIENTS, MOCK_INGREDIENTS);
  set(KEYS.RECIPES, MOCK_RECIPES);
  set(KEYS.STOCK_MOVEMENTS, MOCK_STOCK_MOVEMENTS);
  set(KEYS.SALES, MOCK_SALES);
  set(KEYS.GRNS, MOCK_GRNS);
  set(KEYS.SETTINGS, DEFAULT_SETTINGS);
  set(KEYS.ALERTS, []);
  set(KEYS.ACTIVITY_LOG, MOCK_ACTIVITY_LOGS);
  set(KEYS.CONSUMPTION, MOCK_CONSUMPTION_RECORDS);
  set(KEYS.KITCHEN_STOCK, []);
  set(KEYS.BAR_STOCK, []);
  set(KEYS.DAILY_INVENTORY, []);
  set(KEYS.BATCHES, []);
  set(KEYS.STORE_REQUESTS, []);
  set(KEYS.EMPLOYEES, MOCK_EMPLOYEES);
  set(KEYS.PAYROLL, []);
  set(KEYS.ACCOUNTS_RECEIVABLE, MOCK_AR);
  set(KEYS.ACCOUNTS_PAYABLE, MOCK_AP);
  set(KEYS.PURCHASE_REQUESTS, []);
  set(KEYS.NOTIFICATIONS, []);
  localStorage.setItem(KEYS.INITIALIZED, "1");
}
