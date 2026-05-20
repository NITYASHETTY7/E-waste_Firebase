"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function ClientSealedBids() {
  const { currentUser } = useApp();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [bidsMap, setBidsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchClientAuctions = async () => {
    if (!currentUser?.companyId) return;
    try {
      setLoading(true);
      const res = await api.get(`/auctions?clientId=${currentUser.companyId}`);
      const filtered = res.data.filter((a: any) => 
        a.status === "SEALED_PHASE" || a.status === "OPEN_PHASE" || a.status === "PENDING_SELECTION" || a.status === "UPCOMING"
      );
      setAuctions(filtered);

      // Fetch bids for each auction and filter for shortlisted
      const bMap: Record<string, any[]> = {};
      for (const auction of filtered) {
        const bidRes = await api.get(`/auctions/bids?auctionId=${auction.id}`);
        // Client only sees SHORTLISTED sealed bids
        const shortlistedBids = bidRes.data.filter((b: any) => b.phase === "SEALED" && b.isShortlisted);
        shortlistedBids.sort((a: any, b: any) => b.amount - a.amount);
        shortlistedBids.forEach((b: any, i: number) => b.calculatedRank = i + 1);
        bMap[auction.id] = shortlistedBids;
      }
      setBidsMap(bMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientAuctions();
  }, [currentUser?.companyId]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Shortlisted Sealed Bids</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Review the top sealed bids shortlisted by the admin team.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : auctions.length === 0 ? (
        <div className="card p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">lock</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Active Auctions Found</h3>
          <p className="text-slate-500 mt-2">Shortlisted bids will appear here once the admin shares them.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {auctions.map(auction => {
            const shortlistedBids = bidsMap[auction.id] || [];
            if (shortlistedBids.length === 0) return null; // Don't show if no shortlisted bids

            return (
              <div key={auction.id} className="card p-0 overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{auction.id.substring(0,8)}</span>     
                      <span className="text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase bg-blue-100 text-blue-700">
                        {auction.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{auction.title}</h3> 
                    <p className="text-xs text-slate-500 mt-0.5">Base: ₹{auction.basePrice?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-4">Rank</th>
                        <th className="px-6 py-4">Vendor Name</th>
                        <th className="px-6 py-4 text-right">Bid Amount</th>
                        <th className="px-6 py-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {shortlistedBids.map((bid, idx) => {
                        const isRank1 = bid.calculatedRank === 1;
                        return (
                          <tr key={bid.id} className={`transition-colors ${isRank1 ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/20"}`}>
                            <td className="px-6 py-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${isRank1 ? "bg-[#1E8E3E] text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                                {bid.calculatedRank}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                              {bid.vendor?.name || "Unknown"}
                            </td>
                            <td className="px-6 py-4 font-bold text-[#1E8E3E] dark:text-emerald-500 text-right">
                              ₹{bid.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-slate-500 truncate max-w-[200px]" title={bid.remarks}>
                              {bid.remarks || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}