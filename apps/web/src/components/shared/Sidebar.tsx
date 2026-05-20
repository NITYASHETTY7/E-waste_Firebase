"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { AiAssistantCard } from "./AiAssistantCard";

const ADMIN_SECTIONS = [
  {
    title: "Management",
    links: [
      { href: "/admin/users", icon: "group", label: "Clients" },
      { href: "/admin/vendors", icon: "recycling", label: "Vendors" },
      { href: "/admin/individual-users", icon: "person_check", label: "Individual Users" },
      { href: "/admin/user-products", icon: "person_pin", label: "Individual Products", badge: "New" },
      { href: "/admin/listings", icon: "inventory_2", label: "Requests" },
      { href: "/admin/auctions", icon: "gavel", label: "Auctions" },
      { href: "/admin/payments", icon: "payments", label: "Payments" },
      { href: "/admin/transactions", icon: "receipt_long", label: "Transactions" },
    ]
  },
  {
    title: "Operations",
    links: [
      { href: "/admin/purchase-orders", icon: "description", label: "Purchase Orders" },
      { href: "/admin/audits", icon: "fact_check", label: "Audit Management" },
      { href: "/admin/sealed-bids", icon: "lock", label: "Sealed Bids" },
      { href: "/admin/logistics", icon: "local_shipping", label: "Pickups & Logistics" },
      { href: "/admin/reconciliation", icon: "balance", label: "Reconciliation" },
      { href: "/admin/compliance", icon: "shield", label: "Compliance" },
      { href: "/admin/documents", icon: "folder_open", label: "Documents" },
    ]
  },
  {
    title: "Analytics",
    links: [
      { href: "/admin/reports", icon: "analytics", label: "Reports & Insights" },
      { href: "/admin/performance", icon: "troubleshoot", label: "Performance" },
      { href: "/admin/analytics-hub", icon: "hub", label: "Analytics Hub", badge: "New" },
    ]
  }
];

const VENDOR_LINKS = [
  { href: "/vendor/marketplace", icon: "storefront", label: "Auctions" },
  { href: "/vendor/individual-products", icon: "person_pin", label: "Individual Products" },
  { href: "/vendor/invitations", icon: "mail", label: "Invitations" },
  { href: "/vendor/audits", icon: "fact_check", label: "Site Audits" },
  { href: "/vendor/live-auction", icon: "sensors", label: "Live Auction" },
  { href: "/vendor/bids", icon: "gavel", label: "My Bids" },
  { href: "/vendor/purchase-order", icon: "description", label: "Purchase Orders" },
  { href: "/vendor/payments", icon: "payments", label: "Payments" },
  { href: "/vendor/handover", icon: "inventory", label: "Handover & Compliance" },
  { href: "/vendor/ratings", icon: "star_rate", label: "Ratings" },
  { href: "/vendor/reports", icon: "bar_chart", label: "Reports" },
  { href: "/vendor/profile", icon: "badge", label: "Profile & Docs" },
];

const CLIENT_LINKS = [
  { href: "/client/post", icon: "add_circle", label: "Post E-Waste" },
  { href: "/client/listings", icon: "inventory_2", label: "My Listings" },
  { href: "/client/bids", icon: "gavel", label: "Bids Received" },
  { href: "/client/sealed-bids", icon: "lock", label: "Sealed Bids" },
  { href: "/client/live-auction", icon: "sensors", label: "Live Auction" },
  { href: "/client/purchase-order", icon: "description", label: "Purchase Orders" },
  { href: "/client/handover", icon: "inventory", label: "Handover & Gate Pass" },
  { href: "/client/ratings", icon: "star_rate", label: "Rate Vendors" },
  { href: "/client/reports", icon: "bar_chart", label: "Reports" },
  { href: "/client/documents", icon: "folder_open", label: "Documents" },
  { href: "/client/notifications", icon: "notifications", label: "Notifications" },
  { href: "/client/profile", icon: "person", label: "Profile" },
];

const CONSUMER_LINKS = [
  { href: "/consumer/pickup", icon: "add_circle", label: "New Pickup" },
  { href: "/consumer/history", icon: "history", label: "Order History" },
  { href: "/consumer/impact", icon: "eco", label: "My Impact" },
  { href: "/consumer/profile", icon: "person", label: "Profile" },
];

const USER_LINKS = [
  { href: "/user/upload", icon: "upload_file", label: "Submit Product" },
  { href: "/user/my-products", icon: "inventory_2", label: "My Products" },
  { href: "/user/quotes", icon: "request_quote", label: "Vendor Quotes" },
  { href: "/user/track", icon: "local_shipping", label: "Track Pickup" },
  { href: "/user/profile", icon: "person", label: "Profile" },
];

