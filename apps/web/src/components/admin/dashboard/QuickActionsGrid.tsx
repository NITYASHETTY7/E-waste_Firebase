"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const QUICK_ACTIONS = [
  { id: '1', title: 'Add Client', icon: 'person_add', color: 'emerald', route: '/admin/users' },
  { id: '2', title: 'Add Vendor', icon: 'recycling', color: 'emerald', route: '/admin/vendors' },
  { id: '3', title: 'Create Request', icon: 'add_circle', color: 'emerald', route: '/admin/listings' },
  { id: '4', title: 'Create Auction', icon: 'gavel', color: 'rose', route: '/admin/auctions' },
  { id: '5', title: 'Upload Document', icon: 'upload_file', color: 'blue', route: '/admin/documents' },
  { id: '6', title: 'Generate Report', icon: 'description', color: 'blue', route: '/admin/reports' },
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
      className="p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"
    >
      <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base mb-4">Quick Actions</h3>
      <div className="grid grid-cols-4 gap-1.5">
        {QUICK_ACTIONS.map((action, idx) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 + idx * 0.04 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(action.route)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-2xl ${COLOR_MAP[action.color]} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{action.icon}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 text-center leading-tight">{action.title}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
