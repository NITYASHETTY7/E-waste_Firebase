"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { useApp } from "@/context/AppContext";

const SERIES = [
  { key: 'revenue', color: '#8b5cf6', label: 'Revenue (₹)' },
  { key: 'requests', color: '#3b82f6', label: 'Requests' },
  { key: 'pickups', color: '#10b981', label: 'Pickups' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 shadow-xl">
      <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs font-bold mb-0.5" style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? `₹${(p.value * 1000).toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  );
};

export function BusinessOverviewChart() {
  const { bids, listings } = useApp();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line
  useEffect(() => { setMounted(true); }, []);

  const businessData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    return months.map((m, i) => {
      const monthBids = bids.filter(b => {
        const d = new Date(b.createdAt);
        return d.getMonth() === i && d.getFullYear() === currentYear && b.status === 'accepted';
      });
      
      const monthListings = listings.filter(l => {
        const d = new Date(l.createdAt);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      });

      const monthPickups = listings.filter(l => {
        const d = new Date(l.createdAt);
        return d.getMonth() === i && d.getFullYear() === currentYear && (l.status === 'completed' || l.auctionPhase === 'completed');
      });

      return {
        date: m,
        revenue: monthBids.reduce((sum, b) => sum + b.amount, 0) / 1000, // In K for chart scaling
        requests: monthListings.length,
        pickups: monthPickups.length
      };
    });
  }, [bids, listings]);

  const stats = useMemo(() => {
    const acceptedBids = bids.filter(b => b.status === 'accepted');
    const totalRevenue = acceptedBids.reduce((sum, b) => sum + b.amount, 0);
    const completed = listings.filter(l => (l.status === 'completed' || l.auctionPhase === 'completed')).length;
    const convRate = listings.length > 0 ? (completed / listings.length * 100).toFixed(1) : "0";

    return [
      { label: 'Revenue', value: `₹${totalRevenue.toLocaleString()}` },
      { label: 'Requests', value: listings.length.toString() },
      { label: 'Pickups', value: completed.toString() },
      { label: 'Conversion Rate', value: `${convRate}%` },
    ];
  }, [bids, listings]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">Business Overview</h3>
      </div>

      <div className="flex gap-3 mb-4">
        {SERIES.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-[160px]">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={businessData} margin={{ top: 5, right: 5, left: -32, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.08)" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 600, fill: '#94A3B8' }}
                dy={8}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94A3B8' }} />
              <Tooltip content={<CustomTooltip />} />
              {SERIES.map(s => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                  stroke={s.color} strokeWidth={2.5} dot={false}
                  animationDuration={1500}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4 gap-4 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
        {stats.map(stat => (
          <div key={stat.label}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{stat.label}</p>
            <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{stat.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
