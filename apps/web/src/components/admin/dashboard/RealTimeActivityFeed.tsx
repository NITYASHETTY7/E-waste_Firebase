"use client";

import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import Link from "next/link";

const ICON_COLOR: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  orange: 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
  amber: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Just now';
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function RealTimeActivityFeed() {
  const { listings, bids, auditInvitations } = useApp();
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(t => t + 1);
    }, 10000); // force update times every 10 seconds
    return () => clearInterval(timer);
  }, []);

  const isAnyAuctionLive = useMemo(() => {
    return listings.some(l => l.auctionPhase === 'live');
  }, [listings]);

  const dynamicActivities = useMemo(() => {
    const list: Array<{
      id: string;
      icon: string;
      color: string;
      title: string;
      desc: string;
      date: Date;
      isBid?: boolean;
    }> = [];

    // 1. Listings created & events
    listings.forEach(listing => {
      list.push({
        id: `listing-${listing.id}`,
        icon: 'add_circle',
        color: 'blue',
        title: listing.title,
        desc: `New request from ${listing.userName || 'Client'}`,
        date: new Date(listing.createdAt)
      });

      if (listing.auctionPhase === 'live' && listing.auctionStartDate) {
        list.push({
          id: `auction-started-${listing.id}`,
          icon: 'sensors',
          color: 'emerald',
          title: `Auction Live: ${listing.title}`,
          desc: `Now open for competitive bidding`,
          date: new Date(listing.auctionStartDate)
        });
      }

      if (listing.paymentStatus === 'confirmed' && listing.paymentSubmittedAt) {
        list.push({
          id: `payment-received-${listing.id}`,
          icon: 'payments',
          color: 'blue',
          title: `Payment: ${listing.title}`,
          desc: `₹${(listing.paymentClientAmount || listing.basePrice || 0).toLocaleString()} received`,
          date: new Date(listing.paymentSubmittedAt)
        });
      }
    });

    // 2. Bids
    bids.forEach(bid => {
      const listing = listings.find(l => l.id === bid.listingId);
      list.push({
        id: `bid-${bid.id}`,
        icon: 'gavel',
        color: 'orange',
        title: `₹${bid.amount.toLocaleString()}`,
        desc: `${bid.vendorName} bid on ${listing ? listing.title : 'E-Waste Item'}`,
        date: new Date(bid.createdAt),
        isBid: true
      });
    });

    // 3. Audit completions
    auditInvitations.forEach(audit => {
      if (audit.status === 'completed') {
        list.push({
          id: `audit-${audit.id}`,
          icon: 'check_circle',
          color: 'emerald',
          title: `Audit Finalized`,
          desc: `${audit.vendorName} on ${audit.siteAddress || 'client site'}`,
          date: new Date(audit.completedAt || audit.invitedAt)
        });
      }
    });

    // Sort by date descending
    list.sort((a, b) => b.date.getTime() - a.date.getTime());

    return list.slice(0, 6);
  }, [listings, bids, auditInvitations, timeTick]);

  return (
    <div className="flex flex-col h-full">
      {/* Activity Feed */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex-1"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">
            {isAnyAuctionLive ? 'Real-time Activities' : 'Recent Activities'}
          </h3>
          {isAnyAuctionLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>

        <div className="relative space-y-4 before:absolute before:left-[17px] before:top-2 before:bottom-10 before:w-px before:bg-slate-100 dark:before:bg-slate-800">
          {dynamicActivities.map((act, idx) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="flex gap-3 relative z-10"
            >
              <div className={`w-9 h-9 rounded-xl ${ICON_COLOR[act.color]} flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-900 shadow-sm`}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{act.icon}</span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-xs font-bold leading-tight truncate ${act.isBid ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white'}`}>{act.title}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{act.desc}</p>
              </div>
              <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap pt-0.5">{formatRelativeTime(act.date)}</span>
            </motion.div>
          ))}
          {dynamicActivities.length === 0 && (
            <div className="text-center py-10 text-xs text-slate-400 italic">No recent activities</div>
          )}
        </div>

        <Link href="/admin/bidding" className="mt-5 w-full h-9 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
          View All Activities
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </motion.div>
    </div>
  );
}
