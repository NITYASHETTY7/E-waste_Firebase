"use client";

import { useApp } from "@/context/AppContext";
import { formatDate } from "@/utils/format";

export default function VendorAnalytics() {
  const { bids, listings, currentUser } = useApp();

  const myBids = bids.filter(b => b.vendorId === currentUser?.id);
  const won = myBids.filter(b => b.status === "accepted");
  const lost = myBids.filter(b => b.status === "rejected");
  const pending = myBids.filter(b => b.status === "pending");
  const totalEarned = won.reduce((s, b) => s + b.amount, 0);
  const avgBid = myBids.length > 0 ? Math.round(myBids.reduce((s, b) => s + b.amount, 0) / myBids.length) : 0;
  const winRate = myBids.length > 0 ? Math.round((won.length / myBids.length) * 100) : 0;

  // Category distribution
  const categoryCounts: Record<string, number> = {};
  myBids.forEach(bid => {
    const listing = listings.find(l => l.id === bid.listingId);
    if (listing) categoryCounts[listing.category] = (categoryCounts[listing.category] || 0) + 1;
  });
  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...categories.map(c => c[1]), 1);

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Analytics & Performance</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Your bidding performance and earnings overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: "Total Bids", value: myBids.length, icon: "gavel", sub: `${pending.length} active` },
          { label: "Win Rate", value: `${winRate}%`, icon: "military_tech", sub: `${won.length} won`, primary: true },
          { label: "Avg Bid", value: `₹${avgBid.toLocaleString()}`, icon: "trending_up", sub: "Per listing" },
          { label: "Total Earnings", value: `₹${(totalEarned / 1000).toFixed(1)}K`, icon: "payments", sub: "From won bids" },
        ].map(k => (
          k.primary ? (
            <div key={k.label} className="metric-card-primary">
              <div className="flex justify-between items-start text-[color:var(--color-primary-fixed)]">
                <span className="material-symbols-outlined text-2xl">{k.icon}</span>
              </div>
              <div className="mt-4">
                <p className="text-4xl font-headline font-bold text-white">{k.value}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--color-primary-fixed)] mt-1">{k.label}</p>
                <p className="text-xs text-[color:var(--color-primary-fixed-dim)] mt-0.5">{k.sub}</p>
              </div>
            </div>
          ) : (
            <div key={k.label} className="metric-card">
              <span className="material-symbols-outlined text-[color:var(--color-primary-container)] text-2xl">{k.icon}</span>
              <div className="mt-4">
                <p className="text-4xl font-headline font-bold">{k.value}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--color-on-surface-variant)] mt-1">{k.label}</p>
                <p className="text-xs text-[color:var(--color-on-surface-variant)] mt-0.5">{k.sub}</p>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Bid Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-headline font-bold text-lg text-[color:var(--color-on-surface)] mb-5">Bid Status Breakdown</h3>
          {myBids.length === 0 ? (
            <p className="text-[color:var(--color-on-surface-variant)] text-sm text-center py-8">No bids yet. Go to the marketplace to start bidding.</p>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Won", count: won.length, color: "bg-[color:var(--color-primary)]", textColor: "text-[color:var(--color-primary)]" },
                { label: "Pending", count: pending.length, color: "bg-amber-400", textColor: "text-amber-700" },
                { label: "Lost", count: lost.length, color: "bg-red-400", textColor: "text-red-600" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-xs font-black uppercase tracking-widest ${item.textColor}`}>{item.label}</span>
                    <span className="text-sm font-bold text-[color:var(--color-on-surface)]">{item.count}</span>
                  </div>
                  <div className="h-2.5 bg-[color:var(--color-surface-dim)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-700`}
                      style={{ width: myBids.length > 0 ? `${(item.count / myBids.length) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card p-6">
          <h3 className="font-headline font-bold text-lg text-[color:var(--color-on-surface)] mb-5">Bids by Category</h3>
          {categories.length === 0 ? (
            <p className="text-[color:var(--color-on-surface-variant)] text-sm text-center py-8">No bid data yet.</p>
          ) : (
            <div className="space-y-3">
              {categories.map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-bold text-[color:var(--color-on-surface)]">{cat}</span>
                    <span className="text-xs font-bold text-[color:var(--color-on-surface-variant)]">{count}</span>
                  </div>
                  <div className="h-2 bg-[color:var(--color-surface-dim)] rounded-full overflow-hidden">
                    <div className="h-full bg-[color:var(--color-secondary)] rounded-full transition-all duration-700"
                      style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bid History Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-[color:var(--color-outline-variant)]/20">
          <h3 className="font-headline font-bold text-lg text-[color:var(--color-on-surface)]">Bid History</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr className="bg-[color:var(--color-inverse-surface)]">
              {["Listing", "Category", "Bid Amount", "Date", "Status"].map(h => (
                <th key={h} className="text-white/70 text-[10px] font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {myBids.slice(0, 10).map(bid => {
              const listing = listings.find(l => l.id === bid.listingId);
              return (
                <tr key={bid.id} className="hover:bg-slate-50 transition-colors">
                  <td className="font-bold text-sm text-[color:var(--color-on-surface)]">{listing?.title || "—"}</td>
                  <td className="text-sm text-[color:var(--color-on-surface-variant)]">{listing?.category || "—"}</td>
                  <td className="font-headline font-bold text-[color:var(--color-primary)]">₹{bid.amount.toLocaleString()}</td>
                  <td className="text-xs text-[color:var(--color-on-surface-variant)]">{formatDate(bid.createdAt)}</td>
                  <td>
                    <span className={`pill ${bid.status === "accepted" ? "pill-success" : bid.status === "rejected" ? "pill-error" : "pill-warning"}`}>
                      {bid.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {myBids.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400 italic">No bids placed yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
