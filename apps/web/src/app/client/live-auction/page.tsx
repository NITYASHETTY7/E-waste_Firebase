"use client";

import { Suspense } from "react";
import { useApp } from "@/context/AppContext";
import LiveAuctionEmbed from "@/components/auction/LiveAuctionEmbed";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ClientLiveAuctionPageContent() {
  const { listings } = useApp();
  const searchParams = useSearchParams();
  const listingId = searchParams.get("id");

  const liveListings = listings.filter(l => l.auctionPhase === 'live');
  
  const activeListing = listingId 
    ? liveListings.find(l => l.id === listingId)
    : liveListings[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8">
      <div className="flex flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-end px-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight dark:text-white">Live <span className="text-red-600 uppercase">Monitoring</span></h1>
            <p className="text-slate-500 font-medium">Real-time oversight of active bidding floors.</p>
          </div>
          {liveListings.length > 1 && (
            <div className="flex gap-2">
              <select 
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/20 dark:bg-slate-900 dark:border-slate-700"
                onChange={(e) => window.location.href = `/client/live-auction?id=${e.target.value}`}
                value={activeListing?.id || ""}
              >
                {liveListings.map(l => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {activeListing ? (
          <LiveAuctionEmbed listing={activeListing} userRole="client" />
        ) : (
          <div className="max-w-7xl mx-auto w-full">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-20 text-center dark:bg-slate-900 dark:border-slate-700">
              <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">sensors_off</span>
              <h3 className="text-xl font-bold text-slate-900 mb-2 dark:text-white">No Live Auctions</h3>
              <p className="text-slate-500 mb-6">You don't have any active live auctions right now.</p>
              <Link href="/client/listings" className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">Go to Inventory</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientLiveAuctionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-slate-950"><div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin"></div></div>}>
      <ClientLiveAuctionPageContent />
    </Suspense>
  );
}
