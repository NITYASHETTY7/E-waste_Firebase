"use client";

import { useApp } from "@/context/AppContext";
import { formatDate } from "@/utils/format";

export default function VendorReports() {
  const { bids, listings, currentUser } = useApp();

  const myBids = bids.filter(b => b.vendorId === currentUser?.id);
  const wonBids = myBids.filter(b => b.status === "accepted");
  const lostBids = myBids.filter(b => b.status === "rejected");
  const pendingBids = myBids.filter(b => b.status === "pending");

  // Logic: Calculate Winning Rate
  const winRate = myBids.length > 0 ? Math.round((wonBids.length / myBids.length) * 100) : 0;
  const totalAquisitionValue = wonBids.reduce((s, b) => s + b.amount, 0);

  // Logic: Material Purchased Category Breakdown
  const categoryMap: Record<string, number> = {};
  wonBids.forEach(bid => {
    const listing = listings.find(l => l.id === bid.listingId);
    if (listing) {
      categoryMap[listing.category] = (categoryMap[listing.category] || 0) + listing.weight;
    }
  });

  const materialData = Object.entries(categoryMap).map(([label, kg], i) => ({
    label, kg,
    color: ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"][i % 5]
  }));

  const maxKg = Math.max(...materialData.map(d => d.kg), 1);
  const totalKg = materialData.reduce((s, d) => s + d.kg, 0);

  const handleDownload = (name: string) => alert(`Downloading ${name}...`);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-headline font-extrabold tracking-tight text-slate-900 dark:text-white">Vendor Performance Audit</h2>
           <p className="text-slate-500 mt-1">Winning rates, acquisition history, and compliance documentation.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => handleDownload("Full Audit Pack")} className="btn-outline flex items-center gap-2 text-sm">
             <span className="material-symbols-outlined text-sm">inventory</span>
             Download Work Orders
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Winning Rate Card */}
         <div className="card p-6 flex flex-col justify-between h-48 border-t-4 border-t-emerald-500">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Winning Rate</p>
               <h3 className="text-4xl font-headline font-bold text-slate-900 dark:text-white">{winRate}%</h3>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden dark:bg-slate-800">
               <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${winRate}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">{wonBids.length} Wins / {myBids.length} Participated</p>
         </div>

         {/* Material Purchased Card */}
         <div className="card p-6 flex flex-col justify-between h-48 border-t-4 border-t-blue-500">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Material Purchased</p>
               <h3 className="text-4xl font-headline font-bold text-slate-900 dark:text-white">{totalKg.toLocaleString()} <span className="text-lg font-bold text-slate-400">KG</span></h3>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Across {wonBids.length} successful auctions</p>
         </div>

         {/* Payment History Summary */}
         <div className="card p-6 flex flex-col justify-between h-48 border-t-4 border-t-amber-500">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Payment Outflow</p>
               <h3 className="text-4xl font-headline font-bold text-slate-900 dark:text-white">₹{(totalAquisitionValue / 1000).toFixed(1)}K</h3>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Includes settled and pending settlements</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Material Categories Detail */}
         <div className="card p-8">
            <h4 className="font-headline font-bold text-slate-900 mb-8 dark:text-white">Material Breakdown by Category</h4>
            {materialData.length > 0 ? (
               <div className="space-y-6">
                  {materialData.map(m => (
                     <div key={m.label}>
                        <div className="flex justify-between text-xs font-bold mb-2">
                           <span className="text-slate-600 dark:text-slate-400">{m.label}</span>
                           <span className="text-slate-900 dark:text-white">{m.kg} KG</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                           <div className={`h-full ${m.color} rounded-full`} style={{ width: `${(m.kg / maxKg) * 100}%` }} />
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-950 dark:border-slate-700">
                  <p className="text-slate-400 text-sm font-bold">No acquisition data available yet.</p>
               </div>
            )}
         </div>

         {/* Payment Ledger / History */}
         <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
               <h4 className="font-headline font-bold text-slate-900 dark:text-white">Payment History Ledger</h4>
               <button onClick={() => handleDownload("Payment History")} className="text-[10px] font-black uppercase text-blue-600 hover:underline">Track Payments</button>
            </div>
            <div className="space-y-4">
               {wonBids.length > 0 ? wonBids.map(bid => {
                  const listing = listings.find(l => l.id === bid.listingId);
                  return (
                     <div key={bid.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                        <div>
                           <p className="font-bold text-slate-800 text-sm dark:text-slate-200">{listing?.title || "Auction Item"}</p>
                           <p className="text-[10px] text-slate-500 font-bold uppercase">{formatDate(bid.createdAt)}</p>                        </div>
                        <div className="text-right">
                           <p className="font-bold text-emerald-600">₹{bid.amount.toLocaleString()}</p>
                           <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">Paid</span>
                        </div>
                     </div>
                  )
               }) : (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl dark:border-slate-800">
                     <p className="text-slate-300 text-sm font-bold italic">No payment history recorded.</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
