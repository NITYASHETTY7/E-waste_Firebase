"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function VendorLiveAuctionPage() {
  const router = useRouter();
  const { listings, currentUser } = useApp();

  const liveAuction = listings.find(l =>
    l.auctionPhase === 'live' &&
    (
      l.invitedVendorIds?.includes(currentUser?.id || "") ||
      l.auditApprovedVendorIds?.includes(currentUser?.id || "")
    )
  );

  useEffect(() => {
    if (liveAuction) {
      router.replace(`/vendor/auctions/${liveAuction.id}/live`);
    }
  }, [liveAuction, router]);

  if (liveAuction) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-headline font-extrabold text-[color:var(--color-on-surface)]">Live Auction</h1>
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
