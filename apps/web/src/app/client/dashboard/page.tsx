"use client";

import { useApp } from "@/context/AppContext";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { InteractiveLineChart, InteractiveDonutChart } from "@/components/dashboard/Charts";
import { ActivityTable } from "@/components/dashboard/ActivityTable";
import { StatusStepper, DealStage } from "@/components/StatusStepper";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Listing } from "@/types";

export default function ClientDashboard() {
  const { listings, bids, currentUser } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDemo = currentUser?.email === 'client@weconnect.com';

  const myListings = listings.filter(l => l.userId === currentUser?.id || (l.userId === currentUser?.companyId && currentUser?.companyId));
  const activeListings = myListings.filter(l => 
    (l.status === "active" || 
     l.auctionPhase === "live" || 
     l.auctionPhase === "sealed_bid" ||
     l.requirementStatus === "client_review") &&
    l.auctionPhase !== "completed" &&
    l.status !== "completed"
  ).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  const completedListings = myListings.filter(l => l.status === "completed" || l.auctionPhase === "completed");

  const getListingLink = (l: Listing) => {
    if (l.auctionPhase === "completed") return `/client/handover`;
    return `/client/listings/${l.id}`;
  };

  const myBids = bids.filter(b => myListings.some(l => l.id === b.listingId));
  const acceptedBids = myBids.filter(b => b.status === "accepted");
  const revenueGenerated = acceptedBids.reduce((sum, b) => sum + b.amount, 0);

  // Determine global stage based on the most advanced listing
  let globalStage: DealStage = "onboarded";
  if (myListings.length > 0) globalStage = "requirement_finalized";
  if (myListings.some(l => l.status === "active")) globalStage = "audit";
  if (myListings.some(l => l.auctionPhase === "sealed_bid")) globalStage = "sealed_bid";
  if (myListings.some(l => l.auctionPhase === "live")) globalStage = "auction";
  if (myListings.some(l => l.finalQuoteStatus === "approved")) globalStage = "finalized";
  if (myListings.some(l => l.paymentStatus === "confirmed")) globalStage = "payment";
  if (myListings.some(l => l.complianceStatus === "verified")) globalStage = "completed";

  // Dynamic Chart Data
  const getMonthlyRevenue = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, i) => {
      const volume = acceptedBids
        .filter(b => new Date(b.createdAt).getMonth() === i)
        .reduce((sum, b) => sum + b.amount, 0);
      
      const fallback = isDemo && i < 4 ? 20000 + i * 5000 : 0;
      return { name: m, value: volume || fallback }; 
    });
  };

  const getWeeklyRevenue = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => {
      const volume = acceptedBids
        .filter(b => new Date(b.createdAt).getDay() === (i + 1) % 7)
        .reduce((sum, b) => sum + b.amount, 0);
      
      const fallback = isDemo ? (2000 + i * 800) : 0;
      return { name: d, value: volume || fallback };
    });
  };

  const tableItems = myBids.slice(0, 5).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(b => ({
    id: b.id,
    user: {
      name: b.vendorName || 'Unknown Vendor',
      phone: "Verified Recycler",
    },
    auctions: 1,
    amount: `₹${b.amount.toLocaleString()}`
  }));

  if (!mounted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="dashboard-container space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
      >
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Client <span className="text-emerald-600 dark:text-emerald-500">Portal</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Managing disposal for <span className="text-slate-900 dark:text-white font-bold">{currentUser?.name}</span></p>
        </div>
        <div className="flex gap-3">
          <Link href="/client/post" className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200/20 dark:shadow-emerald-900/50" style={{ color: 'white' }}>
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Post New Scrap
          </Link>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Lots Posted" value={myListings.length} icon="inventory_2" delay={0.1} href="/client/listings" />
        <KpiCard title="Revenue Realized" value={`₹${(revenueGenerated / 1000).toFixed(1)}k`} icon="payments" delay={0.2} href="/client/bids" />
        <KpiCard title="Active Auctions" value={activeListings.length} icon="gavel" delay={0.3} href="/client/live-auction" />
        <KpiCard title="Success Rate" value={`${myListings.length > 0 ? Math.round((completedListings.length / myListings.length) * 100) : 0}%`} icon="verified" delay={0.4} href="/client/reports" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Charts & Activity */}
        <div className="lg:col-span-8 space-y-6">
          <InteractiveLineChart 
            title="Revenue Generation Trend" 
            subtitle="Earnings over time" 
            data={getMonthlyRevenue()}
            weeklyData={getWeeklyRevenue()}
          />
          
          <ActivityTable title="Recent Bids Received" items={tableItems} />
        </div>

        {/* Right Column: Quick Stats & Actions */}
        <div className="lg:col-span-4 space-y-6">
          <InteractiveDonutChart title="Lot Disposition" percentage={myListings.length > 0 ? Math.round((completedListings.length / myListings.length) * 100) : 0} label1="Completed" label2="Pending" />

          <div className="bg-slate-900 p-8 rounded-3xl text-white relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full -mr-16 -mt-16 blur-[80px] opacity-20" />
            <h3 className="text-xl font-bold mb-4 relative z-10 text-white">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {[
                { label: "Compliance", icon: "verified_user", href: "/client/reports" },
                { label: "Pickups", icon: "local_shipping", href: "/client/handover" },
                { label: "Documents", icon: "description", href: "/client/documents" },
                { label: "Profile", icon: "corporate_fare", href: "/client/profile" },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group/item">
                  <span className="material-symbols-outlined text-emerald-400 mb-2 group-hover/item:scale-110 transition-transform">{action.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="dashboard-card p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Active Lot Status</h3>
            <div className="space-y-4">
              {activeListings.slice(0, 3).map(listing => (
                <Link key={listing.id} href={getListingLink(listing)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-950/20 group">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 group-hover:text-emerald-500">inventory</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{listing.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">{listing.auctionPhase?.replace('_', ' ') || listing.status}</p>
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-500 group-hover:translate-x-1 transition-transform">
                    <span className="material-symbols-outlined text-sm">arrow_forward_ios</span>
                  </div>
                </Link>
              ))}
              {activeListings.length === 0 && (
                <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm italic">No active lots</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
