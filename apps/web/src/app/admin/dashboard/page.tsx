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
  const liveAuctions = listings.filter(l => l.auctionPhase === 'live' || l.auctionPhase === 'sealed_bid');
  const completedListings = listings.filter(l => l.status === 'completed' || l.auctionPhase === 'completed');
  const acceptedBids = bids.filter(b => b.status === "accepted");
  const totalRevenue = acceptedBids.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/40 p-4 md:p-6 space-y-5 pb-24">

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-5">
        <KpiCard
          title="Total Revenue (MTD)"
          value={`₹${(totalRevenue / 100000).toFixed(1)}L`}
          icon="payments"
          variant="violet"
          delay={1}
          href="/admin/bidding"
        />
        <KpiCard
          title="Total Requests"
          value={listings.length}
          icon="inventory_2"
          variant="blue"
          delay={2}
          href="/admin/listings"
        />
        <KpiCard
          title="Active Auctions"
          value={liveAuctions.length}
          icon="sensors"
          variant="emerald"
          delay={3}
          href="/admin/auctions"
        />
        <KpiCard
          title="Completed Pickups"
          value={completedListings.length}
          icon="local_shipping"
          variant="amber"
          delay={4}
          href="/admin/reconciliation"
        />
        <KpiCard
          title="Total Vendors"
          value={vendors.length}
          icon="recycling"
          variant="teal"
          delay={5}
          href="/admin/vendors"
        />
      </div>

      {/* ── Rows 2 & 3: Main content ── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Left+Centre column (9 cols) */}
        <div className="col-span-12 lg:col-span-9 space-y-5">

          {/* Row 2: Overview chart + E-Waste donut */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 min-h-[320px]">
              <BusinessOverviewChart />
            </div>
            <div className="xl:col-span-5 min-h-[320px]">
              <EWasteCategoryChart />
            </div>
          </div>

          {/* Row 3: Auction table + Top vendors */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-8">
              <AuctionStatusTable />
            </div>
            <div className="xl:col-span-4">
              <TopPerformingVendors />
            </div>
          </div>
        </div>

        {/* Right column: Activity feed + Quick Actions (3 cols) */}
        <div className="col-span-12 lg:col-span-3 space-y-5 h-fit lg:sticky lg:top-[96px] z-20">
          <RealTimeActivityFeed />
          <QuickActionsGrid />
        </div>
      </div>

      {/* ── Row 4: AI Insights (Now full width for prominence) ── */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 min-h-[200px]">
          <AiInsightsCard />
        </div>
      </div>
    </div>
  );
}
