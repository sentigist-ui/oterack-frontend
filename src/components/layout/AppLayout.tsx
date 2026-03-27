
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "@/hooks/useAuth";
import { useAlerts } from "@/hooks/useAlerts";
import { Settings } from "@/lib/storage";

const pageTitles = {
  "/dashboard":          { title: "Dashboard",               subtitle: "Overview of today's F&B operations" },
  "/recipes":            { title: "Recipe Management",         subtitle: "Standardized recipes with cost analysis" },
  "/inventory":          { title: "Main Store Inventory",      subtitle: "Real-time stock levels and management" },
  "/kitchen-store":      { title: "Kitchen Store",             subtitle: "Kitchen stock and daily physical count" },
  "/bar-store":          { title: "Bar Store",                 subtitle: "Bar stock and daily physical count" },
  "/store-requests":     { title: "Store Requests",            subtitle: "Kitchen/Bar → Manager → Finance → Storekeeper" },
  "/purchase-requests":  { title: "Purchase Requests",         subtitle: "PR workflow: Kitchen → Storekeeper → Finance → Owner → Purchaser" },
  "/stock-movements":    { title: "Stock Movements",           subtitle: "GRN, issues, transfers and adjustments" },
  "/consumption":        { title: "Consumption Records",       subtitle: "Manual consumption tracking and variance" },
  "/daily-inventory":    { title: "Daily Inventory",           subtitle: "Daily physical reconciliation" },
  "/batch-expiry":       { title: "Batch Expiry Report",       subtitle: "FIFO batch tracking and expiry monitoring" },
  "/sales":              { title: "Sales Entry",               subtitle: "Record and manage daily sales" },
  "/reports":            { title: "Reports & Analytics",       subtitle: "Operational insights and variance analysis" },
  "/profit-loss":        { title: "Profit & Loss Report",      subtitle: "Annual, quarterly, monthly and 6-month P&L" },
  "/hod-pl":             { title: "My Department P&L",         subtitle: "Department revenue, cost and labor — current month" },
  "/purchaser-dashboard":{ title: "Purchaser Dashboard",       subtitle: "Assigned purchase orders and GRN confirmation" },
  "/system-docs":          { title: "System Documentation",     subtitle: "Complete guide to all modules, roles, and workflows" },
  "/payroll":            { title: "Payroll Management",        subtitle: "Monthly payroll with Ethiopian tax and pension" },
  "/accounts-receivable":{ title: "Accounts Receivable",       subtitle: "Client invoices, aging and collection workflow" },
  "/accounts-payable":   { title: "Accounts Payable",          subtitle: "Supplier invoices and payment tracking" },
  "/settings":           { title: "System Settings",           subtitle: "Configure hotel and system preferences" },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { alerts, unreadCount, markRead, markAllRead } = useAlerts();
  const location = useLocation();
  const settings = Settings.get();

  useEffect(() => {
    // Close alert dropdown on route change
  }, [location.pathname]);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const pageInfo = pageTitles[location.pathname] || { title: "F&B Control", subtitle: "" };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} onLogout={logout} unreadAlerts={unreadCount} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          alerts={alerts}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          onMarkRead={markRead}
          hotelName={settings.hotelName}
        />
        <main className="flex-1 overflow-y-auto p-6 fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
