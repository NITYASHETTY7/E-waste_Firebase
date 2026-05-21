"use client";

import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const BUSINESS_DATA = [
  { date: '01 May', revenue: 45, requests: 28, pickups: 18 },
  { date: '05 May', revenue: 68, requests: 42, pickups: 32 },
  { date: '10 May', revenue: 82, requests: 58, pickups: 45 },
  { date: '15 May', revenue: 120, requests: 73, pickups: 58 },
  { date: '20 May', revenue: 165, requests: 89, pickups: 72 },
  { date: '25 May', revenue: 215, requests: 108, pickups: 85 },
  { date: '31 May', revenue: 246, requests: 124, pickups: 89 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 shadow-xl">
      <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs font-bold mb-0.5" style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? `₹${p.value}K` : p.value}
        </p>
      ))}
    </div>
  );
};

const SERIES = [
  { key: 'revenue', color: '#8b5cf6', label: 'Revenue (₹)' },
  { key: 'requests', color: '#3b82f6', label: 'Requests' },
  { key: 'pickups', color: '#10b981', label: 'Pickups' },
];

const STATS = [
  { label: 'Revenue', value: '₹2,45,80,000', trend: '+18.8%' },
  { label: 'Requests', value: '1,248', trend: '+12.4%' },
  { label: 'Pickups', value: '892', trend: '+23.7%' },
  { label: 'Conversion Rate', value: '71.5%', trend: '+8.3%' },
];

export function BusinessOverviewChart() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line
  useEffect(() => { setMounted(true); }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">Business Overview</h3>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <span className="material-symbols-outlined text-sm">calendar_month</span>
          This Month
          <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
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
            <LineChart data={BUSINESS_DATA} margin={{ top: 5, right: 5, left: -32, bottom: 0 }}>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
        {STATS.map(stat => (
          <div key={stat.label}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{stat.label}</p>
            <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{stat.value}</p>
            <p className="text-[10px] font-bold text-emerald-500 mt-0.5">{stat.trend}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
