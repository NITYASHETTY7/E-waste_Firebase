"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuction } from "@/hooks/useAuction";
import { useApp } from "@/context/AppContext";
import { formatTime as fmtTime } from "@/utils/format";
import api from "@/lib/api";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';

/* ─── Recharts Line Chart with Zoom (Brush) ─────────────────────────────────────────── */
function BidChart({
  vendorLines, maxRound, basePrice, currentHighest,
}: {
  vendorLines: { id: string; name: string; color: string; points: { round: number; amount: number }[] }[];
  maxRound: number; basePrice: number; currentHighest: number;
}) {
  // Process data for Recharts: array of objects per round
  const data: any[] = [];
  for (let r = 1; r <= maxRound; r++) {
    const point: any = { round: r, name: `Round ${r}` };
    vendorLines.forEach((v) => {
      const match = v.points.find((p: any) => p.round === r);
      if (match) point[v.id] = match.amount;
    });
    data.push(point);
  }

  // Calculate domain for Y axis
  const allAmounts = vendorLines.flatMap((v) => v.points.map((p: any) => p.amount));
  const bidMin = allAmounts.length > 0 ? Math.min(...allAmounts) : basePrice;
  const bidMax = allAmounts.length > 0 ? Math.max(...allAmounts) : Math.max(currentHighest, basePrice);
  const padding = Math.max((bidMax - bidMin) * 0.15, basePrice * 0.02, 1000);
  const minPrice = bidMin - padding;
  const maxPrice = bidMax + padding;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis domain={[minPrice, maxPrice]} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={(val) => `₹${val.toLocaleString('en-IN')}`} />
        <Tooltip
          formatter={(value: number, name: string) => [`₹${value.toLocaleString('en-IN')}`, vendorLines.find((v) => v.id === name)?.name || name]}
          labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
        {vendorLines.map((v) => (
          <Line
            key={v.id}
            type="monotone"
            dataKey={v.id}
            stroke={v.color}
            strokeWidth={2}
            dot={{ r: 3, fill: v.color, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls={true}
          />
        ))}
        <Brush dataKey="name" height={30} stroke="#cbd5e1" fill="#f8fafc" travellerWidth={10} tickFormatter={() => ''} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const COLORS = ["#1E8E3E", "#0B5ED7", "#FFC107", "#DC3545", "#6F42C1", "#0EA5E9", "#F97316"];

/* â”€â”€â”€ Disqualification Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function DisqualifyModal({
  currentWinner,
  leaderboard,
  vendorMap,
  fmtINR,
  onConfirm,
  onCancel,
  submitting,
}: {
  currentWinner: { vendorId: string; vendorName: string; amount: number };
  leaderboard: any[];
  vendorMap: Map<string, { id: string; name: string; color: string; points: { round: number; amount: number }[] }>;
  fmtINR: (n: number) => string;
  onConfirm: (reason: string, fineAmount: number) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [reasonError, setReasonError] = useState(false);

  // Build unique-vendor ranked list excluding the current winner
  const uniqueVendors: { vendorId: string; vendorName: string; amount: number; rank: number }[] = [];
  const seen = new Set<string>();
  leaderboard.forEach((bid: any) => {
    if (!seen.has(bid.vendorId)) {
      seen.add(bid.vendorId);
      uniqueVendors.push({
        vendorId: bid.vendorId,
        vendorName: bid.vendorName || bid.vendor?.name || bid.name || "Unknown",
        amount: bid.amount,
        rank: uniqueVendors.length + 1,
      });
    }
  });

  const nextWinner = uniqueVendors.find(v => v.vendorId !== currentWinner.vendorId);

  const handleSubmit = () => {
    if (!reason.trim()) { setReasonError(true); return; }
    setReasonError(false);
    onConfirm(reason.trim(), parseFloat(fineAmount) || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-red-600 rounded-t-2xl px-6 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-white text-xl">gavel</span>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-widest">Disqualify Winner</p>
            <p className="text-red-100 text-xs mt-0.5">This action is irreversible. A new winner will be automatically elevated.</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current winner being disqualified */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-2">Vendor Being Disqualified (L1)</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                <p className="font-bold text-slate-800 dark:text-white text-sm">{currentWinner.vendorName}</p>
              </div>
              <p className="font-mono font-bold text-red-700 text-sm">{fmtINR(currentWinner.amount)}</p>
            </div>
          </div>

          {/* Next winner */}
          {nextWinner ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">New Winner to be Elevated (L2)</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <p className="font-bold text-slate-800 dark:text-white text-sm">{nextWinner.vendorName}</p>
                  <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black uppercase">New Winner</span>
                </div>
                <p className="font-mono font-bold text-emerald-700 text-sm">{fmtINR(nextWinner.amount)}</p>
              </div>
              <p className="text-[10px] text-emerald-600 mt-2">An auction winner email will be automatically sent to this vendor.</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-bold text-amber-800">âš ï¸ No other eligible bidder found. Disqualification will leave the auction without a winner.</p>
            </div>
          )}

          {/* Full bid leaderboard */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Full Bid Leaderboard</p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {uniqueVendors.map((v, idx) => {
                const isL1 = v.vendorId === currentWinner.vendorId;
                const isL2 = !isL1 && nextWinner?.vendorId === v.vendorId;
                const color = vendorMap.get(v.vendorId)?.color ?? COLORS[idx % COLORS.length];
                return (
                  <div key={v.vendorId} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                    isL1 ? "bg-red-50 border-red-200 opacity-75" :
                    isL2 ? "bg-emerald-50 border-emerald-200" :
                    "bg-slate-50 border-slate-100"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className={`font-bold ${isL1 ? "text-red-700 line-through" : isL2 ? "text-emerald-700" : "text-slate-700"}`}>
                        {v.vendorName}
                      </span>
                      {isL1 && <span className="text-[9px] bg-red-500 text-white px-1 py-0.5 rounded font-black">DISQUALIFIED</span>}
                      {isL2 && <span className="text-[9px] bg-emerald-600 text-white px-1 py-0.5 rounded font-black">NEW WINNER</span>}
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-bold ${isL1 ? "text-slate-400 line-through" : isL2 ? "text-emerald-700" : "text-slate-600"}`}>
                        {fmtINR(v.amount)}
                      </span>
                      <span className="ml-2 text-[9px] font-black text-slate-400">L{idx + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reason (mandatory) */}
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
              Reason for Disqualification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setReasonError(false); }}
              placeholder="e.g. Vendor failed to respond within the required 48-hour window for final quote submission..."
              rows={3}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium text-slate-800 bg-white dark:bg-slate-800 dark:text-white resize-none focus:outline-none focus:ring-2 transition-all ${
                reasonError ? "border-red-400 ring-2 ring-red-300" : "border-slate-300 focus:ring-purple-400 focus:border-purple-400"
              }`}
            />
            {reasonError && <p className="text-xs text-red-600 mt-1 font-semibold">Reason is mandatory.</p>}
          </div>

          {/* Fine amount */}
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
              Fine / Penalty Amount (â‚¹) <span className="text-slate-400 font-normal normal-case tracking-normal text-[10px]">(optional â€” 0 if no fine)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">â‚¹</span>
              <input
                type="number"
                min="0"
                value={fineAmount}
                onChange={e => setFineAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-800 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all"
              />
            </div>
            {fineAmount && parseFloat(fineAmount) > 0 && (
              <p className="text-xs text-orange-700 mt-1 font-semibold">
                âš ï¸ A fine of â‚¹{parseFloat(fineAmount).toLocaleString("en-IN")} will be included in the disqualification email.
              </p>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !nextWinner}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">{submitting ? "progress_activity" : "gavel"}</span>
            {submitting ? "Processing..." : "Confirm Disqualification"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLiveObserver() {
  const params = useParams();
  const router = useRouter();
  const listingId = params?.id as string;
  const ledgerRef = useRef<HTMLDivElement>(null);

  const { listings } = useApp();
  const { listing, auctionBids, leaderboard, currentHighAmount, currentHighBid, formatTime: timer, isActive } = useAuction(listingId, { forceConnect: true });

  const [approving, setApproving] = useState(false);
  const [winnerApproved, setWinnerApproved] = useState(false);
  const [approvedWinnerName, setApprovedWinnerName] = useState("");

  // Disqualification state
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);
  const [disqualifying, setDisqualifying] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [newWinnerName, setNewWinnerName] = useState("");

  useEffect(() => {
    if (ledgerRef.current) ledgerRef.current.scrollTop = ledgerRef.current.scrollHeight;
  }, [auctionBids]);

  const isLoading = listings.length === 0;

  if (isLoading) return (
    <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
      <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
      <p className="text-sm font-bold">Loading auction data...</p>
    </div>
  );

  if (!listing) return (
    <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
      <span className="material-symbols-outlined text-4xl">error_outline</span>
      <p className="text-sm font-bold">Auction not found</p>
      <button onClick={() => router.push("/admin/auctions")} className="text-xs text-purple-600 underline">Back to Auctions</button>
    </div>
  );

  const basePrice = listing.basePrice || 0;
  const tickSize = listing.bidIncrement || 0;
  const fmtINR = (n: number) => `â‚¹${n.toLocaleString("en-IN")}`;

  const handleDownloadBidHistory = () => {
    const rows = [
      ["Round", "Vendor", "Amount (â‚¹)", "Timestamp"],
      ...[...auctionBids].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((bid: any, i: number) => {
        const vendorName = bid.vendorName || bid.vendor?.name || bid.vendorId;
        return [i + 1, vendorName, bid.amount, new Date(bid.createdAt).toLocaleString("en-IN")];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-bid-history-${listing.id}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build per-vendor chart lines â€” auctionBids is chronological (oldest first)
  const vendorMap = new Map<string, { id: string; name: string; color: string; points: { round: number; amount: number }[] }>();
  auctionBids.forEach((bid: any, i) => {
    if (!vendorMap.has(bid.vendorId)) {
      vendorMap.set(bid.vendorId, {
        id: bid.vendorId,
        name: bid.vendorName || bid.vendor?.name || "Unknown Vendor",
        color: COLORS[vendorMap.size % COLORS.length],
        points: [],
      });
    }
    vendorMap.get(bid.vendorId)!.points.push({ round: i + 1, amount: bid.amount });
  });
  const vendorLines = Array.from(vendorMap.values());

  // Unique participants
  const participants = vendorLines.length;
  const highVendor = currentHighBid ? (vendorMap.get(currentHighBid.vendorId)?.name ?? "â€”") : "â€”";

  // Sort leaderboard by highest bid per vendor (unique vendors)
  const uniqueLeaderboard: any[] = [];
  const seenInLeaderboard = new Set<string>();
  [...(leaderboard as any[])].sort((a, b) => b.amount - a.amount).forEach(bid => {
    if (!seenInLeaderboard.has(bid.vendorId)) {
      seenInLeaderboard.add(bid.vendorId);
      uniqueLeaderboard.push(bid);
    }
  });

  const handleDisqualify = async (reason: string, fineAmount: number) => {
    if (!currentHighBid?.vendorId) return;
    setDisqualifying(true);
    try {
      const auctionId = listing?.auctionId || listingId;
      const result = await api.patch(`/auctions/${auctionId}/disqualify-winner`, {
        disqualifiedVendorId: currentHighBid.vendorId,
        reason,
        fineAmount,
      });
      const newWinner = uniqueLeaderboard.find(v => v.vendorId !== currentHighBid.vendorId);
      setNewWinnerName(newWinner?.vendorName || newWinner?.vendor?.name || "Next Bidder");
      setDisqualified(true);
      setShowDisqualifyModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to disqualify winner. Please try again.");
    } finally {
      setDisqualifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950">

      {/* Disqualify Modal */}
      {showDisqualifyModal && currentHighBid && (
        <DisqualifyModal
          currentWinner={{
            vendorId: currentHighBid.vendorId,
            vendorName: highVendor,
            amount: currentHighBid.amount,
          }}
          leaderboard={uniqueLeaderboard}
          vendorMap={vendorMap}
          fmtINR={fmtINR}
          onConfirm={handleDisqualify}
          onCancel={() => setShowDisqualifyModal(false)}
          submitting={disqualifying}
        />
      )}

      {/* â”€â”€ Sticky Header â”€â”€ */}
      <div className="sticky top-0 z-30 bg-white border-b-2 border-purple-500 shadow-sm dark:bg-slate-900">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          {/* Admin badge */}
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg shrink-0">
            <span className="material-symbols-outlined text-purple-600 text-base">admin_panel_settings</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">Admin Observer</span>
          </div>

          {/* Live/Ended indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border shrink-0 ${isActive ? "bg-red-50 border-red-200 text-red-600" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-red-500 animate-pulse" : "bg-slate-400"}`} />
            {isActive ? "Live Now" : "Ended"}
          </div>

          {/* Title */}
          <span className="text-slate-800 font-bold text-sm truncate max-w-[220px] shrink-0 dark:text-slate-200">{listing.title}</span>

          {/* Stat pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {[
              { label: "Base", value: fmtINR(basePrice), color: "text-slate-700" },
              { label: "Current High", value: fmtINR(currentHighAmount), color: "text-emerald-700" },
              { label: "Tick", value: fmtINR(tickSize), color: "text-blue-700" },
              { label: "Bids", value: String(auctionBids.length), color: "text-slate-700" },
              { label: "Participants", value: String(participants), color: "text-purple-700" },
            ].map(p => (
              <div key={p.label} className="flex flex-col items-center px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 min-w-[80px] dark:bg-slate-950 dark:border-slate-700">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{p.label}</span>
                <span className={`font-mono font-black text-sm ${p.color}`}>{p.value}</span>
              </div>
            ))}
          </div>

          {/* Timer */}
          <div className={`shrink-0 flex flex-col items-center px-4 py-1.5 rounded-xl border ${isActive ? "bg-red-50 border-red-300" : "bg-slate-100 border-slate-200"}`}>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Time Left</span>
            <span className={`font-mono font-black text-2xl tabular-nums ${isActive ? "text-red-600" : "text-slate-400"}`}>
              {isActive ? timer : "ENDED"}
            </span>
          </div>

          <button onClick={() => router.push("/admin/listings")}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest border border-slate-200 transition-colors flex items-center gap-1 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Back
          </button>
        </div>

        {/* Status bar */}
        <div className={`py-1.5 text-center ${isActive ? "bg-purple-600" : "bg-amber-500"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">{isActive ? "visibility" : "gavel"}</span>
            {isActive
              ? "Read-only observation mode â€” bidding controls are disabled for admin"
              : "Auction ended â€” scroll down to approve the winner"}
          </p>
        </div>
      </div>

      {/* â”€â”€ Main Grid â”€â”€ */}
      <div className="max-w-[1400px] mx-auto p-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* LEFT: Chart + Ledger */}
        <div className="flex flex-col gap-5">

          {/* Bid Progression Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Real-Time Bid Progression</p>
                <p className="text-slate-800 font-bold text-sm mt-0.5 dark:text-slate-200">{auctionBids.length} bids Â· {participants} participant{participants !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {vendorLines.slice(0, 6).map(v => {
                  const rank = leaderboard.findIndex((l: any) => l.vendorId === v.id);
                  const rankLabel = rank >= 0 ? `L${rank + 1}` : 'â€”';
                  return (
                    <div key={v.id} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md dark:bg-slate-900 dark:border-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: v.color }} />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{rankLabel}: {v.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4" style={{ height: 290 }}>
              {auctionBids.length > 0 ? (
                <BidChart vendorLines={vendorLines} maxRound={auctionBids.length} basePrice={basePrice} currentHighest={currentHighAmount} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                  <span className="material-symbols-outlined text-5xl">bar_chart</span>
                  <p className="text-sm font-bold">Waiting for first bidâ€¦</p>
                </div>
              )}
            </div>
          </div>

          {/* Bid Ledger â€” full vendor names visible to admin */}
          <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-blue-500 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Bid Ledger</p>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{auctionBids.length} events</span>
            </div>
            <div ref={ledgerRef} className="overflow-y-auto p-4 space-y-1.5" style={{ maxHeight: 280 }}>
              {auctionBids.length === 0 ? (
                <div className="py-12 text-center text-slate-300">
                  <span className="material-symbols-outlined text-4xl block mb-2">history_toggle_off</span>
                  <p className="text-sm font-bold">No bids yet</p>
                </div>
              ) : [...(auctionBids as any[])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((bid, i) => {
                const isTop = leaderboard.length > 0 && leaderboard[0]?.vendorId === bid.vendorId;
                const color = vendorMap.get(bid.vendorId)?.color ?? "#CBD5E1";
                const vendorName = bid.vendorName || bid.vendor?.name || "Unknown Vendor";
                return (
                  <div key={bid.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all ${isTop ? "bg-emerald-50 border-l-4 border-emerald-500 border border-emerald-100" : "bg-white border border-slate-100 hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className={`font-bold ${isTop ? "text-emerald-700" : "text-slate-800"}`}>{vendorName}</span>
                      {isTop && <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Leader</span>}
                      <span className="text-[10px] text-slate-400 font-mono">{fmtTime(bid.createdAt)}</span>
                    </div>
                    <span className={`font-mono font-bold text-sm ${isTop ? "text-emerald-700" : "text-slate-600"}`}>{fmtINR(bid.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Lot Info + Admin Stats */}
        <div className="flex flex-col gap-5">

          {/* Lot Details */}
          <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-blue-500 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Lot Details</p>
            <div className="space-y-3">
              {[
                { icon: "inventory_2", label: "Lot ID", value: listing.id },
                { icon: "category", label: "Category", value: listing.category },
                { icon: "scale", label: "Weight", value: `${listing.weight} KG` },
                { icon: "location_on", label: "Location", value: listing.location },
                { icon: "payments", label: "EMD Amount", value: fmtINR(listing.highestEmdAmount ?? 0) },
                { icon: "person", label: "Listed By", value: listing.userName ?? "â€”" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400 text-base w-5 shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-200">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin-only stats panel */}
          <div className="bg-white rounded-2xl border border-purple-200 border-t-4 border-t-purple-500 shadow-sm p-5 dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-purple-600 text-base">admin_panel_settings</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-700">Admin Overview</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Bids", value: String(auctionBids.length), color: "text-slate-800", bg: "bg-slate-50 border-slate-200" },
                { label: "Participants", value: String(participants), color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
                { label: "Current High", value: fmtINR(currentHighAmount), color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                { label: "Base Price", value: fmtINR(basePrice), color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                { label: "Tick Size", value: fmtINR(tickSize), color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
                { label: "Premium", value: basePrice > 0 ? `+${(((currentHighAmount - basePrice) / basePrice) * 100).toFixed(1)}%` : "â€”", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
              ].map(s => (
                <div key={s.label} className={`p-3 rounded-xl border ${s.bg}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
                  <p className={`font-headline font-bold text-base mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Current leader */}
            {currentHighBid && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Current Leader</p>
                <p className="text-sm font-bold text-emerald-800">{highVendor}</p>
                <p className="text-xs font-mono text-emerald-600">{fmtINR(currentHighBid.amount)}</p>
              </div>
            )}

            {/* â”€â”€ Winner Action Section (shown when auction ends) â”€â”€ */}
            {!isActive && currentHighBid && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Auction Ended â€” Winner Action</p>

                {/* Winner info */}
                {!winnerApproved && !disqualified && (
                  <>
                    <p className="text-sm font-bold text-slate-800">{highVendor} <span className="text-emerald-600">(L1)</span></p>
                    <p className="text-xs font-mono text-slate-500 mb-1">{fmtINR(currentHighBid.amount)}</p>

                    {/* Approve button */}
                    <button
                      id="btn-approve-winner"
                      onClick={async () => {
                        if (!currentHighBid?.vendorId) return;
                        setApproving(true);
                        try {
                          const auctionId = listing?.auctionId || listingId;
                          await api.patch(`/auctions/${auctionId}/winner`, { vendorId: currentHighBid.vendorId });
                          setApprovedWinnerName(highVendor);
                          setWinnerApproved(true);
                        } catch {
                          alert('Failed to approve winner. Please try again.');
                        } finally {
                          setApproving(false);
                        }
                      }}
                      disabled={approving}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-[#1E8E3E] text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">{approving ? 'progress_activity' : 'check_circle'}</span>
                      {approving ? 'Approving...' : 'Approve Winner & Send Email'}
                    </button>

                    {/* Disqualify button */}
                    <button
                      id="btn-disqualify-winner"
                      onClick={() => setShowDisqualifyModal(true)}
                      disabled={approving}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">block</span>
                      Disqualify Winner & Elevate Next Bidder
                    </button>
                  </>
                )}

                {/* Approved state */}
                {winnerApproved && !disqualified && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                      <div>
                        <p className="text-xs font-black text-emerald-700">Winner Approved!</p>
                        <p className="text-[10px] text-emerald-600">Email sent to {approvedWinnerName || highVendor}</p>
                      </div>
                    </div>
                    <Link
                      href={`/admin/auctions/${listing.auctionId || listingId}/manage`}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">manage_accounts</span>
                      Manage Post-Auction Flow
                    </Link>
                  </div>
                )}

                {/* Disqualified & new winner elevated state */}
                {disqualified && (
                  <div className="space-y-3">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-red-600 text-base">block</span>
                        <p className="text-xs font-black text-red-700">Winner Disqualified</p>
                      </div>
                      <p className="text-[10px] text-red-600">Disqualification email sent to {highVendor}.</p>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                        <p className="text-xs font-black text-emerald-700">New Winner: {newWinnerName}</p>
                      </div>
                      <p className="text-[10px] text-emerald-600">Winner email automatically sent to {newWinnerName}.</p>
                    </div>
                    <Link
                      href={`/admin/auctions/${listing.auctionId || listingId}/manage`}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">manage_accounts</span>
                      Manage Post-Auction Flow
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Download bid history */}
          {auctionBids.length > 0 && (
            <button
              onClick={handleDownloadBidHistory}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download Bid History CSV
            </button>
          )}

          {/* Per-vendor breakdown */}
          {vendorLines.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Participant Breakdown</p>
              <div className="space-y-2">
                {vendorLines.map((v, idx) => {
                  const rank = leaderboard.findIndex((l: any) => l.vendorId === v.id);
                  const rankLabel = rank >= 0 ? `L${rank + 1}` : 'â€”';
                  const isLeader = rank === 0;
                  const topBid = v.points.length > 0 ? Math.max(...v.points.map(p => p.amount)) : 0;
                  return (
                    <div key={v.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${isLeader ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"}`}>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: v.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            rank === 0 ? 'bg-emerald-600 text-white' :
                            rank === 1 ? 'bg-blue-500 text-white' :
                            rank === 2 ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-700'
                          }`}>{rankLabel}</span>
                          <p className="text-xs font-bold text-slate-800 truncate dark:text-slate-200">{v.name}</p>
                        </div>
                        <p className="text-[10px] text-slate-400">{v.points.length} bid{v.points.length !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-mono font-bold ${isLeader ? "text-emerald-700" : "text-slate-600"}`}>{fmtINR(topBid)}</p>
                        {isLeader && <p className="text-[9px] text-emerald-600 font-black uppercase">Leader</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
