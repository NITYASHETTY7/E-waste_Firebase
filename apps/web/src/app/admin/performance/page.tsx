"use client";

import { useApp } from "@/context/AppContext";

export default function AdminPerformance() {
  const { users, listings, bids, auditInvitations } = useApp();

  const vendors = users.filter(u => u.role === "vendor");
  const clients = users.filter(u => u.role === "client");

  const getVendorStats = (vendorId: string) => {
    const vendorBids = bids.filter(b => b.vendorId === vendorId);
    const wonBids = vendorBids.filter(b => b.status === "accepted");
    const auditsDone = auditInvitations.filter(a => a.vendorId === vendorId && a.status === "completed");
    const auditsAccepted = auditInvitations.filter(a => a.vendorId === vendorId && (a.status === "accepted" || a.status === "completed"));
    const complianceCompleted = listings.filter(l => l.winnerVendorId === vendorId && l.complianceStatus === "verified");
    const winRate = vendorBids.length > 0 ? Math.round((wonBids.length / vendorBids.length) * 100) : 0;
    const totalEarnings = wonBids.reduce((s, b) => s + b.amount, 0);
    return { vendorBids, wonBids, auditsDone, auditsAccepted, complianceCompleted, winRate, totalEarnings };
  };

  const getClientStats = (clientId: string) => {
    const clientUser = users.find(u => u.id === clientId);
    const cListings = listings.filter(l => l.userId === clientId || (clientUser?.companyId && l.userId === clientUser.companyId));
    const completed = cListings.filter(l => l.status === "completed" || l.auctionPhase === "completed");
    const active = cListings.filter(l => l.status === "active");
    const totalValue = bids.filter(b => b.status === "accepted" && cListings.some(l => l.id === b.listingId)).reduce((s, b) => s + b.amount, 0);
    return { cListings, completed, active, totalValue };
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Performance Metrics</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Track vendor win rates, audit accuracy, compliance scores, and client activity.</p>
      </div>

      {/* Vendor Performance */}
      <section>
        <h3 className="text-lg font-headline font-bold text-slate-900 mb-4 dark:text-white">Vendor Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map(vendor => {
            const s = getVendorStats(vendor.id);
            return (
              <div key={vendor.id} className="card p-5 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-sm">
                    {vendor.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 leading-tight dark:text-white">{vendor.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{vendor.status}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { label: "Total Bids", value: s.vendorBids.length },
                    { label: "Bids Won", value: s.wonBids.length },
                    { label: "Win Rate", value: `${s.winRate}%` },
                    { label: "Audits Done", value: s.auditsDone.length },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-50 rounded-xl p-2.5 text-center dark:bg-slate-950">
                      <p className="text-xl font-black text-slate-900 dark:text-white">{m.value}</p>
                      <p className="text-[9px] font-bold uppercase text-slate-400">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-primary/5 rounded-xl p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Total Earnings</p>
                  <p className="text-lg font-black text-primary">₹{s.totalEarnings.toLocaleString()}</p>
                </div>

                {/* Win rate bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
                    <span>Win Rate</span><span>{s.winRate}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${s.winRate}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Client Activity */}
      <section>
        <h3 className="text-lg font-headline font-bold text-slate-900 mb-4 dark:text-white">Client Activity</h3>
        <div className="card overflow-hidden border border-slate-100 dark:border-slate-800">
          <div className="divide-y divide-slate-100">
            <div className="p-4 grid grid-cols-5 gap-4 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest dark:bg-slate-950">
              <span>Client</span>
              <span className="text-center">Total Listings</span>
              <span className="text-center">Completed</span>
              <span className="text-center">Active</span>
              <span className="text-right">Total Value Recovered</span>
            </div>
            {clients.map(client => {
              const s = getClientStats(client.id);
              return (
                <div key={client.id} className="p-4 grid grid-cols-5 gap-4 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{client.name}</p>
                    <p className="text-xs text-slate-400">{client.email}</p>
                  </div>
                  <p className="text-center font-black text-slate-900 dark:text-white">{s.cListings.length}</p>
                  <p className="text-center font-black text-emerald-600">{s.completed.length}</p>
                  <p className="text-center font-black text-blue-600">{s.active.length}</p>
                  <p className="text-right font-black text-primary">₹{s.totalValue.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
