"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import LiveAuctionEmbed from "@/components/auction/LiveAuctionEmbed";
import { formatDate, formatTime } from "@/utils/format";

export default function ClientBids() {
  const { listings, bids, users, currentUser, addClosingDocument } = useApp();
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  
  const handleFileUpload = (listingId: string, docName: string) => {
    // Simulate upload delay
    setTimeout(() => {
      addClosingDocument(listingId, {
        name: docName,
        url: "#",
        type: "PDF",
        timestamp: new Date().toISOString()
      });
    }, 1000);
  };

  const myListings = listings.filter((l) => l.userId === currentUser?.id);
  const now = new Date();

   const formatWithMs = (isoString: string) => {
    const d = new Date(isoString);
    const timeStr = formatTime(d);
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return `${formatDate(d)} ${timeStr}.${ms}`;
  };

  const getStatus = (listing: any) => {
    if (listing.auctionPhase === 'live') return 'live';
    if (listing.auctionPhase === 'completed') return 'ended';
    if (!listing.auctionStartDate || !listing.auctionEndDate) return "live";
    return now < new Date(listing.auctionStartDate) ? "upcoming" : now > new Date(listing.auctionEndDate) ? "ended" : "live";
  }

  if (selectedAuctionId) {
    const listing = myListings.find(l => l.id === selectedAuctionId);
    if (!listing) return null;
    
    const listingBids = bids.filter(b => (b.auctionId === listing.auctionId || b.listingId === listing.id)).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const topBid = listingBids[0];
    
    const status = getStatus(listing);

    if (status === "live") {
      return (
        <div className="animate-fade-in -mt-8 -mx-4 md:-mx-8">
           <div className="px-4 py-3 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700">
             <button onClick={() => setSelectedAuctionId(null)} className="text-[#DC3545] bg-[#F5F7FA] hover:bg-red-50 transition px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-slate-200 flex items-center gap-2 w-fit dark:bg-slate-950 dark:border-slate-700">
                <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Auctions
             </button>
           </div>
           <LiveAuctionEmbed listing={listing} />
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 animate-fade-in">
        <button onClick={() => setSelectedAuctionId(null)} className="btn-outline px-4 py-2 text-xs font-bold mb-6 flex items-center gap-2">
           <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Auctions
        </button>

        {status === "ended" && topBid && (
          <div className="space-y-6 mb-8">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
              <span className="material-symbols-outlined text-emerald-600 inline-block mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
              Auction automatically concluded! <strong>{topBid.vendorName}</strong> won with a bid of ₹{topBid.amount.toLocaleString()}.
            </div>

            <div className="card p-0 overflow-hidden border-2 border-[color:var(--color-primary)]">
               <div className="p-4 bg-[color:var(--color-primary)] text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <span className="material-symbols-outlined">description</span>
                     <h3 className="font-headline font-bold">Post-Auction Logistics & Settlement</h3>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Compliance Required</span>
               </div>
               
               <div className="p-6 bg-white dark:bg-slate-900">
                  <p className="text-sm text-slate-600 mb-6 dark:text-slate-400">As the auction host, you must now upload the legal settlement documents for <strong>{topBid.vendorName}</strong>. These will be securely visible only to the winner.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Upload Settlement Suite</h4>
                        <div className="space-y-3">
                           {[
                              "Letter of Acceptance (LOA)",
                              "Payment Demand Letter",
                              "Sale Certificate / Deed",
                              "Handover / Possession Letter",
                              "Tax Invoice (GST)",
                              "Delivery Order (DO)",
                              "E-Waste Recycling Certificate",
                              "Data Destruction Certificate",
                              "Form 6 (Manifest)",
                              "Pickup Challan",
                              "Confirmation Letter"
                           ].map(docType => {
                              const existing = listing.closingDocuments?.find(d => d.name === docType);
                              return (
                                 <div key={docType} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-emerald-950/30 transition-all group dark:border-slate-800">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-white">{docType}</span>
                                    {existing ? (
                                       <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest group-hover:text-emerald-50">Uploaded</span>
                                          <span className="material-symbols-outlined text-emerald-500 text-sm group-hover:text-white">check_circle</span>
                                       </div>
                                    ) : (
                                       <label className="cursor-pointer group/upload">
                                          <input type="file" className="hidden" onChange={(e) => {
                                             if(e.target.files?.length) {
                                                handleFileUpload(listing.id, docType);
                                             }
                                          }} />
                                          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[color:var(--color-primary)] opacity-60 group-hover/upload:opacity-100 group-hover:text-white group-hover:opacity-100 transition-all">
                                             <span>Upload</span>
                                             <span className="material-symbols-outlined text-sm">upload</span>
                                          </div>
                                       </label>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                     
                     <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Documents Shared with Winner</h4>
                        {listing.closingDocuments && listing.closingDocuments.length > 0 ? (
                           <div className="space-y-2">
                              {listing.closingDocuments.map((doc, idx) => (
                                 <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                                    <span className="material-symbols-outlined text-red-500 text-lg">picture_as_pdf</span>
                                    <div className="flex-1 min-w-0">
                                       <p className="text-xs font-bold text-slate-800 truncate dark:text-slate-200">{doc.name}</p>
                                       <p className="text-[9px] text-slate-400">{formatDate(doc.timestamp)} {formatTime(doc.timestamp)}</p>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        ) : (
                           <div className="h-full flex flex-col items-center justify-center text-center py-10">
                              <span className="material-symbols-outlined text-slate-200 text-4xl mb-2">folder_open</span>
                              <p className="text-xs text-slate-400 font-medium">No documents shared yet.</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        <div className="card p-0 overflow-hidden mb-8">
           <div className="p-6 bg-[color:var(--color-surface-container-low)] border-b border-[color:var(--color-outline-variant)]/20 flex justify-between items-start">
             <div>
               <h2 className="text-2xl font-headline font-extrabold text-[color:var(--color-on-surface)]">{listing.title}</h2>
               <p className="text-sm text-[color:var(--color-on-surface-variant)]">{listing.category} · {listing.weight} KG</p>
             </div>
             <div className="text-right">
                <span className={`pill ${status === "upcoming" ? "pill-warning" : "pill-neutral"}`}>
                  {status.toUpperCase()}
                </span>
             </div>
           </div>
           
           <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 bg-white dark:bg-slate-900">
              <div>
                 <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-on-surface-variant)] font-bold mb-1">Base Price</p>
                 <p className="font-headline font-bold text-lg">₹{listing.basePrice?.toLocaleString() || "N/A"}</p>
              </div>
              <div>
                 <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-on-surface-variant)] font-bold mb-1">Bid Increment</p>
                 <p className="font-headline font-bold text-lg">+ ₹{listing.bidIncrement?.toLocaleString() || "N/A"}</p>
              </div>
              <div>
                 <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-on-surface-variant)] font-bold mb-1">Total Bids</p>
                 <p className="font-headline font-bold text-lg">{listingBids.length}</p>
              </div>
              <div>
                 <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-on-surface-variant)] font-bold mb-1">Highest Bid</p>
                 <p className="font-headline font-bold text-lg text-[color:var(--color-primary)]">₹{topBid?.amount.toLocaleString() || "0"}</p>
              </div>
           </div>
        </div>

        <h3 className="text-xl font-headline font-bold mb-4 flex items-center gap-2">
           <span className="material-symbols-outlined text-[color:var(--color-primary)]">receipt_long</span>
           Official Bid Ledger
        </h3>
        
        {listingBids.length === 0 ? (
           <div className="card p-12 text-center text-[color:var(--color-on-surface-variant)]">No bids have been recorded for this auction yet.</div>
        ) : (
           <div className="card p-0 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs uppercase font-black tracking-wider border-b border-slate-200 dark:border-slate-700">
                     <tr>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Vendor Details</th>
                        <th className="px-6 py-4 text-right">Bid Amount</th>
                        <th className="px-6 py-4 text-right">High-Res Timestamp</th>
                        <th className="px-6 py-4 text-center">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                     {listingBids.map((bid) => {
                        const vendor = users.find(u => u.id === bid.vendorId);
                        const isHighest = topBid?.id === bid.id;
                        const isWinner = status === "ended" && isHighest;
                        
                        return (
                          <tr key={bid.id} className={`hover:bg-emerald-950/30 transition-all group cursor-default ${isWinner ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                              <td className="px-6 py-4">
                                {isWinner ? (
                                   <span className="pill pill-success text-[10px] group-hover:bg-white/20 group-hover:text-white">WINNER</span>
                                ) : (
                                   <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold group-hover:text-emerald-50">Recorded</span>
                                )}                             
                             </td>
                             <td className="px-6 py-4">
                                <p className="font-bold text-slate-900 dark:text-white group-hover:text-white">{bid.vendorName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-emerald-50">{vendor?.email || "N/A"}</p>
                             </td>
                             <td className="px-6 py-4 text-right font-headline text-lg font-bold group-hover:text-white">
                                ₹{bid.amount.toLocaleString()}
                             </td>
                             <td className="px-6 py-4 text-right font-mono text-xs text-slate-500 group-hover:text-emerald-50">
                                {formatWithMs(bid.createdAt)}
                             </td>
                             <td className="px-6 py-4 text-center">
                               {isWinner ? (
                                 <span className="material-symbols-outlined text-emerald-500 group-hover:text-white">emoji_events</span>
                               ) : status === "ended" ? (
                                 <span className="text-slate-300 group-hover:text-emerald-200">Outbid</span>
                               ) : (
                                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest group-hover:text-emerald-50">Awaiting Close</span>
                               )}
                             </td>
                          </tr>
                        )
                     })}
                  </tbody>
               </table>
             </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 animate-fade-in">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Bid Ledgers</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Select an auction to view its detailed ledger and millisecond-precision bid history.</p>
      </div>

      {myListings.length === 0 ? (
        <div className="card p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-4">gavel</span>
          <p className="text-slate-500 text-lg">You have no auctions. Post e-waste to start processing bids.</p>
          <a href="/client/post" className="btn-primary mt-6 inline-flex">Schedule E-Auction</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myListings.map(listing => {
             const listingBids = bids.filter((b) => (b.auctionId === listing.auctionId || b.listingId === listing.id));
             const topBid = listingBids.sort((a,b) => b.amount - a.amount)[0];
             const status = getStatus(listing);
             
             return (
               <div key={listing.id} onClick={() => setSelectedAuctionId(listing.id)} className="card p-6 cursor-pointer hover:shadow-lg transition-all group border border-transparent hover:border-[color:var(--color-primary)]/30">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className={`pill text-[9px] ${status === "live" ? "pill-success" : status === "upcoming" ? "pill-warning" : "pill-neutral"}`}>
                             {status.toUpperCase()}
                           </span>
                           <span className="text-xs text-[color:var(--color-on-surface-variant)]">{listing.category}</span>
                        </div>
                        <h3 className="font-headline font-bold text-lg text-[color:var(--color-on-surface)] group-hover:text-[color:var(--color-primary)] transition-colors line-clamp-1">{listing.title}</h3>
                     </div>
                     <span className="material-symbols-outlined text-[color:var(--color-outline-variant)] group-hover:text-[color:var(--color-primary)] transition-colors">arrow_forward_ios</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[color:var(--color-outline-variant)]/20">
                     <div>
                        <p className="text-[9px] uppercase tracking-widest text-[color:var(--color-on-surface-variant)] font-bold">Total Bids</p>
                        <p className="font-bold text-[color:var(--color-on-surface)] text-xl">{listingBids.length}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] uppercase tracking-widest text-[color:var(--color-on-surface-variant)] font-bold">Highest Bid</p>
                        <p className="font-bold text-[color:var(--color-primary)] text-xl">₹{topBid?.amount.toLocaleString() || "0"}</p>
                     </div>
                  </div>
               </div>
             )
          })}
        </div>
      )}
    </div>
  );
}
