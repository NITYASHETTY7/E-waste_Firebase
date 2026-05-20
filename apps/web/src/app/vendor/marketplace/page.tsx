"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Listing } from "@/types";
import Link from "next/link";
import { formatDate } from "@/utils/format";

export default function VendorMarketplace() {
  const { listings, bids, currentUser } = useApp();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  
  // Tab State
  const [tab, setTab] = useState<"ongoing" | "future" | "past">("ongoing");

  const now = new Date();

  const getAuctionStatus = (listing: Listing) => {
    if (listing.auctionPhase === 'completed') return "past";
    if (listing.auctionPhase === 'live') {
      if (listing.auctionEndDate && now > new Date(listing.auctionEndDate)) return "past";
      return "ongoing";
    }
    if (!listing.auctionStartDate || !listing.auctionEndDate) return "ongoing";
    const start = new Date(listing.auctionStartDate);
    const end = new Date(listing.auctionEndDate);
    if (now < start) return "future";
    if (now > end) return "past";
    return "ongoing";
  };

  const activeListings = listings.filter(l => l.status === "active" || l.status === "completed");
  const categories = ["All", ...Array.from(new Set(activeListings.map(l => l.category)))];

  const filtered = activeListings.filter(l => {
    const status = getAuctionStatus(l);
    if (status !== tab) return false;

    const matchSearch = l.title.toLowerCase().includes(search.toLowerCase()) || l.location.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || l.category === category;
    return matchSearch && matchCat;
  });

  const getRequiredBid = (listing: Listing) => {
    const listingBids = bids.filter(b => b.listingId === listing.id);
    const topBid = listingBids.sort((a, b) => b.amount - a.amount)[0];
    return topBid ? topBid.amount + (listing.bidIncrement || 0) : (listing.basePrice || 0);
  };

  const TopBid = (listingId: string) => {
      const listingBids = bids.filter(b => b.listingId === listingId);
      return listingBids.sort((a, b) => b.amount - a.amount)[0];
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">E-Waste Listings</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Browse past, ongoing, and future time-bound e-auctions.</p>
      </div>

      {/* Primary Tabs */}
      <div className="flex gap-1 p-1 bg-[color:var(--color-surface-container-low)] rounded-xl w-fit mb-4">
        {(["past", "ongoing", "future"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-8 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              tab === t ? "bg-white text-[color:var(--color-on-surface)] shadow-sm" : "text-[color:var(--color-on-surface-variant)]"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input className="input-base pl-10 h-11" placeholder="Search by title, location..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(cat => (
             <button key={cat} onClick={() => setCategory(cat)}
               className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                 category === cat
                   ? "bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)]"
                   : "bg-white text-[color:var(--color-on-surface-variant)] border-[color:var(--color-outline-variant)] hover:border-[color:var(--color-primary)]/30"
               }`}>
               {cat}
             </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--color-on-surface-variant)]">
           <strong className="text-[color:var(--color-on-surface)]">{filtered.length}</strong> {tab} auctions
        </p>
      </div>

      {/* Listing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(listing => {
          const topBid = TopBid(listing.id);
          const alreadyBid = bids.some(b => b.listingId === listing.id && b.vendorId === currentUser?.id);
          const requiredBidAmount = getRequiredBid(listing);
          const isOngoing = tab === "ongoing";
          const isFuture = tab === "future";

          return (
            <Link key={listing.id} href={`/vendor/marketplace/${listing.id}`} className="card p-0 flex flex-col hover:shadow-lg transition-all group overflow-hidden border border-transparent hover:border-[color:var(--color-primary)]/30">
               {listing.images && listing.images.length > 0 && (
                 <div className="w-full h-40 bg-slate-100 relative shrink-0 dark:bg-slate-800">
                   <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                 </div>
               )}
              <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-headline font-bold text-[color:var(--color-on-surface)] text-lg leading-tight line-clamp-1 group-hover:text-[color:var(--color-primary)] transition-colors">{listing.title}</h3>
                        {listing.auctionPhase === 'live' && !(listing.auctionEndDate && now > new Date(listing.auctionEndDate)) && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[9px] font-black uppercase animate-pulse shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[color:var(--color-on-surface-variant)] font-bold uppercase tracking-widest">{listing.category}</p>
                    </div>
                  </div>

                 <p className="text-xs text-[color:var(--color-on-surface-variant)] line-clamp-2 mb-4">{listing.description}</p>

                 <div className="space-y-1.5 mb-4 border-b border-[color:var(--color-outline-variant)]/20 pb-4">
                   <div className="flex items-center gap-2 text-xs text-[color:var(--color-on-surface-variant)]">
                     <span className="material-symbols-outlined text-sm text-[color:var(--color-primary)]">scale</span>
                     <span className="font-semibold">{listing.weight} KG</span>
                   </div>
                   <div className="flex items-center gap-2 text-xs text-[color:var(--color-on-surface-variant)]">
                     <span className="material-symbols-outlined text-sm text-[color:var(--color-primary)]">location_on</span>
                     <span>{listing.location || "Location TBD"}</span>
                   </div>
                   {listing.auctionStartDate && (
                     <div className="flex items-center gap-2 text-xs text-[color:var(--color-on-surface-variant)]">
                       <span className="material-symbols-outlined text-sm text-[color:var(--color-primary)]">calendar_today</span>
                       <span>Starts: {formatDate(listing.auctionStartDate)}</span>
                     </div>
                   )}
                   {listing.auctionEndDate && (
                     <div className="flex items-center gap-2 text-xs text-[color:var(--color-on-surface-variant)]">
                       <span className="material-symbols-outlined text-sm text-[color:var(--color-primary)]">event_busy</span>
                       <span>Ends: {formatDate(listing.auctionEndDate)}</span>
                     </div>
                   )}
                 </div>

                 <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl mb-4 mt-auto p-3 dark:bg-slate-950 dark:border-slate-800">
                   <div>
                     <p className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--color-on-surface-variant)]">Current High</p>
                     <p className="font-headline font-bold text-[color:var(--color-on-surface)] md:text-lg">
                       {topBid ? `₹${topBid.amount.toLocaleString()}` : "No bids yet"}
                     </p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--color-on-surface-variant)]">Next Required</p>
                     <p className="font-headline font-bold text-[color:var(--color-primary)] md:text-lg">₹{requiredBidAmount.toLocaleString()}</p>
                   </div>
                 </div>

                 {tab === "past" ? (
                    <div className="flex items-center justify-center gap-2 py-3 bg-slate-100 rounded-xl dark:bg-slate-800">
                      <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Auction Ended</span>
                    </div>
                 ) : alreadyBid ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-center gap-2 py-3 bg-[color:var(--color-primary-fixed)]/20 rounded-xl">
                        <span className="material-symbols-outlined text-[color:var(--color-primary)] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        <span className="text-sm font-bold text-[color:var(--color-primary)]">Bid Active</span>
                      </div>
                      {listing.auctionPhase === 'live' && (
                        <Link href="/vendor/live-auction" className="btn-primary w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg bg-red-600 hover:bg-red-700" onClick={e => e.stopPropagation()}>
                          <span className="material-symbols-outlined text-sm">sensors</span>
                          Join Live Auction
                        </Link>
                      )}
                    </div>
                 ) : (
                    <div className="btn-primary w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                      <span className="material-symbols-outlined text-sm">{isFuture ? 'today' : (listing.auctionPhase === 'live' ? 'sensors' : 'gavel')}</span>
                      {isFuture ? 'Register & Track' : (listing.auctionPhase === 'live' ? 'Enter Live Auction' : 'View Details & Bid')}
                    </div>
                 )}
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 block mb-4">search_off</span>
          <p className="text-[color:var(--color-on-surface-variant)]">No auctions found in this timeframe.</p>
        </div>
      )}
    </div>
  );
}
