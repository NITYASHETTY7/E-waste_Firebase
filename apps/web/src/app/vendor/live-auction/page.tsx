"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function VendorLiveAuctionPage() {
  const router = useRouter();
  const { listings, currentUser } = useApp();

  const liveAuctions = listings.filter(l =>
    l.auctionPhase === 'live' &&
    (
      l.invitedVendorIds?.includes(currentUser?.id || "") ||
      l.auditApprovedVendorIds?.includes(currentUser?.id || "")
    )
  );

  const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  if (liveAuctions.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-headline font-extrabold text-[color:var(--color-on-surface)]">Live Auctions</h1>
          <p className="text-[color:var(--color-on-surface-variant)] text-sm mt-1">Participate in real-time bidding for verified e-waste lots.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-20 text-center dark:bg-slate-900">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">sensors_off</span>
          <p className="text-slate-500 font-bold">No live auction is currently active for your account.</p>
          <p className="text-slate-400 text-sm mt-1">You'll be notified when a live auction you're approved for begins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
      <div>
        <h1 className="text-2xl font-headline font-extrabold text-[color:var(--color-on-surface)]">Live Auctions</h1>
        <p className="text-[color:var(--color-on-surface-variant)] text-sm mt-1">Select an active auction to enter the War Room and place your bids.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {liveAuctions.map(auction => (
          <div key={auction.id} className="bg-white border-t-4 border-t-[#1E8E3E] rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col gap-4 dark:bg-slate-900 dark:border-slate-700">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-[#1E8E3E] bg-[#E8F5E9] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1E8E3E] animate-pulse" /> LIVE
                </span>
                <span className="text-[10px] text-slate-500 font-bold">{auction.category}</span>
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{auction.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{auction.location} • {auction.weight} KG</p>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-3 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Base Price</p>
                <p className="font-mono font-bold text-[#0B5ED7]">{fmtINR(auction.basePrice || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">EMD Paid</p>
                <p className="font-mono font-bold text-slate-700 dark:text-slate-300">Yes</p>
              </div>
            </div>

            <button
              onClick={() => router.push(`/vendor/auctions/${auction.id}/live`)}
              className="mt-auto w-full py-2.5 bg-[#1E8E3E] hover:bg-green-700 text-white rounded-lg font-black text-xs uppercase tracking-widest transition-all"
            >
              Enter War Room
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
