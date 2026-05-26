"use client";

import { useApp } from "@/context/AppContext";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useState, useEffect } from "react";
import { AiInsightsCard } from "@/components/admin/dashboard/AiInsightsCard";
import { QuickActionsGrid } from "@/components/admin/dashboard/QuickActionsGrid";
import { RealTimeActivityFeed } from "@/components/admin/dashboard/RealTimeActivityFeed";
import { AuctionStatusTable } from "@/components/admin/dashboard/AuctionStatusTable";
import { TopPerformingVendors } from "@/components/admin/dashboard/TopPerformingVendors";
import { BusinessOverviewChart } from "@/components/admin/dashboard/BusinessOverviewChart";
import { EWasteCategoryChart } from "@/components/admin/dashboard/EWasteCategoryChart";

export default function AdminDashboard() {
  const { users, listings, bids } = useApp();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  const vendors = users.filter(u => u.role === "vendor");
  const liveAuctions = listings.filter(l => l.auctionPhase === 'live');
  const completedListings = listings.filter(l => l.status === 'completed');
  const acceptedBids = bids.filter(b => b.status === "accepted");
  const totalRevenue = acceptedBids.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/40 p-4 md:p-6 space-y-5 pb-24">

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          title="Total Revenue (MTD)"
          value={`₹${(totalRevenue / 100000).toFixed(1)}L`}
          icon="payments"
          trend={{ value: 18.6, isPositive: true }}
          variant="violet"
          chartData={[{ v: 38 }, { v: 55 }, { v: 42 }, { v: 68 }, { v: 60 }, { v: 82 }, { v: 95 }]}
          delay={1}
        />
        <KpiCard
          title="Total Requests"
          value={listings.length}
          icon="inventory_2"
          trend={{ value: 12.4, isPositive: true }}
          variant="blue"
          chartData={[{ v: 30 }, { v: 45 }, { v: 35 }, { v: 58 }, { v: 50 }, { v: 70 }, { v: 80 }]}
          delay={2}
        />
        <KpiCard
          title="Active Auctions"
          value={liveAuctions.length}
          icon="sensors"
          trend={{ value: 5, isPositive: true }}
          variant="emerald"
          chartData={[{ v: 4 }, { v: 7 }, { v: 5 }, { v: 10 }, { v: 8 }, { v: 14 }, { v: 18 }]}
          delay={3}
        />
        <KpiCard
          title="Completed Pickups"
          value={completedListings.length}
          icon="local_shipping"
          trend={{ value: 23.7, isPositive: true }}
          variant="amber"
          chartData={[{ v: 18 }, { v: 32 }, { v: 25 }, { v: 48 }, { v: 55 }, { v: 72 }, { v: 89 }]}
          delay={4}
        />
        <KpiCard
          title="Total Vendors"
          value={vendors.length}
          icon="recycling"
          trend={{ value: 8, isPositive: true }}
          variant="teal"
          chartData={[{ v: 35 }, { v: 50 }, { v: 58 }, { v: 68 }, { v: 80 }, { v: 100 }, { v: 120 }]}
          delay={5}
        />
      </div>

      {/* ── Rows 2 & 3: Main content ── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Left+Centre column (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-5">

          {/* Row 2: Overview chart + E-Waste donut */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <div className="xl:col-span-3 min-h-[320px]">
              <BusinessOverviewChart />
            </div>
            <div className="xl:col-span-2 min-h-[320px]">
              <EWasteCategoryChart />
            </div>
          </div>

          {/* Row 3: Auction table + Top vendors */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <div className="xl:col-span-3">
              <AuctionStatusTable />
            </div>
            <div className="xl:col-span-2">
              <TopPerformingVendors />
            </div>
          </div>
        </div>

        {/* Right column: Activity feed spanning both rows */}
        <div className="col-span-12 lg:col-span-4 h-fit lg:sticky lg:top-[96px] z-20">
          <RealTimeActivityFeed />
        </div>
      </div>

      {/* ── Row 4: Quick Actions + AI Insights ── */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-5">
          <QuickActionsGrid />
        </div>
        <div className="col-span-12 lg:col-span-7 min-h-[200px]">
          <AiInsightsCard />
        </div>
      </div>
    </div>
  );
}
