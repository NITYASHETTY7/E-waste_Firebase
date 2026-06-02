"use client";

import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import Link from "next/link";

const FILTER_DATA: Record<string, { total: string; data: Array<{ name: string; value: number; color: string }> }> = {
  this_month: {
    total: "12,248",
    data: [
      { name: 'IT Equipment', value: 35.6, color: '#3b82f6' },
      { name: 'Electricals', value: 24.1, color: '#10b981' },
      { name: 'Batteries', value: 15.8, color: '#f59e0b' },
      { name: 'Metal Scrap', value: 12.7, color: '#ef4444' },
      { name: 'Others', value: 11.8, color: '#8b5cf6' },
    ]
  },
  last_month: {
    total: "10,850",
    data: [
      { name: 'IT Equipment', value: 32.1, color: '#3b82f6' },
      { name: 'Electricals', value: 26.4, color: '#10b981' },
      { name: 'Batteries', value: 18.2, color: '#f59e0b' },
      { name: 'Metal Scrap', value: 11.0, color: '#ef4444' },
      { name: 'Others', value: 12.3, color: '#8b5cf6' },
    ]
  },
  last_3_months: {
    total: "34,120",
    data: [
      { name: 'IT Equipment', value: 34.0, color: '#3b82f6' },
      { name: 'Electricals', value: 25.0, color: '#10b981' },
      { name: 'Batteries', value: 16.5, color: '#f59e0b' },
      { name: 'Metal Scrap', value: 13.0, color: '#ef4444' },
      { name: 'Others', value: 11.5, color: '#8b5cf6' },
    ]
  },
  last_year: {
    total: "145,680",
    data: [
      { name: 'IT Equipment', value: 36.5, color: '#3b82f6' },
      { name: 'Electricals', value: 23.2, color: '#10b981' },
      { name: 'Batteries', value: 14.8, color: '#f59e0b' },
      { name: 'Metal Scrap', value: 13.5, color: '#ef4444' },
      { name: 'Others', value: 12.0, color: '#8b5cf6' },
    ]
  }
};

export function EWasteCategoryChart() {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState("this_month");

  // eslint-disable-next-line
  useEffect(() => { setMounted(true); }, []);

  const activeSet = FILTER_DATA[filter] || FILTER_DATA.this_month;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">E-Waste by Category</h3>
        <div className="relative">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none flex items-center gap-1.5 pl-3 pr-8 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_year">Last Year</option>
          </select>
          <span className="material-symbols-outlined text-sm absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400">
            expand_more
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 flex-1 items-center justify-center sm:justify-start">
        {/* Donut Chart */}
        <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
          {mounted ? (
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={activeSet.data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={450}
                  animationDuration={1200}
                >
                  {activeSet.data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  wrapperStyle={{ opacity: 1, zIndex: 9999 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700/50 p-2.5 rounded-xl shadow-xl flex items-center gap-2 opacity-100 bg-opacity-100">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                          <span className="text-xs font-bold text-white">{data.name}:</span>
                          <span className="text-xs font-black text-emerald-400">{payload[0].value}%</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ width: 120, height: 120 }} />}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-base font-black text-slate-900 dark:text-white leading-none">{activeSet.total}</span>
            <span className="text-[8px] font-bold text-slate-400 mt-0.5">Total (Kg)</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1 min-w-0 w-full sm:w-auto pr-2">
          {activeSet.data.map(item => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex-1 truncate">{item.name}</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-white whitespace-nowrap tabular-nums">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <Link href="/admin/reports" className="mt-4 w-full h-9 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
        View Full Report
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </motion.div>
  );
}
