import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ChefHat, Eye, EyeOff, Lock, User, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DEMO_CREDENTIALS = [
  { role: "Admin", username: "admin", password: "admin123", color: "text-red-400" },
  { role: "F&B Manager", username: "manager", password: "manager123", color: "text-blue-400" },
  { role: "Storekeeper", username: "storekeeper", password: "store123", color: "text-amber-400" },
  { role: "Kitchen", username: "kitchen", password: "kitchen123", color: "text-green-400" },
  { role: "Cashier", username: "cashier", password: "cashier123", color: "text-purple-400" },
];

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const success = login(username.trim(), password);
    setLoading(false);
    if (success) {
      toast.success("Welcome back!");
      navigate("/dashboard");
    } else {
      setError("Invalid username or password. Please try again.");
    }
  };

  const quickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-background flex items-stretch">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gradient-to-br from-[hsl(222,50%,5%)] to-[hsl(210,50%,10%)] p-10 border-r border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20">
            <ChefHat className="w-6 h-6 text-primary" />
          </div>
          <span className="text-lg font-bold text-foreground">F&B Control Pro</span>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-foreground leading-tight mb-4">
            Hotel & Restaurant<br />
            <span className="text-primary">F&B Management</span>
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Complete cost control, inventory tracking, recipe standardization, and theft/variance detection for professional hospitality operations.
          </p>
          <div className="space-y-3">
            {[
              { icon: "📊", text: "Real-time variance detection & theft alerts" },
              { icon: "🍽️", text: "Standardized recipes with auto food cost %" },
              { icon: "📦", text: "Full stock movement tracking with approvals" },
              { icon: "💧", text: "Water per guest monitoring & event control" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground/50">© 2024 F&B Control Pro. All rights reserved.</div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <ChefHat className="w-6 h-6 text-primary" />
            <span className="font-bold text-foreground">F&B Control Pro</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground mb-6">Access your F&B management dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground px-2">Demo Accounts</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_CREDENTIALS.map(cred => (
                <button
                  key={cred.username}
                  type="button"
                  onClick={() => quickLogin(cred.username, cred.password)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary hover:bg-muted transition-colors text-xs"
                >
                  <span className={cn("font-semibold", cred.color)}>{cred.role}</span>
                  <span className="text-muted-foreground font-mono">{cred.username} / {cred.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
