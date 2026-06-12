"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useRouter } from "next/navigation";

export function AiInsightsCard() {
  const { bids, listings } = useApp();
  const router = useRouter();

  const totalRevenue = useMemo(() => {
    return bids.filter(b => b.status === 'accepted').reduce((sum, b) => sum + b.amount, 0);        
  }, [bids]);

  const bestCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    listings.forEach(l => {
      categories[l.category] = (categories[l.category] || 0) + (l.weight || 0);
    });
    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "N/A";
  }, [listings]);

  const highestBid = useMemo(() => {
    const sorted = [...bids].sort((a, b) => b.amount - a.amount);
    return sorted.length > 0 ? sorted[0] : null;
  }, [bids]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="p-4 sm:p-5 lg:p-4 xl:p-6 rounded-[2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/30 shadow-2xl relative overflow-hidden h-full"
    >
      <div className="absolute top-0 right-1/3 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-white font-headline font-bold text-base">Dashboard Insights</h3>   
          </div>
          <p className="text-white/40 text-[11px] leading-relaxed mb-4">Real-time data insights for your operations</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2.5 flex-1">
          {/* Total Revenue */}
          <div className="p-3 sm:p-4 lg:p-3 xl:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/8 transition-colors flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Total Revenue</p>
              <p className="text-white font-headline font-black text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg leading-none whitespace-nowrap">₹{totalRevenue.toLocaleString()}</p>       
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="material-symbols-outlined text-emerald-400 text-sm">payments</span> 
              <span className="text-white/30 text-[10px] ml-1">Total realized</span>
            </div>
          </div>

          {/* Best Category */}
          <div className="p-3 sm:p-4 lg:p-3 xl:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/8 transition-colors flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Top Category</p>
              <p className="text-white font-headline font-black text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg leading-none">{bestCategory}</p>
            </div>
            <p className="text-white/30 text-[10px] font-bold mt-2">By volume (Kg)</p>
          </div>

          {/* Highest Bid */}
          <div className="p-3 sm:p-4 lg:p-3 xl:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/8 transition-colors flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Highest Bid Recorded</p>
              <p className="text-white font-headline font-black text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg leading-none">{highestBid ? `₹${highestBid.amount.toLocaleString()}` : 'N/A'}</p>
            </div>
            <p className="text-white/30 text-[10px] font-bold mt-2">{highestBid?.vendorName || 'No bids yet'}</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/admin/analytics-hub')}
          className="mt-4 flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-indigo-600/25 w-fit"
        >
          <span className="material-symbols-outlined text-sm">insights</span>
          Analytics Hub
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </motion.div>
  );
}