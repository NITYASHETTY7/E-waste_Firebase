"use client";

import React from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import Link from "next/link";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: { value: number; isPositive: boolean };
  chartData?: { v: number }[];
  delay?: number;
  variant?: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'teal';
  href?: string;
}

const VARIANT_CONFIG = {
  emerald: { stroke: '#10b981', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  blue:    { stroke: '#3b82f6', text: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-500/10' },
  amber:   { stroke: '#f59e0b', text: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10' },
  rose:    { stroke: '#ef4444', text: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-500/10' },
  violet:  { stroke: '#8b5cf6', text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
  teal:    { stroke: '#14b8a6', text: 'text-teal-600 dark:text-teal-400',    bg: 'bg-teal-50 dark:bg-teal-500/10' },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title, value, icon, trend, chartData, delay = 0, variant = 'emerald', href
}) => {
  const cfg = VARIANT_CONFIG[variant];
  const defaultData = [{ v: 30 }, { v: 45 }, { v: 28 }, { v: 60 }, { v: 48 }, { v: 75 }, { v: 82 }];
  const data = chartData || defaultData;

  const Content = (
    <div className="relative z-10">
      {/* Top: icon + trend */}
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-2xl ${cfg.bg}`}>
          <span className={`material-symbols-outlined text-xl ${cfg.text}`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black tracking-wider ${
            trend.isPositive
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}>
            <span className="material-symbols-outlined text-[13px]">
              {trend.isPositive ? 'trending_up' : 'trending_down'}
            </span>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </div>
        )}
      </div>

      {/* Value + label */}
      <p className="text-2xl font-headline font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">
        {value}
      </p>
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
        {title}
      </p>

      {/* Sparkline */}
      <div className="mt-4 h-12 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${variant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cfg.stroke} stopOpacity={0.25} />
                <stop offset="95%" stopColor={cfg.stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="v"
              stroke={cfg.stroke} strokeWidth={2}
              fillOpacity={1} fill={`url(#grad-${variant})`}
              isAnimationActive dot={false}
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const wrapperClass = "relative group p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/40 transition-all duration-500 overflow-hidden block h-full";

  if (href) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay * 0.08 }}
      >
        <Link href={href} className={wrapperClass}>
          {Content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.08 }}
      className={wrapperClass + " cursor-default"}
    >
      {Content}
    </motion.div>
  );
};
