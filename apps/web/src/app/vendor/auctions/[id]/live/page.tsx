"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useAuction } from "@/hooks/useAuction";
import { formatTimeMs } from "@/utils/format";
import { motion } from "framer-motion";

/* ─── SVG Line Chart ─────────────────────────────────────────── */
function BidChart({
  vendorLines,
  maxRound,
  basePrice,
  currentHighest,
}: {
  vendorLines: any[];
  maxRound: number;
  basePrice: number;
  currentHighest: number;
}) {
  const W = 620;
  const H = 300;
  const PL = 70;
  const PR = 20;
  const PT = 20;
  const PB = 40;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  // Dynamic Y-scale based on actual bid range so bids are always visible
  const allAmounts = vendorLines.flatMap((v) => v.displayPoints.map((p: any) => p.amount));
  const bidMin = allAmounts.length > 0 ? Math.min(...allAmounts) : basePrice;
  const bidMax = allAmounts.length > 0 ? Math.max(...allAmounts) : basePrice;
  const padding = Math.max((bidMax - bidMin) * 0.15, basePrice * 0.02, 1000);
  const minPrice = bidMin - padding;
  const maxPrice = bidMax + padding;

  const toX = (round: number) => {
    if (maxRound <= 1) return PL + chartW / 2;
    return PL + ((round - 1) / (Math.max(maxRound - 1, 1))) * chartW;
  };
  const toY = (amount: number) =>
    PT + chartH - ((amount - minPrice) / (maxPrice - minPrice)) * chartH;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    minPrice + (i / yTicks) * (maxPrice - minPrice)
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full bg-slate-50 dark:bg-slate-950">
      {/* Grid lines */}
      {yTickValues.map((v, i) => (
        <g key={i}>
          <line
            x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)}
            stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4"
          />
          <text
            x={PL - 6} y={toY(v) + 4}
            fontSize="9" fill="#64748B" textAnchor="end"
          >
            {v >= 100000
              ? `₹${(v / 100000).toFixed(2)}L`
              : `₹${(v / 1000).toFixed(1)}K`}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="#E2E8F0" strokeWidth="1" />
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#E2E8F0" strokeWidth="1" />

      {/* Lines + dots */}
      {vendorLines.map((line) => {
        if (line.displayPoints.length < 1) return null;
        const pts = line.displayPoints
          .map((p: any) => `${toX(p.round)},${toY(p.amount)}`)
          .join(" ");

        return (
          <g key={line.id}>
            {line.displayPoints.length > 1 && (
              <polyline
                points={pts}
                fill="none"
                stroke={line.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.9"
              />
            )}
            {line.displayPoints.map((p: any, i: number) => (
              <circle
                key={i}
                cx={toX(p.round)}
                cy={toY(p.amount)}
                r="4"
                fill={line.color}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function LiveAuctionScreen() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useApp();
  const listingId = params?.id as string;

  const {
    listing,
    auctionBids,
    leaderboard,
    currentHighAmount,
    currentHighBid,
    formatTime: auctionTimer,
    placeBid,
    isActive,
    approvedWinnerId,
    announcedWinnerId,
  } = useAuction(listingId, { forceConnect: true });

  const [customBid, setCustomBid] = useState("");
  const ledgerRef = useRef<HTMLDivElement>(null);

  if (!listing) {
    return <div className="p-10 text-center text-slate-500">Listing not found</div>;
  }

  const basePrice = listing.basePrice || 0;
  const increment = listing.bidIncrement || 500;
  const currentHighest = currentHighAmount;
  const nextBidAmount = currentHighest + increment;

  // Build anonymized vendor code prefix from listing title (e.g. "mac book" → "MB")
  const titlePrefix = listing.title.split(' ')
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 3) || 'V';

  // Assign codes by first-appearance order (sorted by createdAt asc)
  const vendorCodeMap = new Map<string, string>();
  const sortedByTime = [...auctionBids].sort((a: any, b: any) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  sortedByTime.forEach((bid: any) => {
    if (!vendorCodeMap.has(bid.vendorId)) {
      const code = `${titlePrefix}-${String(vendorCodeMap.size + 1).padStart(3, '0')}`;
      vendorCodeMap.set(bid.vendorId, code);
    }
  });

  const getVendorLabel = (vendorId: string) => {
    const code = vendorCodeMap.get(vendorId) || `${titlePrefix}-???`;
    return vendorId === currentUser?.id ? `${code} (You)` : code;
  };

  // Process data for chart — auctionBids is oldest-first, so globalIndex is chronological
  const vendorBidsMap = new Map();
  auctionBids.forEach((bid: any, globalIndex: number) => {
    if (!vendorBidsMap.has(bid.vendorId)) {
      vendorBidsMap.set(bid.vendorId, {
        id: bid.vendorId,
        name: getVendorLabel(bid.vendorId),
        color: ["#1E8E3E", "#0B5ED7", "#FFC107", "#DC3545", "#6F42C1"][vendorBidsMap.size % 5],
        displayPoints: []
      });
    }
    vendorBidsMap.get(bid.vendorId).displayPoints.push({ round: globalIndex + 1, amount: bid.amount });
  });

  const vendorLines = Array.from(vendorBidsMap.values());
  const maxRound = auctionBids.length;

  const handleQuickBid = (amount: number) => {
    const result = placeBid(amount);
    if (!result.success) alert(result.message);
  };

  const handleCustomBid = () => {
    const amount = parseInt(customBid);
    if (isNaN(amount)) return;
    const result = placeBid(amount);
    if (result.success) setCustomBid("");
    else alert(result.message);
  };

  const isLeading = currentHighBid?.vendorId === currentUser?.id;
  const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const getRankLabel = (vendorId: string): string => {
    const rank = leaderboard.findIndex((l: any) => l.vendorId === vendorId);
    return rank >= 0 ? `L${rank + 1}` : '—';
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <div className="sticky top-0 z-30 shadow-sm bg-white border-b-2 border-b-[#1E8E3E] dark:bg-slate-900">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4 min-w-0 bg-[#E8F5E9] px-2 py-1 rounded-md">
            <span className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-[#1E8E3E] animate-pulse" : "bg-slate-400"} shrink-0`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#1E8E3E] shrink-0">
              {isActive ? "Live" : "Ended"}
            </span>
          </div>
          <span className="text-[#1A1A2E] font-bold text-sm truncate max-w-[200px] mr-4">
            {listing.title}
          </span>

          <div className="flex items-center gap-2 flex-wrap flex-1">
            <StatPill label="Base Price" value={fmtINR(basePrice)} color="#0B5ED7" />
            <StatPill label="Current Lot" value={fmtINR(currentHighest)} color="#1E8E3E" pulse={isActive} />
            <StatPill label="Tick Size" value={fmtINR(increment)} color="#FFC107" />

            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 shadow-sm dark:bg-slate-900 dark:border-slate-600">
              <span className="text-[#1E8E3E] text-xs font-black">₹</span>
              <input
                type="number"
                value={customBid}
                onChange={(e) => setCustomBid(e.target.value)}
                placeholder="Custom bid"
                className="bg-transparent text-slate-900 dark:text-white text-xs font-bold w-24 outline-none placeholder:text-slate-400"
                disabled={!isActive}
              />
            </div>

            {isActive ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickBid(nextBidAmount)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1E8E3E] hover:bg-[#15803d] text-white rounded-lg font-black text-xs uppercase tracking-widest transition-all shadow-md"
                >
                  <span className="material-symbols-outlined text-base">gavel</span>
                  Bid {fmtINR(nextBidAmount)}
                </button>
                {customBid && (
                  <button
                    onClick={handleCustomBid}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0B5ED7] hover:bg-blue-700 text-white rounded-lg font-black text-xs uppercase tracking-widest shadow-sm transition-all"
                  >
                    Place Custom
                  </button>
                )}
              </div>
            ) : (
              <span className="text-xs font-black uppercase tracking-widest text-amber-600 border border-amber-400 px-3 py-1.5 rounded-lg bg-amber-50">
                Auction Concluded
              </span>
            )}
          </div>

          <div className={`shrink-0 flex flex-col items-center px-4 py-1.5 rounded-xl border bg-white ${isActive && currentHighest > 0 ? "border-red-500 bg-red-50" : "border-slate-200"}`}>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Time Left</span>
            <span className={`font-mono font-black text-2xl tabular-nums tracking-tighter ${isActive ? "text-[#DC3545]" : "text-slate-400"}`}>
              {auctionTimer}
            </span>
          </div>

          <button onClick={() => router.back()} className="shrink-0 text-[#DC3545] bg-[#F5F7FA] px-3 py-1.5 rounded-lg hover:bg-red-50 transition text-xs font-bold uppercase tracking-widest border border-slate-200 dark:bg-slate-950 dark:border-slate-700">
            ✕ Exit
          </button>
        </div>
      </div>

      {isActive && currentHighBid && (
        <div className={`py-2 text-center text-xs font-black uppercase tracking-widest transition-colors ${isLeading ? "bg-[#E8F5E9] text-[#1E8E3E]" : "bg-orange-100 text-orange-600"}`}>
          {isLeading ? "YOU ARE LEADING" : `OUTBID BY ${getVendorLabel((currentHighBid as any).vendorId)}`}
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border bg-white border-t-4 border-t-[#1E8E3E] shadow-sm overflow-hidden border-slate-200 dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Real-Time Bid Progression</p>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-sm mt-0.5">{auctionBids.length} bids placed</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {vendorLines.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 dark:bg-slate-950 dark:border-slate-700">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.color }} />
                    <span className="text-[10px] text-slate-900 dark:text-white font-bold">
                      {getRankLabel(v.id)}{v.id === currentUser?.id ? ' (You)' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4" style={{ height: 320 }}>
              <BidChart vendorLines={vendorLines} maxRound={maxRound} basePrice={basePrice} currentHighest={currentHighest} />
            </div>
          </div>

          <div className="rounded-2xl border bg-white border-t-4 border-t-[#0B5ED7] shadow-sm overflow-hidden border-slate-200 dark:bg-slate-900 dark:border-slate-700">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:bg-slate-950 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Bid Ledger</p>
              <span className="text-[10px] font-bold text-[#0B5ED7] bg-[#EFF6FF] px-2 py-0.5 rounded-full border border-blue-200">{auctionBids.length} events</span>
            </div>
            <div ref={ledgerRef} className="overflow-y-auto p-4 space-y-1.5" style={{ maxHeight: 250 }}>
              {[...(auctionBids as any[])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((e) => {
                const isLeadingBid = leaderboard.findIndex((l: any) => l.vendorId === e.vendorId) === 0;
                const isMe = e.vendorId === currentUser?.id;
                return (
                  <div key={e.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs transition-all ${isMe ? "bg-[#E8F5E9] border-l-4 border-l-[#1E8E3E]" : isLeadingBid ? "bg-blue-50 border border-blue-200" : "bg-white border border-slate-100"}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: vendorBidsMap.get(e.vendorId)?.color || "#CBD5E1" }} />
                      <span className={`font-bold ${isMe ? "text-[#1E8E3E]" : "text-slate-900 dark:text-slate-200"}`}>{getVendorLabel(e.vendorId)}</span>
                      {getRankLabel(e.vendorId) !== '—' && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          getRankLabel(e.vendorId) === 'L1' ? 'bg-emerald-600 text-white' :
                          getRankLabel(e.vendorId) === 'L2' ? 'bg-blue-500 text-white' :
                          getRankLabel(e.vendorId) === 'L3' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-700'
                        }`}>{getRankLabel(e.vendorId)}</span>
                      )}
                      <span className="text-[10px] text-slate-400">{formatTimeMs(e.createdAt)}</span>
                    </div>
                    <span className={`font-mono font-bold ${isMe ? "text-[#1E8E3E]" : "text-slate-600"}`}>{fmtINR(e.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border bg-white border-t-4 border-t-[#0B5ED7] shadow-sm p-4 space-y-3 border-slate-200 dark:bg-slate-900 dark:border-slate-700">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Lot Details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Category", value: listing.category },
                { label: "Weight", value: `${listing.weight} KG` },
                { label: "EMD Amount", value: fmtINR(listing.highestEmdAmount ?? 0), valueColor: "text-[#DC3545]" },
                { label: "Location", value: listing.location },
                { label: "Lot ID", value: listing.id.split("-")[0], valueColor: "text-[#0B5ED7]" },
              ].map(({ label, value, valueColor }) => (
                <div key={label}>
                  <p className="text-[9px] text-[#94A3B8] uppercase font-black tracking-widest">{label}</p>
                  <p className={`text-xs font-bold truncate ${valueColor || "text-slate-900 dark:text-slate-100"}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {!isActive && leaderboard.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* My position */}
              {leaderboard.slice(0, 3).map((l: any, idx: number) => {
                const isMe = l.vendorId === currentUser?.id;
                if (!isMe) return null;
                return (
                  <div key={l.vendorId} className={`rounded-2xl border p-5 text-center shadow-sm ${idx === 0 ? 'bg-gradient-to-br from-[#E8F5E9] to-[#D1FAE5] border-[#1E8E3E]' : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300'}`}>
                    <span className={`text-2xl font-black ${idx === 0 ? 'text-[#1E8E3E]' : 'text-blue-600'}`}>L{idx + 1}</span>
                    <p className="text-slate-900 dark:text-slate-100 font-black text-base mt-1">{idx === 0 ? 'You Have the Highest Bid!' : `You Are in Position L${idx + 1}`}</p>
                    {idx === 0 && approvedWinnerId === currentUser?.id ? (
                      <><span className="material-symbols-outlined text-[#1E8E3E] text-3xl mt-2">emoji_events</span>
                      <p className="text-[#1E8E3E] font-bold text-sm mt-1">Winner Confirmed!</p>
                      <p className="text-slate-600 text-xs mt-1">Check your email for document collection and pickup instructions.</p></>
                    ) : idx === 0 ? (
                      <><span className="material-symbols-outlined text-amber-500 text-3xl mt-2">hourglass_top</span>
                      <p className="text-slate-700 font-bold text-xs mt-1">Awaiting admin approval</p>
                      <p className="text-slate-500 text-[10px] mt-1">You will receive an email once the admin confirms you as the winner.</p></>
                    ) : null}
                  </div>
                );
              })}
              {/* Not in top 3 */}
              {leaderboard.findIndex((l: any) => l.vendorId === currentUser?.id) === -1 || leaderboard.findIndex((l: any) => l.vendorId === currentUser?.id) >= 3 ? (
                <div className="rounded-2xl bg-slate-100 border border-slate-200 p-4 text-center">
                  <p className="text-slate-600 font-bold text-sm">Auction Concluded</p>
                  <p className="text-slate-500 text-xs mt-1">Thank you for participating.</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, color, pulse }: { label: string; value: string; color: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-white border border-slate-200 min-w-[90px] shadow-sm dark:bg-slate-900 dark:border-slate-700">
      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`font-mono font-black text-sm tabular-nums ${pulse ? "animate-pulse" : ""}`} style={{ color }}>{value}</span>
    </div>
  );
}
