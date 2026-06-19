"use client";

import { ActivityTable } from "@/components/dashboard/ActivityTable";
import { InteractiveDonutChart, InteractiveLineChart } from "@/components/dashboard/Charts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useApp } from "@/context/AppContext";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function VendorDashboard() {
  const { bids, listings, currentUser } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const myBids = bids.filter(b => {
    const bVendorId = b.vendorId || b.vendor?.id;
    const bCompanyId = b.vendor?.companyId;
    const cUserId = currentUser?.id;
    const cCompanyId = currentUser?.companyId;

    return (
      (bVendorId && cUserId && bVendorId === cUserId) ||
      (bCompanyId && cCompanyId && bCompanyId === cCompanyId) ||
      (bVendorId && cCompanyId && bVendorId === cCompanyId)
    );
  });
  const wonBids = myBids.filter(b => b.status === "accepted" || (b.status as any) === "won");
  const activeListings = listings.filter(l => l.auctionPhase === "live" || l.auctionPhase === "sealed_bid");
  const winRate = myBids.length > 0 ? Math.round((wonBids.length / myBids.length) * 100) : 0;
  const totalCommitted = myBids.reduce((sum, b) => sum + (b.amount || 0), 0);

  // Dynamic Chart Data
  const getMonthlyVolume = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, i) => {
      const volume = myBids
        .filter(b => b.createdAt && new Date(b.createdAt).getMonth() === i)
        .reduce((sum, b) => sum + (b.amount || 0), 0);
      
      return { name: m, value: volume };
    });
  };

  const getWeeklyVolume = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d, i) => {
      const volume = myBids
        .filter(b => b.createdAt && new Date(b.createdAt).getDay() === (i + 1) % 7)
        .reduce((sum, b) => sum + (b.amount || 0), 0);
      
      return { name: d, value: volume };
    });
  };

  const tableItems = myBids.slice(0, 5).sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map(b => {
    const listing = listings.find(l => l.id === b.listingId || l.auctionId === b.auctionId);
    return {
      id: b.id,
      user: {
        name: listing?.title || "Unknown Lot",
        phone: listing?.location || "India",
      },
      auctions: 1,
      amount: `₹${(b.amount || 0).toLocaleString()}`
    };
  });

  if (!mounted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="dashboard-container space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {currentUser?.isLocked && (
        <div className="bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-0.5 text-2xl shrink-0">lock</span>
            <div>
              <h4 className="text-sm font-black text-red-800 dark:text-red-200 uppercase tracking-wide">Account Locked</h4>
              <p className="text-xs text-red-700 dark:text-red-400/80 mt-1">Your company account has been restricted by an administrator. Reason: <span className="font-bold">{currentUser.lockReason || "Please contact support for verification."}</span></p>
            </div>
          </div>
          <Link href="/vendor/help" className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl uppercase tracking-wider shrink-0" style={{ color: 'white' }}>
            Get Help
          </Link>
        </div>
      )}

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
      >
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Vendor <span className="text-blue-600 dark:text-blue-500">Terminal</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Performance metrics for <span className="text-slate-900 dark:text-white font-bold">{currentUser?.name}</span></p>
        </div>
        <div className="flex gap-3">
          {!currentUser?.isLocked && (
            <Link href="/vendor/marketplace" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200/20 dark:shadow-blue-900/50" style={{ color: 'white' }}>
              <span className="material-symbols-outlined text-lg">storefront</span>
              Browse Marketplace
            </Link>
          )}
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Auctions Participated" value={myBids.length} icon="gavel" delay={0.1} trend={{ value: 10, isPositive: true }} />
        <KpiCard title="Total Bidding Value" value={`₹${(totalCommitted / 1000).toFixed(1)}k`} icon="payments" delay={0.2} />
        <KpiCard title="Winning Pledges" value={wonBids.length} icon="emoji_events" delay={0.3} trend={{ value: 5, isPositive: true }} />
        <KpiCard title="Market Win Rate" value={`${winRate}%`} icon="monitoring" delay={0.4} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Bidding Activity */}
        <div className="lg:col-span-8 space-y-6">
          <InteractiveLineChart 
            title="Bidding Volume Trend" 
            subtitle="Participation over time" 
            data={getMonthlyVolume()}
            weeklyData={getWeeklyVolume()}
          />
          
          <ActivityTable title="Recent Bidding History" items={tableItems} />
        </div>

        {/* Right Column: Win Ratio & Live Lots */}
        <div className="lg:col-span-4 space-y-6">
          <InteractiveDonutChart title="Win/Loss Ratio" percentage={winRate} color="#0B5ED7" label1="Won" label2="Pending/Lost" />

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-950 p-8 rounded-3xl text-white relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full -mr-16 -mt-16 blur-[80px] opacity-40" />
            <h3 className="text-xl font-bold mb-4 relative z-10 text-white">Available Now</h3>
            
            {currentUser?.isLocked ? (
              <div className="relative z-10 py-6 text-center space-y-3">
                <span className="material-symbols-outlined text-4xl text-red-500 block">lock_open</span>
                <p className="text-xs text-slate-300">Marketplace is restricted while your account is locked. Please resolve any pending compliance tasks or penalties.</p>
              </div>
            ) : (
              <>
                <p className="text-slate-300 text-sm mb-6 relative z-10">There are <span className="text-white font-bold">{activeListings.length}</span> active lots waiting for your bid.</p>
                
                <div className="space-y-3 relative z-10">
                  {activeListings.slice(0, 3).map((l) => (
                    <Link key={l.id} href={`/vendor/marketplace/${l.id}`} className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-all group/item">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate group-hover/item:text-blue-400 transition-colors">{l.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-blue-400 uppercase font-black tracking-wider">{l.auctionPhase?.replace('_', ' ')}</span>
                          <span className="text-[8px] text-slate-500">•</span>
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">{l.weight} KG · {(l.location || 'India').split(' ')[0]}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-sm text-slate-400 group-hover/item:text-blue-400 transition-colors">chevron_right</span>
                    </Link>
                  ))}
                </div>
                
                <Link href="/vendor/marketplace" className="mt-6 block text-center text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors hover:underline underline-offset-4">
                  View All Marketplace
                </Link>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
