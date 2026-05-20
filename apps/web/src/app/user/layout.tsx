"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import Sidebar from "@/components/shared/Sidebar";
import TopBar from "@/components/shared/TopBar";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isSidebarCollapsed } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push("/user-login");
    } else if (currentUser.role !== "user") {
      router.push("/");
    }
  }, [currentUser, router]);

  if (!currentUser || currentUser.role !== "user") return null;

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
