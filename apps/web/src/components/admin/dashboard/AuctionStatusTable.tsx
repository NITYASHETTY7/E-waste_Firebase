"use client";

import React from "react";
import { motion } from "framer-motion";

const AUCTIONS = [
  { id: 'AUC-2024-001', title: 'Dell IT Assets Auction', status: 'Live', endDate: '24 May 2024, 04:00 PM', topBid: '₹12,45,000', participants: 7 },
  { id: 'AUC-2024-002', title: 'Corporate E-Waste Disposal', status: 'Live', endDate: '25 May 2024, 02:00 PM', topBid: '₹8,75,000', participants: 5 },
  { id: 'AUC-2024-003', title: 'Manufacturing Scrap Auction', status: 'Upcoming', endDate: '26 May 2024, 10:00 AM', topBid: '-', participants: 0 },
  { id: 'AUC-2024-004', title: 'Hospital Equipment Auction', status: 'Upcoming', endDate: '27 May 2024, 11:00 AM', topBid: '-', participants: 0 },
  { id: 'AUC-2024-005', title: 'IT Hardware Disposal', status: 'Closed', endDate: '22 May 2024, 01:00 PM', topBid: '₹15,20,000', participants: 9 },
];

const STATUS_STYLES: Record<string, string> = {
  Live: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'border border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Closed: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
};

export function AuctionStatusTable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">Auction Status</h3>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          All Auctions
          <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 pb-3 px-1">Auction ID</th>
              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 pb-3 px-1">Title</th>
              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 pb-3 px-1">Status</th>
              <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 pb-3 px-1">End Date</th>
              <th className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 pb-3 px-1">Top Bid</th>
              <th className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 pb-3 px-1">Participants</th>
            </tr>
          </thead>
          <tbody>
            {AUCTIONS.map((auction, idx) => (
              <motion.tr
                key={auction.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-emerald-950/30 transition-all group cursor-default"
              >
                <td className="py-3.5 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap group-hover:text-emerald-50">{auction.id}</td>
                <td className="py-3.5 px-1 text-[11px] font-bold text-slate-900 dark:text-white group-hover:text-white">{auction.title}</td>
                <td className="py-3.5 px-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${STATUS_STYLES[auction.status]} group-hover:bg-white/20 group-hover:text-white`}>
                    {auction.status === 'Live' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse group-hover:bg-white" />
                    )}
                    {auction.status}
                  </span>
                </td>
                <td className="py-3.5 px-1 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap group-hover:text-emerald-50">{auction.endDate}</td>
                <td className="py-3.5 px-1 text-[11px] font-bold text-slate-900 dark:text-white text-right group-hover:text-white">{auction.topBid}</td>
                <td className="py-3.5 px-1 text-[11px] text-slate-500 dark:text-slate-400 text-right group-hover:text-emerald-50">{auction.participants || '-'}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="mt-5 w-full h-9 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
        View All Auctions
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </motion.div>
  );
}
