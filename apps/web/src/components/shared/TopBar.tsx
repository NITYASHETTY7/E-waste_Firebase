"use client";

import { useApp } from "@/context/AppContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Master Dashboard",
  "/admin/vendors": "Vendor Management",
  "/admin/users": "Client Management",
  "/admin/listings": "Listing Control",
  "/admin/transactions": "Transactions",
  "/admin/reports": "Reports",
  "/admin/settings": "Settings",
  "/vendor/dashboard": "Dashboard",
  "/vendor/marketplace": "E-Waste Listings",
  "/vendor/live-auction": "Live Auction",
  "/vendor/bids": "Bidding & Transactions",
  "/vendor/pickups": "Logistics Schedule",
  "/vendor/analytics": "Analytics",
  "/vendor/profile": "Profile & Documents",
  "/client/dashboard": "Dashboard",
  "/client/post": "Post E-Waste",
  "/client/listings": "My Listings",
  "/client/live-auction": "Live Auction",
  "/client/bids": "Bids Received",
  "/client/notifications": "Notifications",
  "/client/profile": "My Profile",
};

export default function TopBar() {
  const { 
    currentUser, 
    notifications, 
    setIsSidebarOpen, 
    isSidebarCollapsed, 
    setIsSidebarCollapsed, 
    logout, 
    deleteAccount,
    markNotificationRead,
    markAllNotificationsRead 
  } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const title = PAGE_TITLES[pathname] || "We Connect";
  const userNotifications = (notifications || []).filter(n => n.userId === currentUser?.id);
  const unread = userNotifications.filter(n => !n.read).length;
  const role = currentUser?.role || "client";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/get-started");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      router.push("/get-started");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
      setMenuOpen(false);
    }
  };

  const profileHref = role === "admin" ? "/admin/settings" : role === "vendor" ? "/vendor/profile" : "/client/profile";

  return (
    <header className="h-20 flex items-center justify-between px-4 md:px-8 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors duration-300">
      <div className="flex items-center gap-6 flex-1">
        {/* Mobile: open sidebar */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
          aria-label="Toggle Menu"
          title="Open Menu"
        >
          <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">menu</span>
        </button>
        {/* Desktop: collapse sidebar */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:flex w-10 h-10 rounded-xl items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
          aria-label="Toggle Sidebar"
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <span className={`material-symbols-outlined text-slate-500 group-hover:text-primary transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}>
            menu_open
          </span>
        </button>

        {/* Dynamic Title / Welcome */}
        <div className="hidden sm:block">
          <h1 className="text-xl font-headline font-bold text-slate-900 dark:text-white leading-tight">
            {pathname === '/admin/dashboard' ? "Welcome back, Admin! 👋" : title}
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            {role === 'admin' ? "Here's what's happening with your e-waste marketplace today." : "Manage your e-waste cycle effectively."}
          </p>
        </div>
        </div>
      <div className="flex items-center gap-2 md:gap-4">
        {/* Quick Add - Only for Clients */}
        {role === "client" && role !== "admin" && (
          <button 
            onClick={() => router.push('/client/post')}
            className="hidden sm:flex w-10 h-10 rounded-2xl bg-primary text-white items-center justify-center hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all" 
            title="Post E-Waste"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button 
            onClick={() => setNotifOpen(o => !o)}
            className="relative w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all group" 
            title={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          >
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-xl group-hover:rotate-12 transition-transform">notifications</span>
            {unread > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 border-2 border-white dark:border-slate-800 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Notifications</p>
                {unread > 0 && (
                  <button 
                    onClick={markAllNotificationsRead} 
                    className="text-[10px] font-black text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-wider transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50 custom-scrollbar">
                {userNotifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block mb-1">notifications_none</span>
                    <p className="text-xs text-slate-450 dark:text-slate-550 font-bold">No notifications</p>
                  </div>
                ) : (
                  userNotifications.slice(0, 20).map(n => (
                    <div 
                      key={n.id} 
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-emerald-950/30 transition-all group ${n.read ? 'opacity-60 hover:opacity-100' : ''}`}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.link) { 
                          router.push(n.link); 
                        }
                        setNotifOpen(false);
                      }}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-slate-300 dark:bg-slate-700' : 'bg-blue-500'} group-hover:bg-white`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight group-hover:text-white">{n.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-snug group-hover:text-emerald-50">{n.message}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 group-hover:text-emerald-100">
                          {new Date(n.createdAt).toLocaleDateString('en-IN', { 
                            day: '2-digit', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div ref={menuRef} className="relative flex items-center gap-3 pl-2 md:pl-4 border-l border-slate-200 dark:border-slate-800 h-10 ml-2">
          <button
            onClick={() => { setMenuOpen(o => !o); setConfirmDelete(false); }}
            className="flex items-center gap-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 -mx-2 -my-1 transition-colors"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center font-black text-sm text-white shadow-md">
              {(currentUser?.name || "U")[0]}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-0.5">
                {currentUser?.name || "Admin"}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                {role === 'admin' ? 'Super Admin' : role}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-base hidden lg:block">expand_more</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-14 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser?.email}</p>
              </div>
              <div className="p-2">
                <Link
                  href={profileHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-950/30 hover:text-white transition-all group"
                >
                  <span className="material-symbols-outlined text-base text-slate-500 group-hover:text-white">manage_accounts</span>
                  My Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-950/30 hover:text-white transition-all group"
                >
                  <span className="material-symbols-outlined text-base text-slate-500 group-hover:text-white">logout</span>
                  Sign Out
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                    Delete Account
                  </button>
                ) : (
                  <div className="px-3 py-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">This is permanent. Are you sure?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
