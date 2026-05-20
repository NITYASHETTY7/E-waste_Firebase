"use client";

import { useApp } from "@/context/AppContext";
import Link from "next/link";

export default function ClientNotifications() {
  const { notifications, currentUser, markNotificationRead } = useApp();
  const myNotifs = (notifications || [])
    .filter(n => n.userId === currentUser?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const typeIcons: Record<string, string> = {
    bid_received: "gavel",
    bid_accepted: "verified",
    bid_rejected: "cancel",
    listing_approved: "check_circle",
    account_approved: "how_to_reg",
    general: "notifications",
  };

  const typeColors: Record<string, string> = {
    bid_received: "bg-blue-100 text-blue-700",
    bid_accepted: "bg-emerald-100 text-emerald-700",
    bid_rejected: "bg-red-100 text-red-700",
    listing_approved: "bg-[color:var(--color-secondary-container)] text-[color:var(--color-primary)]",
    account_approved: "bg-[color:var(--color-primary-fixed)] text-[color:var(--color-on-primary-fixed)]",
    general: "bg-slate-100 text-slate-600",
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);
    if (hours >= 24) return `${Math.floor(hours / 24)}d ago`;
    if (hours >= 1) return `${hours}h ago`;
    return `${mins}m ago`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Notifications</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">
            {myNotifs.filter(n => !n.read).length} unread alerts
          </p>
        </div>
        {myNotifs.some(n => !n.read) && (
          <button onClick={() => myNotifs.filter(n => !n.read).forEach(n => markNotificationRead(n.id))}
            className="btn-outline text-sm py-2 px-4">Mark all read</button>
        )}
      </div>

      {myNotifs.length === 0 ? (
        <div className="card p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 block mb-4">notifications_none</span>
          <p className="text-[color:var(--color-on-surface-variant)]">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myNotifs.map(n => (
            <div key={n.id}
              onClick={() => !n.read && markNotificationRead(n.id)}
              className={`card p-4 flex items-start gap-4 cursor-pointer transition-all hover:shadow-md ${!n.read ? "border-l-4 border-[color:var(--color-primary)]" : ""}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[n.type] || typeColors.general}`}>
                <span className="material-symbols-outlined text-lg">{typeIcons[n.type] || "notifications"}</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className={`font-bold text-sm ${!n.read ? "text-[color:var(--color-on-surface)]" : "text-[color:var(--color-on-surface-variant)]"}`}>{n.title}</p>
                  <span className="text-[10px] text-[color:var(--color-on-surface-variant)] shrink-0 ml-2">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-xs text-[color:var(--color-on-surface-variant)] mt-0.5 leading-relaxed">{n.message}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-[color:var(--color-primary)] shrink-0 mt-1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
