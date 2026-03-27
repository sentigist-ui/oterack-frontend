import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VarianceBadgeProps {
  status: "ok" | "warning" | "critical";
  percent?: number;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export default function VarianceBadge({ status, percent, showIcon = true, size = "md" }: VarianceBadgeProps) {
  const configs = {
    ok: { className: "variance-badge-ok", icon: CheckCircle, label: "Normal" },
    warning: { className: "variance-badge-warning", icon: AlertCircle, label: "Warning" },
    critical: { className: "variance-badge-critical", icon: AlertTriangle, label: "CRITICAL" },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={cn(config.className, size === "sm" && "text-[10px] px-1.5 py-0.5")}>
      {showIcon && <Icon className={cn("w-3 h-3", status === "critical" && "alert-pulse")} />}
      {percent !== undefined ? `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%` : config.label}
    </span>
  );
}
