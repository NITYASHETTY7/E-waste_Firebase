"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate } from "@/utils/format";

export default function ClientReports() {
  const { listings, bids, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<"sales" | "vendors">("sales");

  // Filter listings and bids for current client
  const myListings = listings.filter(l => l.userId === currentUser?.id || (l.userId === currentUser?.companyId && currentUser?.companyId));
  const myCompletedListings = myListings.filter(l => l.status === "completed" || l.auctionPhase === "completed");
  
  // Sales Calculation
  const totalRevenue = bids
    .filter(b => b.status === "accepted" && myListings.some(l => l.id === b.listingId))
    .reduce((sum, b) => sum + b.amount, 0);

  const totalWeight = myCompletedListings.reduce((sum, l) => sum + l.weight, 0);

  // Vendor Comparison Logic: Group bids by vendor for the client's listings
  const vendorPerformance = Array.from(
    bids.filter(b => myListings.some(l => l.id === b.listingId))
    .reduce((acc, bid) => {
       const existing = acc.get(bid.vendorId) || { name: bid.vendorName, count: 0, highest: 0, total: 0 };
       existing.count += 1;
       existing.total += bid.amount;
       if (bid.amount > existing.highest) existing.highest = bid.amount;
       acc.set(bid.vendorId, existing);
       return acc;
    }, new Map<string, any>())
  ).map(([id, stats]) => ({ id, ...stats }));

  const handleDownload = (name: string, vendorId?: string) => {
    if (vendorId) {
      const vendorBids = bids.filter(b => b.vendorId === vendorId && myListings.some(l => l.id === b.listingId));
      let csv = "Lot ID,Date,Amount,Status\n";
      vendorBids.forEach(b => {
        csv += `${b.listingId},${new Date(b.createdAt).toLocaleDateString()},${b.amount},${b.status}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.csv`;
      a.click();
    } else {
      let csv = "Lot ID,Category,Winning Vendor,Weight,Settlement Price\n";
      myCompletedListings.forEach(l => {
        const win = bids.find(b => b.listingId === l.id && b.status === "accepted");
        csv += `${l.id},${l.category},${win?.vendorName || "Platform Audit"},${l.weight},${win?.amount || l.basePrice}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.csv`;
      a.click();
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Client Intelligence</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Audit your e-waste lifecycle, revenue growth, and compliance status.</p>
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
          {[
            { id: "sales", label: "Sales Report", icon: "payments" },
            { id: "vendors", label: "Vendor Comparison", icon: "compare_arrows" }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "sales" && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 border-l-4 border-l-emerald-500">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Disposal Revenue</p>
               <h3 className="text-3xl font-headline font-bold text-slate-900 dark:text-white">₹{totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="card p-6 border-l-4 border-l-blue-500">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Weight Diverted</p>
               <h3 className="text-3xl font-headline font-bold text-slate-900 dark:text-white">{totalWeight.toLocaleString()} KG</h3>
            </div>
            <div className="card p-6 border-l-4 border-l-amber-500">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Successful Lots</p>
               <h3 className="text-3xl font-headline font-bold text-slate-900 dark:text-white">{myCompletedListings.length}</h3>
            </div>
          </div>

          <div className="card p-8">
             <div className="flex items-center justify-between mb-8">
                <h4 className="font-headline font-bold text-slate-900 dark:text-white">Lot Settlement History</h4>
                <button onClick={() => handleDownload("Full Sales Report")} className="btn-outline px-4 py-1.5 text-[10px] font-black uppercase">Export CSV</button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest dark:bg-slate-950">
                      <tr>
                         <th className="p-4">Lot ID</th>
                         <th className="p-4">Category</th>
                         <th className="p-4">Winning Vendor</th>
                         <th className="p-4 text-right">Weight</th>
                         <th className="p-4 text-right">Settlement Price</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {myCompletedListings.map(listing => {
                         const winningBid = bids.find(b => b.listingId === listing.id && b.status === "accepted");
                         return (
                            <tr key={listing.id} className="hover:bg-slate-50 transition-colors">
                               <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{listing.id.split('-')[0]}</td>
                               <td className="p-4 text-xs text-slate-500">{listing.category}</td>
                               <td className="p-4 font-bold text-blue-600">{winningBid?.vendorName || "Platform Audit"}</td>
                               <td className="p-4 text-right font-mono">{listing.weight} KG</td>
                               <td className="p-4 text-right font-bold text-slate-900 dark:text-white">₹{winningBid?.amount.toLocaleString() || listing.basePrice?.toLocaleString()}</td>
                            </tr>
                         );
                      })}
                      {myCompletedListings.length === 0 && (
                        <tr><td colSpan={5} className="p-12 text-center text-slate-400 italic">No completed sales yet.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === "vendors" && (
        <div className="space-y-8 animate-fade-in">
           <div className="card p-8">
              <h4 className="font-headline font-bold text-slate-900 mb-6 dark:text-white">Bidder Aggregation & Comparison</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {vendorPerformance.map(v => (
                    <div key={v.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group dark:bg-slate-950 dark:border-slate-800">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mt-10 -mr-10 transition-transform group-hover:scale-150" />
                       <p className="text-lg font-headline font-bold text-slate-900 mb-4 dark:text-white">{v.name}</p>
                       <div className="grid grid-cols-2 gap-4 relative z-10">
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Bids Placed</p>
                             <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{v.count}</p>
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Highest Bid Seen</p>
                             <p className="text-xl font-bold text-emerald-600">₹{v.highest.toLocaleString()}</p>
                          </div>
                       </div>
                       <button onClick={() => handleDownload(`${v.name} Performance`, v.id)} className="mt-6 w-full py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all dark:bg-slate-900 dark:border-slate-700">Audit Interaction</button>
                    </div>
                 ))}
                 {vendorPerformance.length === 0 && (
                    <div className="col-span-2 p-20 text-center border-2 border-dashed border-slate-200 rounded-3xl dark:border-slate-700">
                       <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">analytics</span>
                       <p className="text-slate-400 font-bold">No vendor data available yet.</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}


    </div>
  );
}