export default function Sidebar() {
  const { currentUser, logout, notifications, markNotificationRead, markAllNotificationsRead, isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, setIsSidebarCollapsed } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  if (!currentUser) return null;
  const role = currentUser.role;
  const isConsumer = role === "consumer" || role === "guest";

  const handleLogout = () => {
    logout();
    setIsSidebarOpen(false);
    router.push("/");
  };

  const renderLink = (link: any) => {
    const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
    const showIndicator = isActive && role === 'admin';

    return (
      <Link key={link.href} href={link.href}
        onClick={() => setIsSidebarOpen(false)}
        title={isSidebarCollapsed ? link.label : undefined}
        className={`nav-link group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
          isSidebarCollapsed ? 'justify-center' : ''
        } ${
          isActive
            ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light font-bold"
            : "text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
        }`}>
        <span className={`material-symbols-outlined text-xl transition-all shrink-0 ${isActive ? 'scale-110' : ''}`}
          style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
          {link.icon}
        </span>
        {!isSidebarCollapsed && (
          <>
            <span className="text-sm flex-1 truncate">{link.label}</span>
            {link.badge && (
              <span className="px-1.5 py-0.5 rounded-md bg-primary text-white text-[9px] font-black uppercase">
                {link.badge}
              </span>
            )}
          </>
        )}
        {showIndicator && !isSidebarCollapsed && (
          <div className="absolute right-0 w-1 h-5 bg-primary rounded-l-full" />
        )}
        {isActive && isSidebarCollapsed && (
          <div className="absolute left-0 w-1 h-5 bg-primary rounded-r-full" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] transition-opacity duration-300 lg:hidden ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={`sidebar shrink-0 fixed top-0 bottom-0 left-0 z-[101] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-900 transition-all duration-300 ease-out flex flex-col ${
        isSidebarCollapsed ? 'w-16' : 'w-[280px]'
      } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        {/* Logo */}
        <div className={`py-5 mb-2 border-b border-slate-100 dark:border-slate-900/50 flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'px-6 gap-3'}`}>
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center p-1 shadow-md border border-slate-200 dark:border-slate-700 shrink-0 dark:bg-slate-900">
            <img src="/logo%203.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          {!isSidebarCollapsed && (
            <div>
              <p className="font-headline font-black text-slate-900 dark:text-white text-base tracking-tight leading-none">WeConnect</p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold mt-1">E-Waste Aggregator</p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto pt-2 pb-4 px-2 custom-scrollbar">
          {/* Main Dashboard Link */}
          <div className="mb-4">
            {renderLink({ href: `/${role}/dashboard`, icon: "dashboard", label: "Dashboard" })}
          </div>

          {role === 'admin' ? (
            ADMIN_SECTIONS.map((section) => (
              <div key={section.title} className="mb-4 last:mb-0">
                {!isSidebarCollapsed && (
                  <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">
                    {section.title}
                  </p>
                )}
                {isSidebarCollapsed && (
                  <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 mb-2" />
                )}
                <div className="space-y-0.5">
                  {section.links.map(renderLink)}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-0.5">
              {(role === "vendor" ? VENDOR_LINKS : isConsumer ? CONSUMER_LINKS : role === "user" ? USER_LINKS : CLIENT_LINKS).map(renderLink)}
            </div>
          )}

          {role === 'admin' && !isSidebarCollapsed && <AiAssistantCard />}
        </div>

        {/* Collapse toggle + User profile footer */}
        <div className="mt-auto border-t border-slate-100 dark:border-slate-900/50">
          {/* Collapse button — desktop only */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`hidden lg:flex w-full items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all text-xs font-bold ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}>
              chevron_left
            </span>
            {!isSidebarCollapsed && <span>Collapse</span>}
          </button>

          {/* Notification panel (slides up inside sidebar) */}
          {notifOpen && !isSidebarCollapsed && (
            <div className="mx-3 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={markAllNotificationsRead} className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">notifications_none</span>
                    <p className="text-xs text-slate-400 font-bold">No notifications</p>
                  </div>
                ) : notifications.slice(0, 20).map(n => (
                  <div key={n.id} className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${n.read ? 'opacity-60' : ''}`}
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (n.link) { router.push(n.link); setNotifOpen(false); setIsSidebarOpen(false); }
                    }}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-slate-300' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{n.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User profile */}
          <div className="p-3">
            <div className={`flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-600 dark:text-slate-400 shrink-0">
                {currentUser.name[0]}
              </div>
              {!isSidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase truncate">{role}</p>
                  </div>
                  <button onClick={() => setNotifOpen(o => !o)} className="relative w-8 h-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">notifications</span>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <button onClick={handleLogout} className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 transition-colors flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
