"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";

export default function VendorNotifications() {
  const { notifications, listings, currentUser, markNotificationRead } = useApp();
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);

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
    listing_approved: "bg-emerald-50 text-emerald-600",
    account_approved: "bg-blue-50 text-blue-600",
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 py-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Notifications</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {myNotifs.filter(n => !n.read).length} unread alerts
          </p>
        </div>
        {myNotifs.some(n => !n.read) && (
          <button onClick={() => myNotifs.filter(n => !n.read).forEach(n => markNotificationRead(n.id))}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Mark all read
          </button>
        )}
      </div>

      {myNotifs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 block mb-4">notifications_none</span>
          <p className="text-slate-500 dark:text-slate-400 font-bold">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myNotifs.map(n => {
            const isExpanded = expandedNotifId === n.id;
            const Content = (
              <div
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-4 cursor-pointer transition-all hover:shadow-md ${!n.read ? "border-l-4 border-blue-600" : ""}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[n.type] || typeColors.general}`}>
                  <span className="material-symbols-outlined text-lg">{typeIcons[n.type] || "notifications"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className={`font-bold text-sm ${!n.read ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>{n.title}</p>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-bold uppercase">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className={`text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed break-words ${isExpanded ? "" : "line-clamp-1"}`}>{n.message}</p>
                  
                  {isExpanded && n.link && (
                    <div className="mt-3 flex justify-start">
                      <Link href={n.link} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                        Go to Page <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </Link>
                    </div>
                  )}
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />}
              </div>
            );

            const handleClick = () => {
              if (isExpanded) {
                setExpandedNotifId(null);
              } else {
                setExpandedNotifId(n.id);
                if (!n.read) markNotificationRead(n.id);
              }
            };

            return (
              <div key={n.id} onClick={handleClick}>
                {Content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
