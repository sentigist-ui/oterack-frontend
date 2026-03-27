import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Package, ArrowLeftRight,
  ShoppingCart, BarChart3, Settings, LogOut, ChefHat,
  AlertTriangle, Shield, FlaskConical, UtensilsCrossed, ClipboardList,
  Wine, ShoppingBag, DollarSign, Users, CreditCard, Briefcase, Receipt,
  TrendingUp, Truck, Building2, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Ingredients } from "@/lib/storage";
import type { User } from "@/types";

interface SidebarProps {
  user: User;
  onLogout: () => void;
  unreadAlerts: number;
}

const allNavItems = [
  { to: "/dashboard",         icon: LayoutDashboard, label: "Dashboard",        modules: ["admin","manager","storekeeper","kitchen","cashier","finance","owner","purchaser","collector","hod","audit"] },
  { to: "/recipes",           icon: BookOpen,         label: "Recipes",          modules: ["admin","manager","kitchen","hod"] },
  { to: "/inventory",         icon: Package,          label: "Main Store",       modules: ["admin","manager","storekeeper"] },
  { to: "/kitchen-store",     icon: UtensilsCrossed,  label: "Kitchen Store",    modules: ["admin","manager","storekeeper","kitchen","hod"] },
  { to: "/bar-store",         icon: Wine,             label: "Bar Store",        modules: ["admin","manager","storekeeper","kitchen","hod"] },
  { to: "/store-requests",    icon: ShoppingBag,      label: "Store Requests",   modules: ["admin","manager","storekeeper","kitchen","finance","hod"] },
  { to: "/purchase-requests", icon: Receipt,          label: "Purchase Requests",modules: ["admin","manager","storekeeper","kitchen","finance","owner","purchaser","hod"] },
  { to: "/stock-movements",   icon: ArrowLeftRight,   label: "Stock Movements",  modules: ["admin","manager","storekeeper"] },
  { to: "/consumption",       icon: FlaskConical,     label: "Consumption",      modules: ["admin","manager","kitchen","storekeeper","hod"] },
  { to: "/daily-inventory",   icon: ClipboardList,    label: "Daily Inventory",  modules: ["admin","manager","kitchen","storekeeper","hod"] },
  { to: "/sales",             icon: ShoppingCart,     label: "Sales Entry",      modules: ["admin","manager","cashier"] },
  { to: "/batch-expiry",      icon: AlertTriangle,    label: "Batch Expiry",     modules: ["admin","manager","storekeeper"] },
  { to: "/payroll",           icon: Users,            label: "Payroll",          modules: ["admin","finance","owner"] },
  { to: "/accounts-receivable",icon: DollarSign,      label: "Accounts Receivable",modules: ["admin","finance","owner","collector","audit"] },
  { to: "/accounts-payable",  icon: CreditCard,       label: "Accounts Payable", modules: ["admin","finance","owner","audit"] },
  { to: "/profit-loss",       icon: TrendingUp,       label: "P&L Report",       modules: ["admin","manager","finance","owner","audit"] },
  { to: "/hod-pl",            icon: Building2,        label: "My Dept P&L",      modules: ["hod"] },
  { to: "/purchaser-dashboard",icon: Truck,            label: "My Orders",        modules: ["purchaser"] },
  { to: "/reports",           icon: BarChart3,        label: "Reports",          modules: ["admin","manager","finance","owner","audit"] },
  { to: "/system-docs",       icon: FileText,         label: "System Docs",       modules: ["admin","manager","finance","owner","storekeeper","kitchen","hod","purchaser","collector","cashier","audit"] },
  { to: "/settings",          icon: Settings,         label: "Settings",         modules: ["admin","manager","storekeeper","kitchen","cashier","finance","owner","purchaser","collector","hod","audit"] },
];

const roleColors: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400",
  manager: "bg-blue-500/20 text-blue-400",
  storekeeper: "bg-amber-500/20 text-amber-400",
  kitchen: "bg-green-500/20 text-green-400",
  cashier: "bg-purple-500/20 text-purple-400",
  finance: "bg-cyan-500/20 text-cyan-400",
  owner: "bg-yellow-500/20 text-yellow-400",
  purchaser: "bg-orange-500/20 text-orange-400",
  collector: "bg-pink-500/20 text-pink-400",
  hod: "bg-teal-500/20 text-teal-400",
  audit: "bg-slate-500/20 text-slate-400",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  manager: "F&B Manager",
  storekeeper: "Storekeeper",
  kitchen: "Kitchen Head",
  cashier: "Cashier",
  finance: "Finance Head",
  owner: "Owner / Director",
  purchaser: "Purchaser",
  collector: "AR Collector",
  hod: "Dept. Head (HOD)",
  audit: "Internal Auditor",
};

export default function Sidebar({ user, onLogout, unreadAlerts }: SidebarProps) {
  const navigate = useNavigate();
  const navItems = allNavItems.filter(item => item.modules.includes(user.role));

  // Low-stock count for badge display
  const lowStockCount = Ingredients.getAll().filter(i => i.currentQuantity <= i.minQuantity && i.minQuantity > 0).length;

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <aside className="flex flex-col w-60 min-h-screen border-r border-sidebar-border bg-sidebar shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20">
          <ChefHat className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-accent-foreground leading-tight">F&B Control</p>
          <p className="text-[10px] text-sidebar-foreground">Pro Management</p>
        </div>
      </div>

      {/* User Info */}
      <div className="mx-3 mt-4 rounded-lg bg-sidebar-accent p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">
            {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{user.name}</p>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", roleColors[user.role])}>
              {roleLabels[user.role]}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn("sidebar-link", isActive && "active")
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-[11px]">{label}</span>
            {to === "/dashboard" && unreadAlerts > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/20 text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {unreadAlerts}
              </span>
            )}
            {to === "/inventory" && lowStockCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {lowStockCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Security badge */}
      {(["admin","manager","finance","owner","audit"].includes(user.role)) && (
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
          <Shield className="w-3.5 h-3.5 text-green-400" />
          <span className="text-[10px] font-medium text-green-400">Variance Monitoring Active</span>
        </div>
      )}

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <button
          onClick={handleLogout}
          className="sidebar-link w-full hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
