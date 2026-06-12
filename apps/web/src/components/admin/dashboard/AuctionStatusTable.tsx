"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useApp } from "@/context/AppContext";

const STATUS_STYLES: Record<string, string> = {
  live: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  invitation_window: 'border border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  sealed_bid: 'border border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  pending: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const fmtStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function AuctionStatusTable() {
  const { listings, bids } = useApp();

  const auctions = useMemo(() => {
    return listings.map(l => {
      const listingBids = bids.filter(b => b.listingId === l.id);
      const topBid = listingBids.length > 0 ? Math.max(...listingBids.map(b => b.amount)) : 0;
      
      return {
        id: l.id,
        title: l.title,
        status: l.auctionPhase || 'pending',
        endDate: l.auctionEndDate ? new Date(l.auctionEndDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
        topBid: topBid > 0 ? `₹${topBid.toLocaleString()}` : '—',
        participants: new Set(listingBids.map(b => b.vendorId)).size
      };
    }).slice(0, 5);
  }, [listings, bids]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">Auction Status</h3>
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
            {auctions.map((auction, idx) => (
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
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${STATUS_STYLES[auction.status] || STATUS_STYLES.pending} group-hover:bg-white/20 group-hover:text-white`}>
                    {auction.status === 'live' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse group-hover:bg-white" />
                    )}
                    {fmtStatus(auction.status)}
                  </span>
                </td>
                <td className="py-3.5 px-1 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap group-hover:text-emerald-50">{auction.endDate}</td>
                <td className="py-3.5 px-1 text-[11px] font-bold text-slate-900 dark:text-white text-right group-hover:text-white">{auction.topBid}</td>
                <td className="py-3.5 px-1 text-[11px] text-slate-500 dark:text-slate-400 text-right group-hover:text-emerald-50">{auction.participants || '-'}</td>
              </motion.tr>
            ))}
            {auctions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-xs text-slate-400 italic">No auctions available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Link href="/admin/auctions" className="mt-5 w-full h-9 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
        View All Auctions
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </motion.div>
  );
}
