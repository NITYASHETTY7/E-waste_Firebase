"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import Link from "next/link";
import { useApp } from "@/context/AppContext";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export function EWasteCategoryChart() {
  const { listings } = useApp();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line
  useEffect(() => { setMounted(true); }, []);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    let totalWeight = 0;

    listings.forEach(l => {
      const cat = l.category || 'Others';
      categories[cat] = (categories[cat] || 0) + (l.weight || 0);
      totalWeight += (l.weight || 0);
    });

    const data = Object.entries(categories).map(([name, value], i) => ({
      name,
      value: totalWeight > 0 ? Number(((value / totalWeight) * 100).toFixed(1)) : 0,
      weight: value,
      color: COLORS[i % COLORS.length]
    })).sort((a, b) => b.weight - a.weight);

    return { total: totalWeight, data };
  }, [listings]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">E-Waste by Category</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 flex-1 items-center justify-center sm:justify-start">
        {/* Donut Chart */}
        <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
          {mounted ? (
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={categoryData.data}
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
                  {categoryData.data.map((entry, i) => (
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
            <span className="text-base font-black text-slate-900 dark:text-white leading-none">{categoryData.total.toLocaleString()}</span>
            <span className="text-[8px] font-bold text-slate-400 mt-0.5">Total (Kg)</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1 min-w-0 w-full sm:w-auto pr-2">
          {categoryData.data.map(item => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex-1 truncate">{item.name}</span>
              <span className="text-[10px] font-black text-slate-900 dark:text-white whitespace-nowrap tabular-nums">{item.value}%</span>
            </div>
          ))}
          {categoryData.data.length === 0 && (
            <div className="text-center py-4 text-[10px] text-slate-400 italic">No data available</div>
          )}
        </div>
      </div>

      <Link href="/admin/reports" className="mt-4 w-full h-9 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
        View Full Report
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </motion.div>
  );
}
