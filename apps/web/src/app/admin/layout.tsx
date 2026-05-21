"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import Sidebar from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isSidebarCollapsed, isInitialized } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialized) return;
    if (pathname !== "/admin") {
      if (!currentUser || currentUser.role !== "admin") {
        router.push("/admin");
      }
    }
  }, [currentUser, router, pathname, isInitialized]);

  if (!isInitialized) return null;
  if (pathname === "/admin") return <>{children}</>;
  if (!currentUser || currentUser.role !== "admin") return null;

  return (
    <div className="flex min-h-screen bg-[color:var(--color-dashboard-bg)]">
      <Sidebar />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-[280px]'
      }`}>
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
