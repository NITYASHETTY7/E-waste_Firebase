"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const QUICK_ACTIONS = [
  { id: '1', title: 'Clients', icon: 'group', color: 'emerald', route: '/admin/users' },
  { id: '2', title: 'Vendors', icon: 'recycling', color: 'emerald', route: '/admin/vendors' },
  { id: '5', title: 'Requests', icon: 'inventory_2', color: 'rose', route: '/admin/listings' },
  { id: '6', title: 'Auctions', icon: 'gavel', color: 'rose', route: '/admin/auctions' },
  { id: '7', title: 'Payments', icon: 'payments', color: 'blue', route: '/admin/payments' },
  { id: '8', title: 'Reports', icon: 'analytics', color: 'amber', route: '/admin/reports' },
];

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function QuickActionsGrid() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm h-full"
    >
      <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action, idx) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 + idx * 0.04 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(action.route)}
            className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-100/50 dark:border-slate-800/50 transition-all group cursor-pointer"
          >
            <div className={`w-9 h-9 rounded-xl ${COLOR_MAP[action.color]} flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shrink-0`}>
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{action.icon}</span>
            </div>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-tight">{action.title}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
