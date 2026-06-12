"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate } from "@/utils/format";
import DecisionModal from "@/components/admin/DecisionModal";

function exportCSV(bids: any[], listings: any[]) {
  const clean = (val: any) => {
    if (val === undefined || val === null) return "";
    return String(val).replace(/,/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
  };

  const header = ["Bid ID", "Listing Title", "Material Category", "Weight (KG)", "Vendor Name", "Bid Amount (INR)", "Bid Status", "Date Submitted"];
  const rows = bids.map(bid => {
    const listing = listings.find(l => l.id === bid.listingId);
    return [
      bid.id,
      clean(listing?.title || "Unknown"),
      clean(listing?.category || "—"),
      listing?.weight || 0,
      clean(bid.vendorName),
      bid.amount,
      bid.status.toUpperCase(),
      new Date(bid.createdAt).toLocaleDateString('en-IN'),
    ];
  });

  const csv = [header, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `weconnect_bids_report_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminBidding() {
  const { bids, listings, updateBidStatus, editBid } = useApp();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [decisionModal, setDecisionModal] = useState<{ isOpen: boolean; bidId: string | null }>({ isOpen: false, bidId: null });

  const filtered = bids
    .filter(b => statusFilter === "all" || b.status === statusFilter)
    .filter(b => {
      const listing = listings.find(l => l.id === b.listingId);
      return (b.vendorName?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (listing?.title?.toLowerCase() || "").includes(search.toLowerCase());
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalBids = bids.length;
  const acceptedBids = bids.filter(b => b.status === "accepted");
  const pendingBids = bids.filter(b => b.status === "pending");
  const totalVolume = acceptedBids.reduce((s, b) => s + b.amount, 0);
  const highestValue = acceptedBids.length > 0 ? Math.max(...acceptedBids.map(b => b.amount)) : 0;
  const successRate = totalBids > 0 ? Math.round((acceptedBids.length / totalBids) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Bids</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Monitor all bidding activity and financial settlements across the platform.</p>
        </div>
        <button onClick={() => exportCSV(bids, listings)}
          className="flex items-center gap-2 bg-[color:var(--color-secondary-container)] text-[color:var(--color-on-secondary-container)] px-5 py-2.5 rounded-xl font-bold hover:opacity-80 transition-opacity text-sm">
          <span className="material-symbols-outlined text-lg">download</span>
          Export CSV
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bids", value: totalBids, icon: "gavel", sub: `${pendingBids.length} pending`, color: "text-[color:var(--color-primary)]", bg: "bg-[color:var(--color-secondary-container)]" },
          { label: "Settled Volume", value: `₹${(totalVolume / 100000).toFixed(1)}L`, icon: "payments", sub: `${acceptedBids.length} completed`, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Highest Bid", value: `₹${(highestValue / 1000).toFixed(0)}K`, icon: "trending_up", sub: "Single transaction", color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Success Rate", value: `${successRate}%`, icon: "verified", sub: "Bids that got accepted", color: "text-amber-700", bg: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className="card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-xl ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-headline font-extrabold text-[color:var(--color-on-surface)]">{s.value}</p>
              <p className="text-[10px] font-bold text-[color:var(--color-on-surface-variant)] uppercase tracking-widest">{s.label}</p>
              <p className="text-[10px] text-[color:var(--color-on-surface-variant)]">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex gap-1 p-1 bg-surface-container-low rounded-xl border border-outline-variant/10">
          {(["all", "pending", "accepted", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                statusFilter === f 
                  ? "bg-primary text-white shadow-md scale-[1.02]" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
              }`}>
              {f} ({f === "all" ? bids.length : bids.filter(b => b.status === f).length})
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input placeholder="Search vendor or listing..." className="input-base !pl-11 h-10 text-sm w-72"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr className="bg-[color:var(--color-inverse-surface)]">
              {["Bid ID", "Listing", "Vendor", "EMD Status", "Amount", "Date", "Status", "Actions"].map(h => (
                <th key={h} className="text-white/70 text-[10px] font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(bid => {
              const listing = listings.find(l => l.id === bid.listingId);
              return (
                <tr key={bid.id} className="hover:border-l-4 hover:border-l-emerald-500 hover:bg-emerald-500/[0.02] border-l-4 border-l-transparent transition-all group">
                  <td className="font-mono text-xs text-slate-500 font-medium tracking-tight group-hover:text-emerald-600 transition-colors pl-4">#{bid.id.slice(0, 6)}</td>
                  <td>
                    <p className="font-bold text-sm text-[color:var(--color-on-surface)] max-w-[160px] truncate">{listing?.title || "Unknown"}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{listing?.weight} KG</p>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-[10px] text-slate-500">
                        {bid.vendorName.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="font-bold text-sm text-[color:var(--color-on-surface)]">{bid.vendorName}</p>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${bid.emdPaid ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${bid.emdPaid ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"}`}>
                          EMD {bid.emdPaid ? "VERIFIED" : "PENDING"}
                        </span>
                      </div>
                      {listing?.highestEmdAmount && !bid.emdPaid && (
                        <p className="text-[9px] font-bold text-slate-400 italic">Expected: ₹{listing.highestEmdAmount.toLocaleString()}</p>
                      )}
                    </div>
                  </td>
                  <td className="font-headline font-bold text-slate-900 dark:text-white">₹{bid.amount.toLocaleString()}</td>
                  <td className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(bid.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${bid.status === "accepted" ? "bg-emerald-500" : bid.status === "pending" ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${bid.status === "accepted" ? "text-emerald-600" : bid.status === "pending" ? "text-amber-600" : "text-red-600"}`}>
                        {bid.status}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {!bid.emdPaid && (
                        <button onClick={() => editBid(bid.id, { emdPaid: true })}
                          className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all" title="Confirm EMD Receipt">
                          <span className="material-symbols-outlined text-sm">payments</span>
                        </button>
                      )}
                      {bid.status === "pending" && bid.emdPaid && (
                        <button onClick={() => setDecisionModal({ isOpen: true, bidId: bid.id })}
                          className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-950/30 hover:text-white transition-all" title="Review Bid">
                          <span className="material-symbols-outlined text-sm">fact_check</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400 italic">No transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Decision Modal */}
      {decisionModal.bidId && (
        <DecisionModal
          isOpen={decisionModal.isOpen}
          onClose={() => setDecisionModal({ isOpen: false, bidId: null })}
          title="Bid Review Decision"
          itemDetails={[
            { label: "Vendor", value: bids.find(b => b.id === decisionModal.bidId)?.vendorName || "" },
            { label: "Amount", value: `₹${(bids.find(b => b.id === decisionModal.bidId)?.amount || 0).toLocaleString()}` },
            { label: "Listing", value: listings.find(l => l.id === bids.find(b => b.id === decisionModal.bidId)?.listingId)?.title || "" }
          ]}
          onConfirm={(status, reason) => {
            if (decisionModal.bidId) {
              updateBidStatus(decisionModal.bidId, status, reason);
              setDecisionModal({ isOpen: false, bidId: null });
            }
          }}
          actions={[
            { label: "Accept Bid (Winner)", status: "accepted", color: "#1E8E3E" },
            { label: "Reject Bid", status: "rejected", color: "#ef4444", requireReason: true }
          ]}
        />
      )}
    </div>
  );
}
