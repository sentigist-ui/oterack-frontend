import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "warning" | "danger" | "success";
  className?: string;
}

const variantStyles = {
  default: { card: "", icon: "bg-primary/15 text-primary", value: "text-foreground" },
  warning: { card: "border-amber-500/30", icon: "bg-amber-500/15 text-amber-400", value: "text-amber-400" },
  danger: { card: "border-red-500/30 bg-red-500/5", icon: "bg-red-500/15 text-red-400", value: "text-red-400" },
  success: { card: "border-green-500/30", icon: "bg-green-500/15 text-green-400", value: "text-green-400" },
};

export default function MetricCard({ title, value, subtitle, icon: Icon, trend, variant = "default", className }: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn("stat-card", styles.card, className)}>
      <div className="flex items-start justify-between">
        <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", styles.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            trend.value >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
          )}>
            {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className={cn("text-2xl font-bold font-mono tracking-tight", styles.value)}>{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-0.5">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
