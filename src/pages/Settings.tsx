import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Settings as SettingsStore, Users, ActivityLogStore, RolePermissions, Sales as SalesStore, type RolePermissionMap } from "@/lib/storage";
import type { AppSettings, User, ActivityLog } from "@/types";
import { cn, generateId, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { Save, Plus, Trash2, Shield, Settings as SettingsIcon, Bell, Users as UsersIcon, Droplets, Sun, Moon, User as UserIcon, Activity, Lock, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type SettingsTab = "profile" | "general" | "costControl" | "users" | "water" | "permissions" | "activityLog";

// Permission definition: moduleKey -> label, group
const PERMISSION_DEFS: { key: string; label: string; group: string; adminLocked?: boolean }[] = [
  { key: "dashboard",           label: "Dashboard",           group: "Core Modules" },
  { key: "recipes_view",        label: "Recipes (View)",       group: "Core Modules" },
  { key: "recipes_edit",        label: "Recipes (Edit)",       group: "Core Modules" },
  { key: "inventory_view",      label: "Inventory (View)",     group: "Core Modules" },
  { key: "inventory_edit",      label: "Inventory (Edit)",     group: "Core Modules" },
  { key: "grn",                 label: "Record GRN",           group: "Stock & Consumption" },
  { key: "issue_stock",         label: "Issue Stock",          group: "Stock & Consumption" },
  { key: "flag_movements",      label: "Flag Movements",       group: "Stock & Consumption" },
  { key: "consumption_record",  label: "Record Consumption",   group: "Stock & Consumption" },
  { key: "consumption_approve", label: "Approve Consumption",  group: "Stock & Consumption" },
  { key: "sales_record",        label: "Record Sales",         group: "Sales & Reports" },
  { key: "reports_view",        label: "View Reports",         group: "Sales & Reports" },
  { key: "variance_reports",    label: "Variance Reports",     group: "Sales & Reports" },
  { key: "export_data",         label: "Export Data",          group: "Sales & Reports" },
  { key: "manage_users",        label: "Manage Users",         group: "Administration", adminLocked: true },
  { key: "system_settings",     label: "System Settings",      group: "Administration", adminLocked: true },
  { key: "activity_log",        label: "Activity Log",         group: "Administration" },
  { key: "approve_adjustments", label: "Approve Adjustments",  group: "Administration" },
];
const PERMISSION_GROUPS = ["Core Modules", "Stock & Consumption", "Sales & Reports", "Administration"] as const;

const ALL_ROLES = ["admin", "manager", "storekeeper", "kitchen", "cashier"];
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "F&B Manager",
  storekeeper: "Storekeeper",
  kitchen: "Kitchen",
  cashier: "Cashier",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  manager: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  storekeeper: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  kitchen: "bg-green-500/20 text-green-400 border-green-500/30",
  cashier: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "text-green-400 bg-green-500/10",
  LOGOUT: "text-muted-foreground bg-muted/50",
  GRN_CREATED: "text-blue-400 bg-blue-500/10",
  STOCK_ISSUED: "text-amber-400 bg-amber-500/10",
  MOVEMENT_FLAGGED: "text-red-400 bg-red-500/10",
  SALE_RECORDED: "text-cyan-400 bg-cyan-500/10",
  SETTINGS_UPDATED: "text-purple-400 bg-purple-500/10",
  RECIPE_UPDATED: "text-amber-400 bg-amber-500/10",
  DEFAULT: "text-muted-foreground bg-muted/50",
};

export default function Settings() {
  const { user: currentUser, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [settings, setSettings] = useState<AppSettings>(() => SettingsStore.get());
  const [users, setUsers] = useState<User[]>(() => Users.getAll());
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => ActivityLogStore.getAll());
  const [permissions, setPermissions] = useState<RolePermissionMap>(() => RolePermissions.get());
  const [permissionsChanged, setPermissionsChanged] = useState(false);

  const togglePermission = (moduleKey: string, role: string) => {
    if (role === "admin") return; // admin always has all access
    setPermissions(prev => {
      const current = prev[moduleKey] || [];
      const updated = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role];
      return { ...prev, [moduleKey]: updated };
    });
    setPermissionsChanged(true);
  };

  const handleSavePermissions = () => {
    RolePermissions.set(permissions);
    setPermissionsChanged(false);
    toast.success("Role permissions saved");
  };

  const handleResetPermissions = () => {
    if (!confirm("Reset all permissions to system defaults?")) return;
    RolePermissions.reset();
    setPermissions(RolePermissions.get());
    setPermissionsChanged(false);
    toast.success("Permissions reset to defaults");
  };

  const handleResetSales = () => {
    if (!confirm("Clear ALL sales data? This cannot be undone.")) return;
    SalesStore.clearAll();
    toast.success("All sales data cleared successfully");
  };
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});

  // Profile state
  const [profileName, setProfileName] = useState(currentUser?.name || "");
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const handleSaveProfile = () => {
    if (!profileName.trim()) { toast.error("Name is required"); return; }
    updateProfile({ name: profileName.trim(), email: profileEmail.trim() });
    toast.success("Profile updated successfully");
  };

  const handleChangePassword = () => {
    if (!currentPassword) { toast.error("Enter your current password"); return; }
    if (currentPassword !== currentUser?.password) { toast.error("Current password is incorrect"); return; }
    if (!newPassword || newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    updateProfile({ password: newPassword });
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    toast.success("Password changed successfully");
  };

  const handleSaveSettings = () => {
    SettingsStore.set(settings);
    if (settings.theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    toast.success("Settings saved successfully");
  };

  const handleToggleTheme = (theme: "dark" | "light") => {
    setSettings(p => ({ ...p, theme }));
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  const handleSaveUser = () => {
    if (!editingUser.name?.trim()) { toast.error("Name is required"); return; }
    if (!editingUser.username?.trim()) { toast.error("Username is required"); return; }
    if (!editingUser.password?.trim()) { toast.error("Password is required"); return; }
    const isNew = !editingUser.id;
    const u: User = {
      id: editingUser.id || generateId(),
      name: editingUser.name!,
      username: editingUser.username!,
      password: editingUser.password!,
      role: editingUser.role || "cashier",
      email: editingUser.email || "",
      active: editingUser.active !== false,
    };
    Users.upsert(u);
    setUsers(Users.getAll());
    toast.success(`User "${u.name}" ${isNew ? "created" : "updated"}`);
    setShowUserForm(false);
    setEditingUser({});
  };

  const handleDeleteUser = (u: User) => {
    if (u.id === currentUser?.id) { toast.error("Cannot delete your own account"); return; }
    if (!confirm(`Delete user "${u.name}"?`)) return;
    Users.delete(u.id);
    setUsers(Users.getAll());
    toast.success("User deleted");
  };

  const isAdmin = currentUser?.role === "admin";
  const isAdminOrManager = currentUser?.role === "admin" || currentUser?.role === "manager";

  const tabs = [
    { id: "profile" as SettingsTab, label: "My Profile", icon: UserIcon, show: true },
    { id: "general" as SettingsTab, label: "General", icon: SettingsIcon, show: isAdmin },
    { id: "costControl" as SettingsTab, label: "Cost Control", icon: Shield, show: isAdmin },
    { id: "water" as SettingsTab, label: "Water Control", icon: Droplets, show: isAdmin },
    { id: "permissions" as SettingsTab, label: "Role Permissions", icon: Shield, show: isAdminOrManager },
    { id: "users" as SettingsTab, label: "Users", icon: UsersIcon, show: isAdmin },
    { id: "activityLog" as SettingsTab, label: "Activity Log", icon: Activity, show: isAdminOrManager },
  ].filter(t => t.show);

  return (
    <AppLayout>
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary mb-6 flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              activeTab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* PROFILE */}
      {activeTab === "profile" && (
        <div className="max-w-lg space-y-5 fade-in">
          {/* Avatar & identity */}
          <div className="stat-card">
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary text-2xl font-bold shrink-0">
                {currentUser?.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-base font-bold text-foreground">{currentUser?.name}</p>
                <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border", ROLE_COLORS[currentUser?.role || "cashier"])}>
                  {ROLE_LABELS[currentUser?.role || "cashier"]}
                </span>
                <p className="text-xs text-muted-foreground mt-1">@{currentUser?.username}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Full Name</label>
                <input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={e => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="email@hotel.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Username</label>
                <input
                  value={currentUser?.username || ""}
                  disabled
                  className="w-full px-3 py-2 text-sm rounded-lg bg-muted/50 border border-border text-muted-foreground cursor-not-allowed"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Username cannot be changed — contact admin</p>
              </div>
              <button onClick={handleSaveProfile} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
                <Save className="w-4 h-4" /> Save Profile
              </button>
            </div>
          </div>

          {/* Password Reset */}
          <div className="stat-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" /> Change Password
            </h3>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Min. 6 characters"
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Repeat new password"
              />
            </div>
            {newPassword && confirmPassword && (
              <div className={cn("flex items-center gap-2 text-xs rounded-lg px-3 py-2", newPassword === confirmPassword ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10")}>
                {newPassword === confirmPassword ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {newPassword === confirmPassword ? "Passwords match" : "Passwords do not match"}
              </div>
            )}
            <button onClick={handleChangePassword} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-destructive/80 text-white text-sm font-semibold hover:bg-destructive transition-colors">
              <Lock className="w-4 h-4" /> Change Password
            </button>
          </div>
        </div>
      )}

      {/* GENERAL */}
      {activeTab === "general" && (
        <div className="max-w-lg space-y-5 fade-in">
          <div className="stat-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Theme Mode</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleTheme("dark")}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all", settings.theme !== "light" ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-border/80")}
                >
                  <Moon className="w-4 h-4" /> Dark Mode
                </button>
                <button
                  onClick={() => handleToggleTheme("light")}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all", settings.theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-border/80")}
                >
                  <Sun className="w-4 h-4" /> Light Mode
                </button>
              </div>
            </div>
          </div>

          <div className="stat-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Hotel / Restaurant Information</h3>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Property Name</label>
              <input value={settings.hotelName} onChange={e => setSettings(p => ({ ...p, hotelName: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Currency Code</label>
                <input value={settings.currency} onChange={e => setSettings(p => ({ ...p, currency: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Currency Symbol</label>
                <input value={settings.currencySymbol} onChange={e => setSettings(p => ({ ...p, currencySymbol: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
          </div>

          <div className="stat-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Bell className="w-4 h-4" />Alert Settings</h3>
            <div className="space-y-3">
              {[
                { key: "lowStockAlertEnabled" as const, label: "Low Stock Alerts", desc: "Notify when items fall below minimum threshold" },
                { key: "varianceAlertEnabled" as const, label: "Variance Alerts", desc: "Alert when stock variance exceeds thresholds" },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full transition-colors relative cursor-pointer", settings[key] ? "bg-primary" : "bg-muted")} onClick={() => setSettings(p => ({ ...p, [key]: !p[key] }))}>
                    <div className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform", settings[key] ? "translate-x-5" : "translate-x-0.5")} />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleSaveSettings} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      )}

      {/* COST CONTROL */}
      {activeTab === "costControl" && (
        <div className="max-w-lg space-y-5 fade-in">
          <div className="stat-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Food Cost Targets</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "targetFoodCostPercent" as const, label: "Food Cost Target (%)", hint: "Industry standard: 28-35%" },
                { key: "targetBeverageCostPercent" as const, label: "Beverage Cost Target (%)", hint: "Industry standard: 18-25%" },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
                  <input type="number" step="0.1" min="0" max="100" value={settings[key]} onChange={e => setSettings(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="stat-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Variance Thresholds</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Warning Threshold (%)</label>
                <input type="number" step="1" min="0" max="100" value={settings.varianceWarningPercent} onChange={e => setSettings(p => ({ ...p, varianceWarningPercent: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                <p className="text-[10px] text-amber-400 mt-1">Shows amber warning badge</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Critical Threshold (%)</label>
                <input type="number" step="1" min="0" max="100" value={settings.varianceCriticalPercent} onChange={e => setSettings(p => ({ ...p, varianceCriticalPercent: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                <p className="text-[10px] text-red-400 mt-1">Shows critical red alert 🚨</p>
              </div>
            </div>
          </div>
          <button onClick={handleSaveSettings} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      )}

      {/* WATER CONTROL */}
      {activeTab === "water" && (
        <div className="max-w-lg space-y-5 fade-in">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <Droplets className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-300">Water Control Feature</p>
                <p className="text-xs text-blue-400/80 mt-1">Define the standard water allowance per guest to detect unauthorized issuances. Direct answer to your real theft case.</p>
              </div>
            </div>
          </div>
          <div className="stat-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Water Per Guest Standard</h3>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Water Bottles Per Guest</label>
              <input type="number" step="0.5" min="0" value={settings.waterPerGuestBottles} onChange={e => setSettings(p => ({ ...p, waterPerGuestBottles: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Example Calculation</p>
              <p className="text-xs text-muted-foreground">60 guests → Expected: {60 * settings.waterPerGuestBottles} bottles</p>
              <p className="text-xs text-muted-foreground">80 issued → Variance: <span className="text-red-400 font-semibold">{80 - 60 * settings.waterPerGuestBottles} extra 🚨</span></p>
              <p className="text-xs text-muted-foreground">Cost of variance: <span className="text-red-400 font-semibold">ETB {((80 - 60 * settings.waterPerGuestBottles) * 15).toFixed(0)}</span></p>
            </div>
          </div>
          <button onClick={handleSaveSettings} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      )}

      {/* ROLE PERMISSIONS */}
      {activeTab === "permissions" && (
        <div className="fade-in space-y-4">
          {/* Header actions */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Module Access Control</p>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle to grant or revoke module access per role. Admin always retains full access.</p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <button
                    onClick={handleResetPermissions}
                    className="px-3 py-1.5 text-xs rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
                  >
                    Reset Defaults
                  </button>
                  {permissionsChanged && (
                    <button
                      onClick={handleSavePermissions}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                    >
                      <Save className="w-3.5 h-3.5" /> Save Changes
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {permissionsChanged && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">You have unsaved permission changes. Click "Save Changes" to apply.</p>
            </div>
          )}

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Module / Action</th>
                  {ALL_ROLES.map(role => (
                    <th key={role} className="text-center px-3 py-3 text-[10px] font-semibold uppercase">
                      <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", ROLE_COLORS[role])}>{ROLE_LABELS[role]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map(group => (
                  <>
                    <tr key={group} className="border-b border-border bg-muted/50">
                      <td colSpan={ALL_ROLES.length + 1} className="px-4 py-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group}</span>
                      </td>
                    </tr>
                    {PERMISSION_DEFS.filter(d => d.group === group).map(def => (
                      <tr key={def.key} className="table-row-hover border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5 text-xs text-foreground">{def.label}</td>
                        {ALL_ROLES.map(role => {
                          const hasAccess = (permissions[def.key] || []).includes(role);
                          const isLocked = role === "admin" || def.adminLocked; // admin row always locked
                          return (
                            <td key={role} className="px-3 py-2.5 text-center">
                              {isAdmin && !isLocked ? (
                                <button
                                  onClick={() => togglePermission(def.key, role)}
                                  className={cn(
                                    "mx-auto flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                                    hasAccess
                                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                      : "bg-muted/60 text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
                                  )}
                                  title={hasAccess ? "Click to revoke" : "Click to grant"}
                                >
                                  {hasAccess
                                    ? <CheckCircle className="w-4 h-4" />
                                    : <XCircle className="w-4 h-4" />
                                  }
                                </button>
                              ) : (
                                <span className="flex justify-center">
                                  {hasAccess
                                    ? <CheckCircle className={cn("w-4 h-4", role === "admin" ? "text-primary" : "text-green-400")} />
                                    : <XCircle className="w-4 h-4 text-muted-foreground/30" />
                                  }
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            <div className="mt-4 stat-card border-destructive/30">
              <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-destructive" /> Danger Zone
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">Reset All Sales Data</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Permanently delete all sales records. Cannot be undone.</p>
                </div>
                <button
                  onClick={handleResetSales}
                  className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 border border-destructive/30 transition-colors"
                >
                  Clear All Sales
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* USERS */}
      {activeTab === "users" && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{users.length} users configured</p>
            <button onClick={() => { setEditingUser({ active: true, role: "cashier" }); setShowUserForm(true); }} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add User
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map(u => (
              <div key={u.id} className="stat-card group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-sm font-bold text-foreground shrink-0">
                      {u.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">@{u.username}</p>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", ROLE_COLORS[u.role])}>{ROLE_LABELS[u.role]}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingUser({ ...u }); setShowUserForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteUser(u)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", u.active ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground")}>{u.active ? "Active" : "Inactive"}</span>
                  <span className="text-[10px] text-muted-foreground">{u.email}</span>
                </div>
              </div>
            ))}
          </div>

          {showUserForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl fade-in">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <h2 className="font-semibold text-foreground">{editingUser.id ? "Edit User" : "Add User"}</h2>
                  <button onClick={() => setShowUserForm(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Full Name *</label>
                    <input value={editingUser.name || ""} onChange={e => setEditingUser(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g., Abebe Kebede" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Username *</label>
                      <input value={editingUser.username || ""} onChange={e => setEditingUser(p => ({ ...p, username: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="username" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Password *</label>
                      <input type="text" value={editingUser.password || ""} onChange={e => setEditingUser(p => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="password" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Role</label>
                    <select value={editingUser.role || "cashier"} onChange={e => setEditingUser(p => ({ ...p, role: e.target.value as User["role"] }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="admin">Admin (Owner / GM)</option>
                      <option value="manager">F&B Manager</option>
                      <option value="storekeeper">Storekeeper</option>
                      <option value="kitchen">Kitchen / Bar</option>
                      <option value="cashier">Cashier / POS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                    <input type="email" value={editingUser.email || ""} onChange={e => setEditingUser(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="email@hotel.com" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editingUser.active !== false} onChange={e => setEditingUser(p => ({ ...p, active: e.target.checked }))} className="rounded" />
                    <span className="text-xs text-foreground">Active account</span>
                  </label>
                </div>
                <div className="flex gap-3 p-5 border-t border-border">
                  <button onClick={() => setShowUserForm(false)} className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted">Cancel</button>
                  <button onClick={handleSaveUser} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">{editingUser.id ? "Update" : "Create User"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY LOG */}
      {activeTab === "activityLog" && (
        <div className="fade-in space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{activityLogs.length} activity records</p>
            {isAdmin && (
              <button
                onClick={() => {
                  if (!confirm("Clear all activity logs? This cannot be undone.")) return;
                  ActivityLogStore.clearAll();
                  setActivityLogs([]);
                  toast.success("Activity log cleared");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Log
              </button>
            )}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Time", "User", "Role", "Action", "Module", "Details"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityLogs.map(log => {
                  const colorClass = ACTION_COLORS[log.action] || ACTION_COLORS.DEFAULT;
                  return (
                    <tr key={log.id} className="table-row-hover border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-foreground">{log.userName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", ROLE_COLORS[log.userRole])}>{ROLE_LABELS[log.userRole] || log.userRole}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", colorClass)}>{log.action}</span>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-muted-foreground">{log.module}</td>
                      <td className="px-4 py-3 text-[10px] text-muted-foreground max-w-[280px]">
                        <span className="line-clamp-2">{log.details}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {activityLogs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activity logs recorded</p>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
