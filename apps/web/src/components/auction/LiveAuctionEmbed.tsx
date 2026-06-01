"use client";

import React, { useState } from "react";
import { useAuction } from "@/hooks/useAuction";
import { useApp } from "@/context/AppContext";
import { Listing } from "@/types";
import { formatTimeMs } from "@/utils/format";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

/* ─── Recharts Bid Progression Chart ─────────────────────────────────────────── */
function BidChart({
  competitors,
  maxRound,
  basePrice,
}: {
  competitors: any[];
  maxRound: number;
  basePrice: number;
}) {
  // Process data for Recharts: array of objects per round
  const data: any[] = [];
  for (let r = 1; r <= maxRound; r++) {
    const point: any = { round: r, name: `Round ${r}` };
    competitors.forEach((v) => {
      const match = v.bids.find((b: any) => b.globalIndex === r);
      if (match) point[v.id] = match.amount;
    });
    data.push(point);
  }

  // Calculate domain for Y axis
  const allAmounts = competitors.flatMap((v) => v.bids.map((p: any) => p.amount));
  const bidMin = allAmounts.length > 0 ? Math.min(...allAmounts) : basePrice;
  const bidMax = allAmounts.length > 0 ? Math.max(...allAmounts) : basePrice;
  const padding = Math.max((bidMax - bidMin) * 0.15, basePrice * 0.05, 1000);
  const minPrice = Math.max(0, bidMin - padding);
  const maxPrice = bidMax + padding;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} 
          tickLine={false} 
          axisLine={{ stroke: '#e2e8f0' }} 
          hide={maxRound > 20} // Hide labels if too many rounds to avoid overlap
        />
        <YAxis 
          domain={[minPrice, maxPrice]} 
          tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} 
          tickLine={false} 
          axisLine={{ stroke: '#e2e8f0' }} 
          tickFormatter={(val) => val >= 100000 ? `₹${(val/100000).toFixed(1)}L` : `₹${Math.round(val/1000)}k`} 
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `₹${value.toLocaleString('en-IN')}`, 
            competitors.find((v) => v.id === name)?.name || 'Vendor'
          ]}
          labelStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '11px' }}
          contentStyle={{ 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            padding: '8px 12px'
          }}
        />
        {competitors.map((v) => (
          <Line
            key={v.id}
            type="monotone"
            dataKey={v.id}
            stroke={v.color}
            strokeWidth={3}
            dot={{ r: 4, fill: v.color, stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
            connectNulls={true}
            animationDuration={500}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function LiveAuctionEmbed({ listing: initialListing, userRole = "client" }: { listing?: Listing, userRole?: "client" | "vendor" | "admin" }) {
  const {
    listing,
    auctionBids,
    leaderboard,
    currentHighAmount,
    currentHighBid,
    formatTime: auctionTimer,
    placeBid,
    isActive
  } = useAuction(initialListing?.id || "");

  const { updateAuctionPhase } = useApp();
  const [vendorBid, setVendorBid] = useState("");

  const getRankLabel = (vendorId: string): string => {
    const rank = leaderboard.findIndex((l: any) => l.vendorId === vendorId);
    return rank >= 0 ? `L${rank + 1}` : '—';
  };

  if (!listing) return <div className="p-10 text-center">Listing not found</div>;

  const title = listing.title;
  const basePrice = listing.basePrice || 0;
  const tickSize = listing.bidIncrement || 500;
  const currentHigh = currentHighAmount;
  const lotId = listing.id.split("-")[0];
  const weight = listing.weight;
  const category = listing.category;
  const location = listing.location;
  const emd = listing.highestEmdAmount || 0;

  // Group bids by vendor for the chart — auctionBids is already chronological (oldest first)
  const vendorBidsMap = new Map();
  auctionBids.forEach((bid, globalIndex) => {
    if (!vendorBidsMap.has(bid.vendorId)) {
      vendorBidsMap.set(bid.vendorId, {
        name: userRole === "vendor" && bid.vendorId !== initialListing?.userId
          ? "Anonymous"
          : ((bid as any).vendorName || (bid as any).vendor?.name || "Unknown Vendor"),
        id: bid.vendorId,
        bids: []
      });
    }
    vendorBidsMap.get(bid.vendorId).bids.push({ ...bid, globalIndex: globalIndex + 1 });
  });

  const competitors = Array.from(vendorBidsMap.values()).map((v, i) => ({
    ...v,
    color: ["#1E8E3E", "#FFC107", "#6F42C1", "#0B5ED7", "#DC3545"][i % 5],
    displayBids: v.bids.map((b: any) => ({ r: b.globalIndex, a: b.amount }))
  }));

  const maxRound = auctionBids.length;

  // Y-axis scale based on actual bid range — prevents bids from being invisible
  const allAmounts = auctionBids.map(b => b.amount).filter(a => a > 0);
  const bidMin = allAmounts.length > 0 ? Math.min(...allAmounts) : basePrice;
  const bidMax = allAmounts.length > 0 ? Math.max(...allAmounts) : (basePrice || 1);
  const yPadding = Math.max((bidMax - bidMin) * 0.15, bidMax * 0.05, 500);
  const yMin = Math.max(0, bidMin - yPadding);
  const yMax = bidMax + yPadding;
  const getChartX = (r: number) => 50 + ((r - 1) / Math.max(maxRound - 1, 1)) * 430;
  const getChartY = (a: number) => yMax === yMin ? 100 : 20 + (1 - (a - yMin) / (yMax - yMin)) * 160;
  const yAxisLabels = [0, 1, 2, 3, 4].map(i => ({
    y: 20 + i * 40,
    val: Math.round(yMax - i * (yMax - yMin) / 4),
  }));

  const handleSubmitBid = () => {
    const amount = parseInt(vendorBid);
    if (isNaN(amount)) return;
    const result = placeBid(amount);
    if (result.success) {
      setVendorBid("");
    } else {
      alert(result.message);
    }
  };

  const handleQuickBid = (increment: number) => {
    const amount = currentHigh + increment;
    placeBid(amount);
  };

  const handleEndAuction = async () => {
    if (confirm("Are you sure you want to end this auction now?")) {
      await updateAuctionPhase(listing.id, 'completed');
    }
  };

  const handleDownloadBidHistory = () => {
    const rows = [
      ["Round", "Vendor", "Amount (₹)", "Timestamp"],
      ...[...auctionBids].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((bid, i) => {
        const vendorName = (bid as any).vendorName || (bid as any).vendor?.name || bid.vendorId;
        return [i + 1, vendorName, bid.amount, new Date(bid.createdAt).toLocaleString("en-IN")];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bid-history-${listing.id}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="font-sans min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Header - Standardized with Admin/Vendor */}
      <div className="sticky top-0 z-30 shadow-sm bg-white border-b-2 border-b-[#1E8E3E] dark:bg-slate-900">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="bg-slate-100 text-slate-900 dark:text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
            <span className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-red-500 animate-pulse" : "bg-slate-400"}`} />
            {isActive ? "LIVE" : "AUCTION ENDED"}: {title}
          </div>
          <div className="bg-slate-100 text-slate-900 dark:text-white px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mr-2">BASE PRICE</span>
            ₹{basePrice.toLocaleString()}
          </div>
          <div className="bg-emerald-50 text-slate-900 dark:text-white px-3 py-1.5 rounded-md text-xs font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest mr-2">CURRENT HIGH</span>
            ₹{currentHigh.toLocaleString()}
          </div>
          <div className="bg-slate-100 text-slate-900 dark:text-white px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest mr-2">TICK SIZE</span>
            ₹{tickSize.toLocaleString()}
          </div>
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 border border-blue-200 ml-auto dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
            <span className="material-symbols-outlined text-[16px]">timer</span>
            {isActive ? auctionTimer : "00:00:00"}
          </div>
        </div>
      </div>

      {/* Two Column Layout Content */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6 p-6">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
          
          {/* Bid Progression Graph Card */}
          <div className="bg-white border border-slate-200 rounded-xl border-t-4 border-t-[#1E8E3E] shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 dark:border-slate-800">
              <div>
                <p className="text-[#64748B] text-[10px] font-black uppercase tracking-widest">Real-Time Bid Progression</p>
                <p className="text-slate-900 dark:text-white text-xs font-bold mt-0.5">{auctionBids.length} bids placed</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {competitors.slice(0,5).map(c => {
                  const rankLabel = getRankLabel(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-1.5 px-2 py-1 border border-slate-200 rounded-md bg-white shadow-sm dark:bg-slate-900 dark:border-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{background: c.color}}></span>
                      <span className="text-[9px] text-slate-900 dark:text-white font-bold">{rankLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-5" style={{ height: 320 }}>
              {auctionBids.length > 0 ? (
                <BidChart competitors={competitors} maxRound={maxRound} basePrice={basePrice} />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                  Waiting for first bid...
                </div>
              )}
            </div>
          </div>

          {/* Bid Ledger Card */}
          <div className="bg-white border border-slate-200 rounded-xl border-t-4 border-t-[#0B5ED7] shadow-sm overflow-hidden flex-1 dark:bg-slate-900 dark:border-slate-700">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between dark:bg-slate-950 dark:border-slate-800">
              <p className="text-[#64748B] text-[10px] font-black uppercase tracking-widest">Live Bid Ledger</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${isActive ? "text-[#0B5ED7] bg-[#EFF6FF] border-blue-200" : "text-slate-500 bg-slate-100 border-slate-200"}`}>
                {isActive ? "Live Updates" : "Final Standings"}
              </span>
            </div>
            <div className="p-3 space-y-2 max-h-[350px] overflow-y-auto">
              {[...auctionBids].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((bid) => {
                const rank = leaderboard.findIndex(l => l.vendorId === bid.vendorId);
                const isLeader = rank === 0;
                const vendorName = userRole === "vendor" && bid.vendorId !== initialListing?.userId
                  ? "Anonymous Vendor"
                  : ((bid as any).vendorName || (bid as any).vendor?.name || "Unknown Vendor");
                return (
                  <div key={bid.id} className={`flex items-center justify-between p-3 rounded-lg text-xs transition-all group ${isLeader ? "bg-emerald-50 border-l-4 border-emerald-600 dark:bg-emerald-950/20" : "bg-white border border-slate-100 hover:bg-emerald-950/30 dark:bg-slate-950 dark:border-slate-800"}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0 group-hover:bg-white" style={{background: competitors.find(c => c.id === bid.vendorId)?.color || "#CBD5E1"}}></span>
                      <div>
                        <span className={`font-bold transition-colors ${isLeader ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white group-hover:text-white"}`}>
                          {vendorName}
                        </span>
                        {getRankLabel(bid.vendorId) !== '—' && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ml-1.5 group-hover:bg-white/20 group-hover:text-white ${
                            getRankLabel(bid.vendorId) === 'L1' ? 'bg-emerald-600 text-white' :
                            getRankLabel(bid.vendorId) === 'L2' ? 'bg-blue-500 text-white' :
                            getRankLabel(bid.vendorId) === 'L3' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}>{getRankLabel(bid.vendorId)}</span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400 ml-2 tracking-tight group-hover:text-emerald-100">
                          {formatTimeMs(bid.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-sm transition-colors ${isLeader ? "text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300 group-hover:text-white"}`}>
                      ₹{bid.amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              {auctionBids.length === 0 && (
                <div className="text-center py-10 text-slate-400">No bids yet</div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          
          {/* Lot Details Card */}
          <div className="bg-white border border-slate-200 rounded-xl border-t-4 border-t-[#0B5ED7] shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <p className="text-[#94A3B8] dark:text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">CATEGORY</p>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#0B5ED7] dark:text-blue-400 text-[16px]">devices</span>
                  <p className="text-slate-900 dark:text-white text-xs font-bold truncate">{category}</p>
                </div>
              </div>
              <div>
                <p className="text-[#94A3B8] dark:text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">WEIGHT</p>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1E8E3E] dark:text-emerald-400 text-[16px]">scale</span>
                  <p className="text-slate-900 dark:text-white text-xs font-bold truncate">{weight} KG</p>
                </div>
              </div>
              <div>
                <p className="text-[#94A3B8] dark:text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">EMD AMOUNT</p>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#DC3545] dark:text-red-400 text-[16px]">payments</span>
                  <p className="text-[#DC3545] dark:text-red-400 text-xs font-bold truncate">₹{emd.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <p className="text-[#94A3B8] dark:text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">LOCATION</p>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#FFC107] dark:text-amber-400 text-[16px]">location_on</span>
                  <p className="text-slate-900 dark:text-white text-xs font-bold truncate" title={location}>{location}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Role-Specific Control Panel */}
          {userRole === "admin" ? (
            <div className="bg-white border border-slate-200 rounded-xl border-t-4 border-t-purple-500 shadow-sm p-5 flex-1 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-900 dark:text-white font-bold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">visibility</span>
                  Observation Mode
                </p>
                <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold px-2 py-1 rounded border border-purple-100 dark:border-purple-800 uppercase tracking-widest">Read-Only</span>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800 flex items-start gap-2 mb-4">
                <span className="material-symbols-outlined text-purple-500 dark:text-purple-400 text-base shrink-0 mt-0.5">info</span>
                <p className="text-purple-800 dark:text-purple-200 text-xs leading-relaxed">Admin view only. Bidding and auction controls are disabled.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Total Bids</p>
                  <p className="text-xl font-headline font-bold text-slate-900 dark:text-white">{auctionBids.length}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
                  <p className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 tracking-widest">Current High</p>
                  <p className="text-sm font-headline font-bold text-emerald-700 dark:text-emerald-300">₹{currentHigh.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : userRole === "client" ? (
            <div className="bg-white border border-slate-200 rounded-xl border-t-4 border-t-[#DC3545] shadow-sm p-5 flex-1 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between mb-5">
                <p className="text-slate-900 dark:text-white font-bold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#DC3545] dark:text-red-400">settings</span>
                  Auction Controls
                </p>
                <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-[10px] font-bold px-2 py-1 rounded border border-red-100 dark:border-red-800 uppercase tracking-widest">Client</span>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={handleEndAuction}
                  disabled={!isActive}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-[#DC3545] text-white hover:bg-red-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                  End Auction Now
                </button>
                <button
                  onClick={handleDownloadBidHistory}
                  disabled={auctionBids.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-[#EFF6FF] text-[#0B5ED7] border border-[#0B5ED7]/30 hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download Bid History
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl border-t-4 border-t-[#1E8E3E] shadow-sm p-5 flex-1 flex flex-col dark:bg-slate-900 dark:border-slate-700">
              <div className="flex items-center justify-between mb-5">
                <p className="text-slate-900 dark:text-white font-bold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1E8E3E]">gavel</span>
                  Place Your Bid
                </p>
                <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                  {isActive ? "Active" : "Closed"}
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                <p className="text-emerald-800 text-xs font-medium text-center">Minimum Next Bid</p>
                <p className="text-emerald-700 font-mono text-2xl font-black text-center mt-1">
                  ₹{(currentHigh + tickSize).toLocaleString()}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Custom Bid Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input 
                      type="number" 
                      value={vendorBid}
                      disabled={!isActive}
                      onChange={(e) => setVendorBid(e.target.value)}
                      placeholder={(currentHigh + tickSize).toString()}
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50 dark:bg-slate-950 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleQuickBid(tickSize)}
                    disabled={!isActive}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-bold text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                  >
                    +₹{tickSize.toLocaleString()}
                  </button>
                  <button 
                    onClick={() => handleQuickBid(tickSize * 2)}
                    disabled={!isActive}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-bold text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                  >
                    +₹{(tickSize * 2).toLocaleString()}
                  </button>
                </div>
                <button 
                  onClick={handleSubmitBid}
                  disabled={!isActive}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black text-[13px] uppercase tracking-widest bg-[#1E8E3E] text-white hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-900/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Bid
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
