import { useState } from "react";
import { Download, ChefHat, Shield, Database, Workflow, Users, BarChart3, FileText, Package, BookOpen } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Settings } from "@/lib/storage";
import { exportSystemDocsPDF } from "@/lib/pdfExport";
import { toast } from "sonner";

type Section = "overview" | "modules" | "roles" | "workflows" | "data" | "financials" | "tech";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview",   label: "System Overview",    icon: ChefHat },
  { id: "modules",    label: "All Modules",         icon: Package },
  { id: "roles",      label: "User Roles",          icon: Users },
  { id: "workflows",  label: "Key Workflows",       icon: Workflow },
  { id: "data",       label: "Data Architecture",   icon: Database },
  { id: "financials", label: "Financial Modules",   icon: BarChart3 },
  { id: "tech",       label: "Technical Stack",     icon: Shield },
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-foreground mt-6 mb-3 pb-1 border-b border-border">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-primary mt-4 mb-2">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground leading-relaxed mb-2">{children}</p>;
}
function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    green: "bg-green-500/15 text-green-400 border-green-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
    purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    teal: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    pink: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    slate: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  };
  return (
    <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mr-1 mb-1", colors[color])}>
      {children}
    </span>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden mb-4">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-xs text-foreground">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Step({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <div className="flex gap-3 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">{n}</div>
      <div>
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

export default function SystemDocs() {
  const [active, setActive] = useState<Section>("overview");
  const settings = Settings.get();

  const handlePrint = () => window.print();
  
  const handleDownloadPDF = () => {
    exportSystemDocsPDF(settings.hotelName, "System");
    toast.success("System documentation PDF downloaded");
  };

  return (
    <AppLayout>
      <div className="flex gap-4">
        {/* Left Nav */}
        <aside className="w-44 shrink-0 sticky top-0 self-start">
          <div className="rounded-xl border border-border bg-card p-2 space-y-0.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left",
                  active === s.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}>
                <s.icon className="w-3.5 h-3.5 shrink-0" />
                {s.label}
              </button>
            ))}
            <div className="pt-2 border-t border-border space-y-0.5">
              <button onClick={handleDownloadPDF}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-primary hover:bg-primary/10 transition-colors font-medium">
                <Download className="w-3.5 h-3.5" />
                Download Full PDF
              </button>
              <button onClick={handlePrint}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Print Current View
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card p-6">
          {active === "overview" && (
            <div>
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
                <ChefHat className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <h1 className="text-base font-bold text-foreground">Grar F&B — Complete System Documentation</h1>
                  <p className="text-[10px] text-muted-foreground">{settings.hotelName} · Food & Beverage Management System · v5.0</p>
                </div>
              </div>

              <H2>What is Grar F&B?</H2>
              <P>Grar F&B is a comprehensive Food &amp; Beverage Management System designed for hotels and restaurants. It provides end-to-end control over inventory, recipes, sales, cost analysis, payroll, accounts, and procurement — all accessible through a browser with real-time Supabase database sync and offline localStorage fallback.</P>

              <H2>Core Capabilities</H2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { title: "Cost Control", desc: "Recipe costing, food cost %, variance alerts, target benchmarking" },
                  { title: "Inventory Tracking", desc: "3-store inventory (Main, Kitchen, Bar) with FIFO batch management" },
                  { title: "Recipe Standardization", desc: "Chef-managed recipe library with auto cost calculation (independent of store stock)" },
                  { title: "Theft Detection", desc: "Variance analysis comparing expected vs actual consumption per ingredient" },
                  { title: "Daily Operations", desc: "GRN, stock issues, transfers, consumption records, daily physical counts" },
                  { title: "Financial Reporting", desc: "P&L reports (monthly/quarterly/6-month/annual), payroll, AR/AP aging" },
                  { title: "Procurement Control", desc: "6-stage PR workflow — no GRN without approved PR" },
                  { title: "Role-Based Access", desc: "11 user roles with configurable permission matrix" },
                ].map(c => (
                  <div key={c.title} className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>

              <H2>How to Get Started</H2>
              <Step n={1} label="Log in with your account" desc="Use username + password credentials provided by the admin" />
              <Step n={2} label="Set up ingredients in Main Store" desc="Navigate to Main Store → Add ingredients with unit, cost, and minimum quantity" />
              <Step n={3} label="Create recipes (Chef only)" desc="Navigate to Recipes → Add recipes with ingredient quantities. Recipes can reference any ingredient name regardless of stock availability." />
              <Step n={4} label="Record a GRN (storekeeper)" desc="Navigate to Stock Movements → New GRN → Enter supplier, invoice, items received" />
              <Step n={5} label="Issue stock to Kitchen/Bar" desc="Use Stock Movements → ISSUE type and set destination to Kitchen or Bar. Stock transfers automatically." />
              <Step n={6} label="Record daily sales (cashier)" desc="Navigate to Sales Entry → Select recipes → Enter quantities sold. Kitchen/Bar stock deducts automatically." />
              <Step n={7} label="Run daily variance report (manager)" desc="Navigate to Reports → View ingredient variance per day/week to detect shortages or theft." />
            </div>
          )}

          {active === "modules" && (
            <div>
              <H2>All System Modules</H2>

              <H3>📦 Main Store Inventory</H3>
              <P>Central ingredient registry. Add ingredients with unit, cost per unit, minimum quantity threshold, and category. Tracks live stock quantity. Low-stock alerts badge appears in sidebar when any ingredient falls below minimum.</P>

              <H3>🍳 Kitchen Store</H3>
              <P>Separate inventory for kitchen items transferred from Main Store. Items arrive here through stock issues/transfers. Daily physical count compares theoretical (system) vs actual (manual count) for shortage/overage detection. FIFO batch tracking enabled.</P>

              <H3>🍷 Bar Store</H3>
              <P>Separate inventory for bar/beverage items. Identical structure to Kitchen Store. When bar-categorized recipes are sold, the system deducts from Bar Stock first with fallback to Kitchen Stock.</P>

              <H3>📋 Store Requests (Kitchen/Bar → Main Store)</H3>
              <P>4-stage internal requisition workflow: Kitchen/Bar Head submits → F&B Manager reviews (can adjust/zero items) → Finance Head approves (can further adjust) → Storekeeper fulfills (deducts main, adds to kitchen/bar, FIFO batch transfer).</P>

              <H3>🛒 Purchase Requests (External Procurement)</H3>
              <P>7-stage procurement pipeline ensuring no GRN without an approved PR: Submit → Storekeeper Review → Finance Approval → Owner Decision → Purchaser Procures (with real qty + price) → Quality Check → Auto-Add to Main Store.</P>

              <H3>📊 Stock Movements</H3>
              <P>Audit trail of all inventory movements: GRN (goods received), ISSUE (to kitchen/bar), TRANSFER (store-to-store), ADJUSTMENT (waste/damage), RETURN. Each movement synced to Supabase. Suspicious movements can be flagged.</P>

              <H3>🧾 Sales Entry</H3>
              <P>Record daily sales by recipe and quantity. Revenue, COGS, and gross profit auto-calculated. Sales automatically deduct from Kitchen or Bar stock based on recipe category using FIFO batch logic.</P>

              <H3>📖 Recipe Management</H3>
              <P>Chef-managed recipe library. Recipes are created independently of stock levels — the chef can add any ingredient by name. Each recipe auto-calculates food cost %, suggests selling price, and tracks total cost per portion. Synced to Supabase.</P>

              <H3>📈 Consumption Records</H3>
              <P>Manual recording of ingredient usage outside of sales (wastage, staff meals, events, testing). Each record requires category, quantity, and notes. Manager approval workflow for accountability.</P>

              <H3>📅 Daily Inventory</H3>
              <P>Physical count sheets for Main, Kitchen, and Bar stores. The system computes theoretical closing stock (opening + transfers − usage − consumption). Staff enters physical count and the system calculates variance and variance cost.</P>

              <H3>⏰ Batch Expiry Report</H3>
              <P>All FIFO batch records across all 3 stores displayed with expiry status: Active (green), Expiring Soon within 7 days (amber), Expired (red). Days until expiry countdown shown.</P>

              <H3>📉 Reports & Analytics</H3>
              <P>Revenue by category charts, food cost % trends, top-selling items, stock movement history. 7-day daily trend with profit line.</P>

              <H3>📊 Profit & Loss Report</H3>
              <P>Executive P&L filterable by period (Monthly/Quarterly/6-Month/Annual), year, and department. Shows Revenue, COGS, Gross Profit, Labor Cost, Net Income, and margins. Recharts area/bar charts. Branded PDF export.</P>

              <H3>🏢 HOD Department P&L</H3>
              <P>Restricted to HOD role. Shows current month KPIs (Revenue, COGS, Labor, Net Income) and 6-month Recharts AreaChart trend for their department only.</P>

              <H3>👷 Payroll Management</H3>
              <P>Monthly payroll processing with Ethiopian Income Tax brackets (0%–35%), 7% employee pension, 11% employer pension, and 10% service charge distribution from total sales. Bank of Abyssinia account tracking. Draft → Processed → Paid status.</P>

              <H3>💰 Accounts Receivable</H3>
              <P>Track client invoices (travel agents, corporate) with 0-30, 31-60, 61+ day aging buckets. Assign to Collector role with in-app notification. Payment history recording.</P>

              <H3>📑 Accounts Payable</H3>
              <P>Track supplier invoices with same aging bucket system. Payment recording with reference numbers.</P>

              <H3>⚙️ Settings</H3>
              <P>Hotel name, currency, target food cost %, variance thresholds, dark/light theme. Admin can edit role permission matrix.</P>
            </div>
          )}

          {active === "roles" && (
            <div>
              <H2>User Roles & Access</H2>
              <P>All 11 roles are configurable by Admin via the Settings → Role Permissions matrix.</P>
              <Table
                headers={["Role", "Label", "Primary Responsibilities"]}
                rows={[
                  [<Badge color="red">admin</Badge>, "Admin", "Full system access, can bypass any approval step, manages users and permissions"],
                  [<Badge color="blue">manager</Badge>, "F&B Manager", "Approves store requests, consumption, daily inventory, views reports and P&L"],
                  [<Badge color="amber">storekeeper</Badge>, "Storekeeper", "GRN, stock movements, store request fulfillment, PR quality check"],
                  [<Badge color="green">kitchen</Badge>, "Kitchen Head", "Submits store requests, records consumption, views kitchen stock"],
                  [<Badge color="purple">cashier</Badge>, "Cashier", "Records daily sales"],
                  [<Badge color="cyan">finance</Badge>, "Finance Head", "Approves store requests and purchase requests, views payroll/AR/AP"],
                  [<Badge color="yellow">owner</Badge>, "Owner / Director", "Final PR approval, can adjust/zero items, assigns to purchaser"],
                  [<Badge color="orange">purchaser</Badge>, "Purchaser", "Receives assigned PRs, confirms goods with real qty+price, triggers quality check"],
                  [<Badge color="pink">collector</Badge>, "AR Collector", "Receives AR assignments, confirms collection of client payments"],
                  [<Badge color="teal">hod</Badge>, "Dept. Head (HOD)", "Views own department P&L, submits store/purchase requests for their dept"],
                  [<Badge color="slate">audit</Badge>, "Internal Auditor", "Read-only access to sales, stock movements, AR/AP, payroll, reports"],
                ]}
              />

              <H2>Default User Accounts</H2>
              <Table
                headers={["Name", "Username", "Password", "Role"]}
                rows={[
                  ["Sentayehu Berhanu", "admin", "admin123", "admin"],
                  ["Selamawit Haile", "manager", "manager123", "manager"],
                  ["Dawit Bekele", "storekeeper", "store123", "storekeeper"],
                  ["Yonas Tadesse", "kitchen", "kitchen123", "kitchen"],
                  ["Tigist Alemu", "cashier", "cashier123", "cashier"],
                  ["Mekdes Girma", "finance", "finance123", "finance"],
                  ["Abebe Worku", "owner", "owner123", "owner"],
                  ["Fekadu Assefa", "purchaser", "purchase123", "purchaser"],
                  ["Hiwot Negash", "collector", "collect123", "collector"],
                  ["Biruk Tesfaye", "hod", "hod123", "hod"],
                  ["Alem Bekele", "audit", "audit123", "audit"],
                ]}
              />
            </div>
          )}

          {active === "workflows" && (
            <div>
              <H2>Key Operational Workflows</H2>

              <H3>Store Request Flow (Internal — Kitchen/Bar to Main Store)</H3>
              <Step n={1} label="Kitchen/Bar Head submits request" desc="Lists items needed with quantities and urgency. Auto-calculated total cost shown." />
              <Step n={2} label="F&B Manager reviews" desc="Can approve as-is, reduce quantities on individual items, or zero specific items." />
              <Step n={3} label="Finance Head reviews" desc="Can further reduce quantities (cannot exceed manager-approved qty) or zero items." />
              <Step n={4} label="Storekeeper fulfills" desc="Enters actual fulfilled quantities. Main Store deducts, Kitchen/Bar stock adds. FIFO batch transfer triggered." />

              <H3>Purchase Request Flow (External — Procurement)</H3>
              <Step n={1} label="Department submits PR" desc="Kitchen/Bar/HOD/Storekeeper creates PR with items, estimated costs, urgency, and purpose." />
              <Step n={2} label="Storekeeper forwards (if submitted by dept head)" desc="Storekeeper reviews and forwards to Finance. Storekeeper PRs go directly to Finance." />
              <Step n={3} label="Finance Head approves" desc="Finance reviews budget alignment and approves or rejects with notes." />
              <Step n={4} label="Owner/Admin final approval" desc="Owner can adjust or zero individual item quantities, then assigns to a Purchaser." />
              <Step n={5} label="Purchaser confirms receipt" desc="Enters REAL received quantities and ACTUAL unit prices per item (not estimates). Adds supplier name and invoice number." />
              <Step n={6} label="Quality Check (Storekeeper/F&B Manager)" desc="Inspect received goods for quality. Approve to automatically add items to Main Store inventory with actual prices." />
              <Step n={7} label="GRN complete → Items in Main Store" desc="Approved items automatically create or update ingredients in Main Store. Actual cost updates ingredient cost per unit." />

              <H3>Daily Operations Flow</H3>
              <Step n={1} label="Morning physical count" desc="F&B Manager or Storekeeper counts physical stock in each store and submits Daily Inventory sheet." />
              <Step n={2} label="Issue stock to Kitchen/Bar" desc="Storekeeper creates ISSUE or TRANSFER movement. Stock moves from Main Store to Kitchen/Bar." />
              <Step n={3} label="Sales recording" desc="Cashier records sales by recipe. System auto-deducts from Kitchen or Bar stock using FIFO." />
              <Step n={4} label="Consumption recording" desc="Kitchen Head records wastage, staff meals, testing. Manager approves." />
              <Step n={5} label="Variance review" desc="F&B Manager reviews variance report to identify unexpected consumption or potential theft." />
              <Step n={6} label="Batch expiry check" desc="Storekeeper checks batch expiry report and flags near-expiry items for priority use." />

              <H3>FIFO Batch Logic</H3>
              <P>Every GRN creates an <strong>IngredientBatch</strong> record with batch number, supplier, received date, expiry date, quantity, and location. When stock is consumed (via sales, consumption records, or store request fulfillment), the oldest batch is depleted first. When stock is transferred between stores, batch records are cloned to the destination maintaining FIFO continuity.</P>

              <H3>Variance Detection Logic</H3>
              <P>Expected consumption = Sum of (recipe ingredient quantity × recipe sales quantity) for each ingredient. Actual consumption = consumption records + sales-triggered deductions. Variance = Expected − Actual. Warning threshold: &gt;10%. Critical threshold: &gt;25%. Variance cost = |variance| × ingredient cost per unit.</P>
            </div>
          )}

          {active === "data" && (
            <div>
              <H2>Data Architecture</H2>

              <H3>Supabase Database (Live — Core Tables)</H3>
              <Table
                headers={["Table", "Description"]}
                rows={[
                  ["ingredients", "Main Store ingredient catalog — synced in real-time"],
                  ["recipes", "Recipe library with ingredient JSON — chef managed"],
                  ["sales", "Daily sales records with item JSON"],
                  ["stock_movements", "Full audit trail of all GRN/ISSUE/TRANSFER/ADJUSTMENT/RETURN"],
                ]}
              />

              <H3>localStorage Stores (Operational/FIFO)</H3>
              <Table
                headers={["Key", "Description"]}
                rows={[
                  ["fnb_users", "All system user accounts with roles and credentials"],
                  ["fnb_kitchen_stock", "Kitchen sub-inventory (real-time quantities)"],
                  ["fnb_bar_stock", "Bar sub-inventory (real-time quantities)"],
                  ["fnb_batches", "FIFO batch records across all 3 stores"],
                  ["fnb_store_requests", "4-stage internal store request pipeline"],
                  ["fnb_purchase_requests", "7-stage external purchase request pipeline"],
                  ["fnb_employees", "Employee roster with payroll data"],
                  ["fnb_payroll", "Monthly payroll records"],
                  ["fnb_accounts_receivable", "Client invoice aging and collection"],
                  ["fnb_accounts_payable", "Supplier invoice aging and payment"],
                  ["fnb_notifications", "In-app notification feed"],
                  ["fnb_daily_inventory", "Physical count sheets"],
                  ["fnb_activity_log", "Full audit trail (500 entry cap)"],
                  ["fnb_alerts", "Low-stock and variance alert feed"],
                  ["fnb_consumption", "Manual consumption records"],
                  ["fnb_grns", "GRN records (legacy — movements are primary)"],
                  ["fnb_settings", "Hotel name, currency, thresholds, theme"],
                ]}
              />

              <H3>Data Sync Strategy</H3>
              <P>Core tables (ingredients, recipes, sales, stock_movements) read from Supabase first. If Supabase returns data, localStorage is kept in sync for offline access and FIFO/batch operations. If Supabase is unavailable, the app falls back to localStorage seamlessly. Complex FIFO deduction logic (batch records, kitchen/bar stock updates) remains in localStorage for performance and atomicity.</P>
            </div>
          )}

          {active === "financials" && (
            <div>
              <H2>Financial Modules</H2>

              <H3>Ethiopian Payroll Tax Brackets (2025/2026)</H3>
              <Table
                headers={["Income Range (ETB)", "Tax Rate", "Flat Deduction", "Formula"]}
                rows={[
                  ["0 – 2,000", "0%", "ETB 0", "Tax = 0"],
                  ["2,001 – 4,000", "15%", "ETB 300", "Tax = (Income × 15%) − 300"],
                  ["4,001 – 7,000", "20%", "ETB 500", "Tax = (Income × 20%) − 500"],
                  ["7,001 – 10,000", "25%", "ETB 850", "Tax = (Income × 25%) − 850"],
                  ["10,001 – 14,000", "30%", "ETB 1,350", "Tax = (Income × 30%) − 1,350"],
                  ["14,001+", "35%", "ETB 2,050", "Tax = (Income × 35%) − 2,050"],
                ]}
              />

              <H3>Payroll Calculation Formula</H3>
              <P><strong>Service Charge</strong> = 10% of total monthly sales ÷ number of active employees</P>
              <P><strong>Employee Pension</strong> = Gross Salary × 7%</P>
              <P><strong>Employer Pension</strong> = Gross Salary × 11%</P>
              <P><strong>Taxable Income</strong> = Gross Salary (pension deducted before tax per Ethiopian law)</P>
              <P><strong>Income Tax</strong> = calculated via brackets above based on Gross Salary</P>
              <P><strong>Net Salary</strong> = (Gross Salary + Service Charge) − Employee Pension − Income Tax</P>

              <H3>P&L Report Metrics</H3>
              <Table
                headers={["Metric", "Calculation"]}
                rows={[
                  ["Revenue", "Sum of all sale item total prices for the period"],
                  ["COGS", "Sum of total costs from sales records"],
                  ["Gross Profit", "Revenue − COGS"],
                  ["Gross Margin %", "(Gross Profit ÷ Revenue) × 100"],
                  ["Labor Cost", "Sum of (Net Salary + Employer Pension) from payroll records for the period"],
                  ["Net Income", "Gross Profit − Labor Cost"],
                  ["Net Margin %", "(Net Income ÷ Revenue) × 100"],
                  ["Food Cost %", "(COGS ÷ Revenue) × 100"],
                ]}
              />

              <H3>AR Aging Buckets</H3>
              <Table
                headers={["Bucket", "Days Overdue", "Action Required"]}
                rows={[
                  ["0-30", "Current or up to 30 days", "Monitor — send reminder"],
                  ["31-60", "31 to 60 days past due", "Assign collector — escalate"],
                  ["61+", "More than 60 days", "Urgent collection — possible legal action"],
                ]}
              />
            </div>
          )}

          {active === "tech" && (
            <div>
              <H2>Technical Stack</H2>
              <Table
                headers={["Technology", "Version", "Purpose"]}
                rows={[
                  ["React", "18.3.1", "UI framework with hooks and components"],
                  ["TypeScript", "5.5.3", "Type safety across all files"],
                  ["Vite", "5.4.1", "Fast build tool and dev server"],
                  ["Tailwind CSS", "3.4.11", "Utility-first styling"],
                  ["shadcn/ui", "Latest", "Component library (cards, dialogs, forms)"],
                  ["Supabase", "Latest", "PostgreSQL database + authentication (OnSpace Cloud)"],
                  ["React Router DOM", "6.x", "Client-side routing"],
                  ["Recharts", "Latest", "Charts (AreaChart, BarChart, LineChart)"],
                  ["jsPDF + autotable", "Latest", "Branded landscape PDF export"],
                  ["Sonner", "Latest", "Toast notifications"],
                  ["lucide-react", "Latest", "Icon library"],
                  ["localStorage", "Browser API", "FIFO batches, kitchen/bar stock, sessions"],
                ]}
              />

              <H2>Supabase DB Tables</H2>
              <P>Tables created in OnSpace Cloud (Supabase-compatible). All tables have RLS enabled with open policies (since auth is handled by localStorage user system).</P>
              <Table
                headers={["Table", "Primary Key", "Key Columns"]}
                rows={[
                  ["ingredients", "id (text)", "name, unit, cost_per_unit, current_quantity, min_quantity, category"],
                  ["recipes", "id (text)", "name, category, ingredients (jsonb), total_cost, selling_price, active"],
                  ["sales", "id (text)", "date, items (jsonb), total_revenue, total_cost, gross_profit, shift"],
                  ["stock_movements", "id (text)", "ingredient_id, quantity, type, user_id, timestamp, unit_cost, is_flagged"],
                ]}
              />

              <H2>File Structure</H2>
              <div className="rounded-xl border border-border bg-muted/20 p-4 font-mono text-[10px] text-muted-foreground space-y-0.5">
                {[
                  "src/",
                  "├── lib/",
                  "│   ├── supabase.ts        → Supabase client + type definitions",
                  "│   ├── storage.ts         → localStorage stores (FIFO, kitchen/bar, etc.)",
                  "│   ├── pdfExport.ts       → Centralized PDF generation",
                  "│   ├── utils.ts           → Formatting, ID generation, date helpers",
                  "│   └── db/",
                  "│       ├── ingredients.ts → Supabase CRUD for ingredients",
                  "│       ├── recipes.ts     → Supabase CRUD for recipes",
                  "│       ├── sales.ts       → Supabase CRUD for sales",
                  "│       └── stockMovements.ts → Supabase CRUD + side effects",
                  "├── hooks/",
                  "│   ├── useInventory.ts    → Supabase + localStorage sync",
                  "│   ├── useRecipes.ts      → Supabase + localStorage sync",
                  "│   ├── useSales.ts        → Supabase + localStorage sync",
                  "│   ├── useStockMovements.ts → Supabase + localStorage sync",
                  "│   ├── usePurchaseRequests.ts → Full 7-stage PR workflow",
                  "│   └── ... (other hooks)",
                  "├── pages/                 → 20+ page components",
                  "├── types/index.ts         → All TypeScript interfaces",
                  "└── constants/mockData.ts  → Default users + empty data",
                ].map((line, i) => <div key={i}>{line}</div>)}
              </div>

              <H2>PDF Export Coverage</H2>
              <P>Every major module generates a branded landscape PDF using jsPDF + jspdf-autotable with the hotel name header, date, and color-coded tables:</P>
              <div className="flex flex-wrap gap-1 mt-2">
                {["Main Store Inventory", "Kitchen Store", "Bar Store", "Stock Movements", "Sales Records", "Consumption Records", "Batch Expiry Report", "Store Requests", "Purchase Requests", "Payroll", "Accounts Receivable", "Accounts Payable", "P&L Executive Report", "Purchaser Dashboard"].map(m => (
                  <Badge key={m} color="blue">{m}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
