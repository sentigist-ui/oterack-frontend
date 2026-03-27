import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import loginBg from "@/assets/login-bg-lavender.jpg";

const DEMO_CREDENTIALS = [
  { role: "Admin", username: "admin", password: "admin123" },
  { role: "F&B Manager", username: "manager", password: "manager123" },
  { role: "Storekeeper", username: "storekeeper", password: "store123" },
  { role: "Kitchen", username: "kitchen", password: "kitchen123" },
  { role: "Cashier", username: "cashier", password: "cashier123" },
];

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

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
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-pink-900/30" />
      </div>

      {/* Glass Morphism Login Card */}
      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl p-10">

          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/30 backdrop-blur-sm border border-white/30 mb-4">
              <Sun className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">F&B Control Pro</h1>
            <p className="text-sm text-white/70 text-center">
              Complete F&B management for hotels & restaurants
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-xs font-medium text-white/80 mb-2" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                required
                className="w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-sm border border-white/20 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-medium text-white/80 mb-2" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-black/30 backdrop-blur-sm border border-white/20 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-black/30 text-purple-500 focus:ring-2 focus:ring-purple-400/50 transition-all"
                />
                <span className="text-xs text-white/80 group-hover:text-white transition-colors">Remember me</span>
              </label>
              <button
                type="button"
                className="text-xs text-white/80 hover:text-white transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-200 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl px-4 py-3">
                <span className="shrink-0">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-white text-gray-900 text-sm font-bold hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? "Signing in..." : "Log In"}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-xs text-white/60 px-2">Quick Access</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_CREDENTIALS.map(cred => (
                <button
                  key={cred.username}
                  type="button"
                  onClick={() => quickLogin(cred.username, cred.password)}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-xs group"
                >
                  <span className="font-semibold text-white/90 group-hover:text-white">{cred.role}</span>
                  <span className="text-white/50 font-mono text-[10px] group-hover:text-white/70">{cred.username}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-white/40">© 2024 F&B Control Pro. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
