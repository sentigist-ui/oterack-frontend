import { Bell, AlertTriangle, CheckCheck, BellRing } from "lucide-react";
import { useState } from "react";
import { cn, formatDateTime } from "@/lib/utils";
import type { Alert, AppNotification } from "@/types";
import { NotificationsStore } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  title: string;
  subtitle?: string;
  alerts: Alert[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  hotelName: string;
}

const NOTIF_TYPE_ICON: Record<string, string> = {
  ar_collection: "💼",
  pr_approval: "📋",
  pr_action: "🛒",
  general: "🔔",
};

const severityColors = {
  info: "text-blue-400 bg-blue-400/10",
  warning: "text-amber-400 bg-amber-400/10",
  critical: "text-red-400 bg-red-400/10",
};

const severityIcons = {
  info: "●",
  warning: "⚠",
  critical: "🚨",
};

export default function Header({ title, subtitle, alerts, unreadCount, onMarkAllRead, onMarkRead, hotelName }: HeaderProps) {
  const [showAlerts, setShowAlerts] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const { user } = useAuth();

  const [notifList, setNotifList] = useState<AppNotification[]>(() =>
    user ? NotificationsStore.getForUser(user.id, user.role).slice(0, 15) : []
  );
  const unreadNotifCount = notifList.filter(n => !n.isRead).length;

  const refreshNotifs = () => {
    if (user) setNotifList(NotificationsStore.getForUser(user.id, user.role).slice(0, 15));
  };

  const markNotifRead = (id: string) => {
    NotificationsStore.markRead(id);
    refreshNotifs();
  };

  const markAllNotifsRead = () => {
    if (user) { NotificationsStore.markAllRead(user.id, user.role); refreshNotifs(); }
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground hidden md:block">{hotelName}</span>

        {/* App Notification Bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(v => !v); if (!showNotifs) refreshNotifs(); setShowAlerts(false); }}
            className={cn(
              "relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
              unreadNotifCount > 0 ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" : "bg-secondary text-muted-foreground hover:bg-muted"
            )}
            aria-label="App Notifications"
          >
            <BellRing className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-blue-500 text-white px-1 alert-pulse">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 rounded-xl border border-border bg-card shadow-2xl z-50 fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadNotifCount > 0 && (
                  <button onClick={markAllNotifsRead} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifList.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">No notifications</p>
                ) : (
                  notifList.map(n => (
                    <button
                      key={n.id}
                      onClick={() => { markNotifRead(n.id); }}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                        !n.isRead && "bg-blue-500/5"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-base mt-0.5 shrink-0">{NOTIF_TYPE_ICON[n.type] ?? "🔔"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-tight">{n.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">{formatDateTime(n.createdAt)}</p>
                        </div>
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alert Bell */}
        <div className="relative">
          <button
            onClick={() => { setShowAlerts(v => !v); setShowNotifs(false); }}
            className={cn(
              "relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
              unreadCount > 0 ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-secondary text-muted-foreground hover:bg-muted"
            )}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground px-1 alert-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 top-11 w-80 rounded-xl border border-border bg-card shadow-2xl z-50 fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">Alerts</span>
                {unreadCount > 0 && (
                  <button onClick={onMarkAllRead} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">No alerts</p>
                ) : (
                  alerts.slice(0, 10).map(alert => (
                    <button
                      key={alert.id}
                      onClick={() => { onMarkRead(alert.id); setShowAlerts(false); }}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                        !alert.isRead && "bg-muted/30"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={cn("text-sm mt-0.5", severityColors[alert.severity])}>
                          {severityIcons[alert.severity]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug line-clamp-2">{alert.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(alert.timestamp)}</p>
                        </div>
                        {!alert.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        <div className="hidden sm:block text-right">
          <p className="text-xs font-medium text-foreground">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
          <p className="text-[10px] text-muted-foreground">{new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </div>
    </header>
  );
}
