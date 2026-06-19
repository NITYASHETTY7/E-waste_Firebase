"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useApp } from "@/context/AppContext";

const RANK_BADGE = [
  'bg-yellow-400 text-yellow-900',
  'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200',
  'bg-orange-300 text-orange-900',
];

function ScoreRing({ score }: { score: number }) {
  const size = 38;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 97 ? '#10b981' : score >= 93 ? '#3b82f6' : '#f59e0b';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[9px] font-black text-slate-900 dark:text-white">{score}%</span>
    </div>
  );
}

export function TopPerformingVendors() {
  const { users, bids, vendorRatings } = useApp();

  const topVendors = useMemo(() => {
    const vendors = users.filter(u => u.role === 'vendor');
    const vendorStats = vendors.map(v => {
      const vendorBids = bids.filter(b => b.vendorId === v.id && b.status === 'accepted');
      const totalRevenue = vendorBids.reduce((sum, b) => sum + b.amount, 0);
      const ratings = (vendorRatings || []).filter(r => r.vendorId === v.id);
      const score = ratings.length > 0 
        ? Math.round((ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length) * 20)
        : (v.rating ? v.rating * 20 : 0);
      return {
        id: v.id,
        name: v.name,
        initial: v.name.charAt(0),
        revenue: totalRevenue,
        score,
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return vendorStats.map((v, i) => ({ ...v, rank: i + 1 }));
  }, [users, bids]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">Top Performing Vendors</h3>
      </div>

      <div className="flex-1 space-y-1.5">
        {topVendors.map((vendor, idx) => (
          <motion.div
            key={vendor.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + idx * 0.07 }}
            className="flex items-center gap-2.5 p-2 rounded-2xl hover:bg-emerald-950/30 transition-all group cursor-default"
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black shrink-0 ${
              idx < 3 ? RANK_BADGE[idx] : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            } group-hover:bg-white/20 group-hover:text-white`}>
              {vendor.rank}
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center font-black text-emerald-600 dark:text-emerald-400 text-xs shrink-0 group-hover:bg-white group-hover:text-emerald-600">
              {vendor.initial}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate leading-tight group-hover:text-white" title={vendor.name}>{vendor.name}</p>
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 group-hover:text-emerald-50">₹{vendor.revenue.toLocaleString()}</p>
            </div>
            <div className="shrink-0 scale-[0.85] origin-right group-hover:invert group-hover:brightness-200">
              <ScoreRing score={vendor.score} />
            </div>
          </motion.div>
        ))}
        {topVendors.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400 italic">No vendor data available</div>
        )}
      </div>

      <Link href="/admin/vendors" className="mt-4 w-full h-9 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
        View All Vendors
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </motion.div>
  );
}
