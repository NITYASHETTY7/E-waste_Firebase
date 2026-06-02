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

  const dynamicActivities = useMemo(() => {
    const list: Array<{
      id: string;
      icon: string;
      color: string;
      title: string;
      desc: string;
      date: Date;
    }> = [];

    // 1. Listings created & events
    listings.forEach(listing => {
      list.push({
        id: `listing-${listing.id}`,
        icon: 'add_circle',
        color: 'blue',
        title: 'New request created',
        desc: `${listing.userName || 'Client'} raised request for ${listing.title}`,
        date: new Date(listing.createdAt)
      });

      if (listing.auctionPhase === 'live' && listing.auctionStartDate) {
        list.push({
          id: `auction-started-${listing.id}`,
          icon: 'sensors',
          color: 'emerald',
          title: 'Auction started',
          desc: `${listing.title} is now open for live bidding`,
          date: new Date(listing.auctionStartDate)
        });
      }

      if (listing.paymentStatus === 'confirmed' && listing.paymentSubmittedAt) {
        list.push({
          id: `payment-received-${listing.id}`,
          icon: 'payments',
          color: 'blue',
          title: 'Payment received',
          desc: `₹${(listing.paymentClientAmount || listing.basePrice || 0).toLocaleString()} received for ${listing.title}`,
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
        title: bid.type === 'sealed' ? 'New sealed bid submitted' : 'New open bid submitted',
        desc: `${bid.vendorName} bid ₹${bid.amount.toLocaleString()} on ${listing ? listing.title : 'E-Waste Item'}`,
        date: new Date(bid.createdAt)
      });
    });

    // 3. Audit completions
    auditInvitations.forEach(audit => {
      if (audit.status === 'completed') {
        list.push({
          id: `audit-${audit.id}`,
          icon: 'check_circle',
          color: 'emerald',
          title: 'Audit completed',
          desc: `${audit.vendorName} finalized audit on ${audit.siteAddress || 'client site'}`,
          date: new Date(audit.completedAt || audit.invitedAt)
        });
      }
    });

    // Sort by date descending
    list.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Fallback Mock Data if empty
    if (list.length === 0) {
      return [
        { id: 'm1', icon: 'add_circle', color: 'blue', title: 'New request created', desc: 'Corporate Office, Mumbai', date: new Date(Date.now() - 120000) },
        { id: 'm2', icon: 'check_circle', color: 'emerald', title: 'Audit completed', desc: 'ABC Electronics Pvt. Ltd.', date: new Date(Date.now() - 300000) },
        { id: 'm3', icon: 'gavel', color: 'orange', title: 'New sealed bid submitted', desc: 'GreenWay Recycling', date: new Date(Date.now() - 480000) },
        { id: 'm4', icon: 'sensors', color: 'emerald', title: 'Auction started', desc: 'Dell IT Assets Auction', date: new Date(Date.now() - 720000) },
        { id: 'm5', icon: 'payments', color: 'blue', title: 'Payment received', desc: '₹2,45,000 from RecycleX', date: new Date(Date.now() - 900000) },
      ];
    }

    return list.slice(0, 5);
  }, [listings, bids, auditInvitations, timeTick]);

  const dynamicAlerts = useMemo(() => {
    const alertsList: Array<{
      id: string;
      icon: string;
      color: string;
      title: string;
      desc: string;
      time: string;
      urgent: boolean;
    }> = [];

    // 1. Audits pending
    const pendingAudits = auditInvitations.filter(a => a.status === 'invited' || a.status === 'accepted');
    if (pendingAudits.length > 0) {
      alertsList.push({
        id: 'alert-audits',
        icon: 'warning',
        color: 'amber',
        title: `${pendingAudits.length} audit${pendingAudits.length > 1 ? 's' : ''} pending`,
        desc: 'Require your approval',
        time: 'Just now',
        urgent: false
      });
    }

    // 2. Payments pending
    const pendingPayments = listings.filter(l => l.paymentStatus === 'proof_uploaded');
    if (pendingPayments.length > 0) {
      const totalAmount = pendingPayments.reduce((sum, l) => sum + (l.paymentClientAmount || l.basePrice || 0), 0);
      alertsList.push({
        id: 'alert-payments',
        icon: 'payments',
        color: 'rose',
        title: `${pendingPayments.length} payment${pendingPayments.length > 1 ? 's' : ''} pending`,
        desc: `Total amount: ₹${totalAmount.toLocaleString()}`,
        time: '10 min ago',
        urgent: true
      });
    }

    // 3. Compliance docs pending
    const pendingCompliance = listings.filter(l => l.complianceStatus === 'documents_uploaded');
    if (pendingCompliance.length > 0) {
      alertsList.push({
        id: 'alert-compliance',
        icon: 'description',
        color: 'blue',
        title: `${pendingCompliance.length} compliance document${pendingCompliance.length > 1 ? 's' : ''}`,
        desc: 'Need to be verified',
        time: '1 hour ago',
        urgent: false
      });
    }

    // 4. Live auctions ending soon
    const endingSoon = listings.filter(l => {
      if (l.auctionPhase !== 'live' || !l.auctionEndDate) return false;
      const end = new Date(l.auctionEndDate).getTime();
      const now = Date.now();
      const diffHours = (end - now) / 3600000;
      return diffHours > 0 && diffHours <= 24;
    });
    if (endingSoon.length > 0) {
      alertsList.push({
        id: 'alert-ending',
        icon: 'gavel',
        color: 'amber',
        title: `Auction${endingSoon.length > 1 ? 's' : ''} ending soon`,
        desc: `${endingSoon.length} auction${endingSoon.length > 1 ? 's end' : ' ends'} in next 24 hours`,
        time: '2 hours ago',
        urgent: false
      });
    }

    // Fallbacks if empty
    if (alertsList.length === 0) {
      return [
        { id: 'a1', icon: 'warning', color: 'amber', title: '3 audits pending', desc: 'Require your approval', time: 'Just now', urgent: false },
        { id: 'a2', icon: 'payments', color: 'rose', title: '2 payments pending', desc: 'Total amount: ₹3,45,000', time: '10 min ago', urgent: true },
        { id: 'a3', icon: 'description', color: 'blue', title: '5 compliance documents', desc: 'Need to be verified', time: '1 hour ago', urgent: false },
        { id: 'a4', icon: 'gavel', color: 'amber', title: 'Auction ending soon', desc: '2 auctions end in next 2 hours', time: '2 hours ago', urgent: false },
      ];
    }

    return alertsList;
  }, [listings, auditInvitations]);

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Activity Feed */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex-1"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">Real-time Activities</h3>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">Live</span>
          </div>
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
              <div className={`w-9 h-9 rounded-xl ${ICON_COLOR[act.color]} flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-900`}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{act.icon}</span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">{act.title}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{act.desc}</p>
              </div>
              <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap pt-0.5">{formatRelativeTime(act.date)}</span>
            </motion.div>
          ))}
        </div>

        <Link href="/admin/transactions" className="mt-5 w-full h-9 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
          View All Activities
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </motion.div>

      {/* Alerts & Notifications */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold text-slate-900 dark:text-white text-base">Alerts & Notifications</h3>
          <Link href="/admin/listings" className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline">View All</Link>
        </div>

        <div className="space-y-3">
          {dynamicAlerts.map((alert, idx) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.07 }}
              className="flex items-start gap-3 cursor-default"
            >
              <div className={`w-9 h-9 rounded-xl ${ICON_COLOR[alert.color]} flex items-center justify-center shrink-0`}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{alert.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold leading-tight ${alert.urgent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{alert.title}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{alert.desc}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[9px] font-bold text-slate-400">{alert.time}</span>
                {alert.urgent && <div className="w-2 h-2 rounded-full bg-rose-500" />}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
