import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { initializeStorage } from "@/lib/storage";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Recipes from "./pages/Recipes";
import Inventory from "./pages/Inventory";
import StockMovement from "./pages/StockMovement";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

import Consumption from "./pages/Consumption";
import KitchenStore from "./pages/KitchenStore";
import BarStore from "./pages/BarStore";
import DailyInventory from "./pages/DailyInventory";
import StoreRequests from "./pages/StoreRequests";
import BatchExpiryReport from "./pages/BatchExpiryReport";

import Payroll from "./pages/Payroll";
import AccountsReceivable from "./pages/AccountsReceivable";
import AccountsPayable from "./pages/AccountsPayable";
import PurchaseRequestsPage from "./pages/PurchaseRequestsPage";
import ProfitLoss from "./pages/ProfitLoss";
import HodPL from "./pages/HodPL";
import PurchaserDashboard from "./pages/PurchaserDashboard";
import SystemDocs from "./pages/SystemDocs";

const queryClient = new QueryClient();

function AppInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeStorage();
  }, []);
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors position="top-right" />
      <BrowserRouter>
        <AppInit>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/stock-movements" element={<StockMovement />} />
            <Route path="/consumption" element={<Consumption />} />
            <Route path="/kitchen-store" element={<KitchenStore />} />
            <Route path="/bar-store" element={<BarStore />} />
            <Route path="/store-requests" element={<StoreRequests />} />
            <Route path="/daily-inventory" element={<DailyInventory />} />
            <Route path="/batch-expiry" element={<BatchExpiryReport />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/accounts-receivable" element={<AccountsReceivable />} />
            <Route path="/accounts-payable" element={<AccountsPayable />} />
            <Route path="/purchase-requests" element={<PurchaseRequestsPage />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
            <Route path="/hod-pl" element={<HodPL />} />
            <Route path="/purchaser-dashboard" element={<PurchaserDashboard />} />
            <Route path="/system-docs" element={<SystemDocs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppInit>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
