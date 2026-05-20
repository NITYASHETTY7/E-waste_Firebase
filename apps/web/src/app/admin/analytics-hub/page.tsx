"use client";

import { useApp } from "@/context/AppContext";

export default function AdminAnalyticsHub() {
  const { listings, bids, users } = useApp();

  const totalRevenue = bids.filter(b => b.status === "accepted").reduce((s, b) => s + b.amount, 0);
  const commission = Math.round(totalRevenue * 0.05);
  const completedDeals = listings.filter(l => l.auctionPhase === "completed").length;
  const activeAuctions = listings.filter(l => l.auctionPhase === "live").length;
  const totalListings = listings.length;
  const totalVendors = users.filter(u => u.role === "vendor" && u.status === "active").length;
  const totalClients = users.filter(u => u.role === "client" && u.status === "active").length;
  const pendingApprovals = users.filter(u => u.status === "pending").length;

  const categoryStats = listings.reduce((acc, l) => {
    acc[l.category] = (acc[l.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
  const maxCat = sortedCategories[0]?.[1] || 1;

  const monthlyData = (() => {
    const months: Record<string, number> = {};
    bids.filter(b => b.status === "accepted").forEach(b => {
      const m = new Date(b.createdAt).toLocaleString("en-IN", { month: "short", year: "2-digit" });
      months[m] = (months[m] || 0) + b.amount;
    });
    return Object.entries(months).slice(-6);
  })();
  const maxMonth = Math.max(...monthlyData.map(([, v]) => v), 1);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Analytics Hub</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Platform-wide revenue, deal velocity, and category breakdown.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `₹${(totalRevenue / 100000).toFixed(1)}L`, sub: "Accepted bids", icon: "payments", color: "bg-primary text-white" },
          { label: "Commission Earned", value: `₹${(commission / 1000).toFixed(0)}K`, sub: "5% platform fee", icon: "percent", color: "bg-blue-600 text-white" },
          { label: "Completed Deals", value: completedDeals, sub: "Closed auctions", icon: "handshake", color: "bg-purple-600 text-white" },
          { label: "Live Now", value: activeAuctions, sub: "Active auctions", icon: "sensors", color: "bg-red-600 text-white" },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl p-5 ${k.color}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-3xl font-black">{k.value}</p>
                <p className="text-sm font-bold mt-1 opacity-90">{k.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{k.sub}</p>
              </div>
              <span className="material-symbols-outlined text-2xl opacity-80">{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue by month */}
        <div className="card p-5 border border-slate-100 dark:border-slate-800">
          <h3 className="font-headline font-bold text-slate-900 mb-4 dark:text-white">Monthly Revenue (Accepted Bids)</h3>
          {monthlyData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          ) : (
            <div className="space-y-2">
              {monthlyData.map(([month, val]) => (
                <div key={month} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-16 shrink-0">{month}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden dark:bg-slate-800">
                    <div className="h-full bg-primary rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: `${Math.max((val / maxMonth) * 100, 5)}%` }}>
                      <span className="text-[9px] font-black text-white">₹{(val / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="card p-5 border border-slate-100 dark:border-slate-800">
          <h3 className="font-headline font-bold text-slate-900 mb-4 dark:text-white">Top E-Waste Categories</h3>
          <div className="space-y-2">
            {sortedCategories.slice(0, 8).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 w-32 truncate shrink-0">{cat}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden dark:bg-slate-800">
                  <div className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(count / maxCat) * 100}%` }}>
                    <span className="text-[9px] font-black text-white">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Listings", value: totalListings, icon: "inventory_2", color: "text-blue-600 bg-blue-50" },
          { label: "Active Vendors", value: totalVendors, icon: "recycling", color: "text-primary bg-primary/10" },
          { label: "Active Clients", value: totalClients, icon: "business", color: "text-purple-600 bg-purple-50" },
          { label: "Pending Approvals", value: pendingApprovals, icon: "pending", color: "text-amber-600 bg-amber-50" },
        ].map(s => (
          <div key={s.label} className="card p-5 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <span className="material-symbols-outlined text-lg">{s.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-black text-[color:var(--color-on-surface)]">{s.value}</p>
                <p className="text-xs text-[color:var(--color-on-surface-variant)] font-medium">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
