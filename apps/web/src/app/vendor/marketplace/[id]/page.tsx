"use client";

import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { formatDate, formatTime } from "@/utils/format";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function VendorAuctionDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { listings, bids, users, currentUser, addBid, addNotification, respondToInvitation, auditInvitations } = useApp();

  const listing = listings.find(l => l.id === id);
  const auditInvitation = auditInvitations.find(ai => ai.listingId === id && ai.vendorId === currentUser?.id);

  // States
  const [customBid, setCustomBid] = useState<string>("");
  const [alertMsg, setAlertMsg] = useState<{type: "success"|"info"|"error", msg: string} | null>(null);
  const [localAccepted, setLocalAccepted] = useState(false);
  const [localDeclined, setLocalDeclined] = useState(false);

  if (!listing) return <div className="p-20 text-center">Auction Not Found</div>;

  const listingBids = bids.filter(b => b.listingId === listing.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const myBids = listingBids.filter(b => b.vendorId === currentUser?.id);
  const topBid = listingBids.sort((a, b) => b.amount - a.amount)[0];
  const requiredBidAmount = topBid ? topBid.amount + (listing.bidIncrement || 0) : (listing.basePrice || 0);

  const isSealedPhase = listing.auctionPhase === 'sealed_bid';
  const isInvitationPhase = listing.auctionPhase === 'invitation_window';
  const canRespondToInvitation = isInvitationPhase || isSealedPhase;
  const acceptedVendorIds = Array.isArray(listing.acceptedVendorIds) ? listing.acceptedVendorIds : [];
  const declinedVendorIds = Array.isArray(listing.declinedVendorIds) ? listing.declinedVendorIds : [];
  const hasAccepted = localAccepted || acceptedVendorIds.includes(currentUser?.id || "");
  const hasDeclined = localDeclined || declinedVendorIds.includes(currentUser?.id || "");
  const hasSubmittedSealed = myBids.some(b => b.type === 'sealed');

  const handleInvitation = async (status: 'interested' | 'declined') => {
    if (!currentUser) return;
    const action = status === 'interested' ? 'accept' : 'decline';
    try {
      await api.patch(`/requirements/${listing.id}/invitation-respond`, { action });
      if (status === 'interested') {
        setLocalAccepted(true);
        // Redirect to invitation page where vendor uploads audit documents
        router.push(`/vendor/invitations/${listing.requirementId || listing.id}`);
      } else {
        setLocalDeclined(true);
        setTimeout(() => router.push('/vendor/marketplace'), 1500);
      }
    } catch {
      setAlertMsg({ type: "error", msg: "Failed to respond. Please try again." });
    }
  };

  const handlePlaceBid = async () => {
    const amount = Number(customBid);
    if (!amount || amount <= 0) {
      setAlertMsg({ type: "error", msg: "Please enter a valid bid amount." });
      return;
    }

    if (!isSealedPhase && amount < requiredBidAmount) {
      setAlertMsg({ type: "error", msg: `Minimum bid required is ₹${requiredBidAmount.toLocaleString()}` });
      return;
    }

    try {
      await addBid(listing.id, amount);
      setAlertMsg({ type: "success", msg: isSealedPhase ? "Sealed bid submitted successfully!" : "Bid placed successfully!" });
      setCustomBid("");
    } catch (e: any) {
      setAlertMsg({ type: "error", msg: e?.response?.data?.message || e?.message || "Failed to submit bid." });
    }
  };

  const formatWithMs = (isoString: string) => {
    const d = new Date(isoString);
    const timeStr = formatTime(d);
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return `${formatDate(d)} ${timeStr}.${ms}`;
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-fade-in space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/vendor/marketplace")} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0 dark:bg-slate-950">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-headline font-extrabold tracking-tight text-slate-900 dark:text-white">{listing.title}</h2>
              {listing.auctionPhase === 'live' && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[10px] font-black uppercase animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  Live Now
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`pill text-[10px] ${isSealedPhase ? "bg-blue-600 text-white" : listing.auctionPhase === 'live' ? "bg-red-600 text-white" : "bg-slate-500 text-white"}`}>
                  {listing.auctionPhase?.toUpperCase().replace('_', ' ') || 'ACTIVE'}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">{listing.category}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight Block</p>
              <p className="font-headline font-bold text-slate-900 dark:text-white">{listing.weight} KG</p>
           </div>
           <div className="w-px h-10 bg-slate-100 dark:bg-slate-800" />
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current L1 High</p>
              <p className="font-headline font-bold text-[color:var(--color-primary)] text-xl">₹{topBid?.amount.toLocaleString() || listing.basePrice?.toLocaleString()}</p>
           </div>
        </div>
      </div>

      {alertMsg && (
        <div className={`p-4 border rounded-xl text-sm font-bold flex items-center gap-3 animate-fade-in ${
          alertMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : 
          alertMsg.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
          "bg-blue-50 border-blue-200 text-blue-800"}`}>
          <span className="material-symbols-outlined">{alertMsg.type === "success" ? "verified" : alertMsg.type === "error" ? "error" : "info"}</span>
          {alertMsg.msg}
          <button onClick={() => setAlertMsg(null)} className="ml-auto material-symbols-outlined text-sm">close</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           {/* Detailed Information */}
           <div className="card p-8 bg-white dark:bg-slate-900">
              <h3 className="text-lg font-headline font-bold text-slate-900 mb-6 flex items-center gap-2 dark:text-white">
                 <span className="material-symbols-outlined text-[color:var(--color-primary)]">description</span>
                 Material & Lot Specifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                 {[
                   { label: "Originator Entity", value: listing.userName },
                   { label: "Physical Location", value: listing.location },
                   { label: "Asset Sub-Segment", value: listing.subCategory || "Mixed e-Waste" },
                   { label: "Compliance Tag", value: listing.locationType || "Standard" },
                   { label: "Tick Increment", value: `₹${listing.bidIncrement?.toLocaleString() || "N/A"}` },
                   { label: "EMD Required", value: `₹${listing.highestEmdAmount?.toLocaleString() || "N/A"}` },
                 ].map(item => (
                    <div key={item.label} className="border-b border-slate-50 pb-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                       <p className="font-bold text-slate-800 dark:text-slate-200">{item.value}</p>
                    </div>
                 ))}
              </div>
              <div className="mt-8 pt-8 border-t border-slate-50">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Technical Description</p>
                 <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl italic border-l-4 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-700">{listing.description}</p>
              </div>
           </div>

           {/* Public Auction Ledger */}
           <div className="pt-4">
              <h3 className="text-xl font-headline font-bold mb-4 flex items-center gap-2">
                 <span className="material-symbols-outlined text-[color:var(--color-primary)]">history</span>
                 Public Auction Ledger
              </h3>

              {listingBids.length === 0 ? (
                 <div className="p-12 text-center bg-slate-50/50 border border-slate-100 dark:bg-slate-950/50 dark:border-slate-800 rounded-3xl">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">history_toggle_off</span>
                    <p className="text-slate-400 font-bold">No bids recorded yet.</p>
                 </div>
              ) : (
                 <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-3xl">
                    <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50/50 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 dark:bg-slate-800/30 dark:border-slate-800">
                             <tr>
                                <th className="px-6 py-4">Participant Entity</th>
                                <th className="px-6 py-4 text-right">Authorized Bid</th>
                                <th className="px-6 py-4 text-right">Timestamp</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-transparent">
                             {listingBids.map((bid, index) => {
                                const isHighest = topBid?.id === bid.id;
                                return (
                                   <tr key={bid.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isHighest ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                      <td className="px-6 py-5">
                                         <p className="font-black text-slate-800 flex items-center gap-2 dark:text-slate-200">
                                            {bid.vendorName}
                                            {bid.vendorId === currentUser?.id && <span className="bg-primary text-white text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider font-black">You</span>}
                                         </p>
                                         <p className="text-xs text-slate-400 font-mono mt-0.5 uppercase tracking-tighter opacity-70">ID // {bid.vendorId.split('-')[0].toUpperCase()}</p>
                                      </td>
                                      <td className="px-6 py-5 text-right font-headline text-lg font-bold text-[color:var(--color-primary)]">
                                         ₹{bid.amount.toLocaleString()}
                                      </td>
                                      <td className="px-6 py-5 text-right font-mono text-[11px] font-bold text-slate-400">
                                         {formatWithMs(bid.createdAt)}
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
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
           <div className="card p-6 border-none bg-slate-900 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mt-16 -mr-16" />
              
              {canRespondToInvitation && !hasAccepted && !hasDeclined ? (
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-blue-400">mail</span>
                        </div>
                        <h4 className="font-headline font-bold">Exclusive Invitation</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      You have been hand-selected by the client to participate in this auction. 
                      Would you like to accept this invitation before the deadline?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleInvitation('interested')} className="btn-primary py-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 border-none text-slate-900 dark:text-white">
                        Yes, I'm In
                      </button>
                      <button onClick={() => handleInvitation('declined')} className="btn-primary py-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 border-white/10 text-white">
                        No, Decline
                      </button>
                    </div>
                    {listing.invitationDeadline && (
                      <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">
                        Deadline: {formatWithMs(listing.invitationDeadline)}
                      </p>
                    )}
                  </div>
               ) : hasDeclined ? (
                  <div className="relative z-10 p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                    <span className="material-symbols-outlined text-3xl text-red-400 mb-2">cancel</span>
                    <p className="text-sm font-bold">Invitation Declined</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-black">You opted out of this auction</p>
                  </div>
               ) : hasAccepted && (canRespondToInvitation || listing.auctionPhase === 'live') ? (
                 <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                       </div>
                       <h4 className="font-headline font-bold">Invitation Accepted</h4>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-400 font-bold uppercase tracking-widest text-center">
                      You're participating in this auction
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Download the material sheet, conduct your site audit, and upload your documents on the invitation page.
                    </p>
                    <button
                      onClick={() => router.push(`/vendor/invitations/${listing.id}`)}
                      className="btn-primary w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 border-none text-white flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">assignment</span>
                      Open Invitation Page
                    </button>
                    {isSealedPhase && (
                      <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">
                        After submitting docs, you can place your sealed bid
                      </p>
                    )}
                 </div>
               ) : (
                <div className="relative z-10 space-y-6">
                   <div className="flex items-center justify-between">
                      <h4 className="font-headline font-bold">{isSealedPhase ? "Place Sealed Bid" : "Auction Floor"}</h4>
                      <span className="pill bg-emerald-500/20 text-emerald-400 border-none text-[9px] font-black">UNLOCKED</span>
                   </div>

                   {isSealedPhase && hasSubmittedSealed ? (
                      <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                         <span className="material-symbols-outlined text-3xl text-emerald-400 mb-2">task_alt</span>
                         <p className="text-sm font-bold">Sealed Bid Logged</p>
                         <p className="text-[10px] text-slate-400 mt-1 uppercase font-black">Wait for open phase</p>
                      </div>
                   ) : listing.auctionPhase === 'completed' ? (
                      <div className="w-full bg-white/5 text-slate-400 rounded-xl py-6 text-center text-xs font-bold uppercase tracking-widest">Auction Finished</div>
                   ) : (
                      <div className="space-y-4">
                         <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Your Authorized Bid (₹)</label>
                            <input 
                               type="number" 
                               className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-xl font-headline font-bold focus:bg-white/20 focus:border-emerald-500 outline-none transition-all"
                               placeholder={requiredBidAmount.toString()}
                               value={customBid}
                               onChange={e => setCustomBid(e.target.value)}
                            />
                         </div>
                         <button onClick={handlePlaceBid} className="btn-primary w-full py-5 rounded-xl text-sm font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 border-none text-slate-900 shadow-xl shadow-emerald-900/20 dark:text-white">
                            {isSealedPhase ? "Submit Sealed Offer" : "Confirm Open Bid"}
                         </button>
                         {listing.auctionPhase === 'live' && (
                            <button onClick={() => router.push(`/vendor/live-auction`)}
                              className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-red-600 hover:bg-red-700 text-white flex justify-center items-center gap-2">
                                <span className="material-symbols-outlined text-sm">sensors</span>
                                Join Live Floor
                            </button>
                         )}
                      </div>
                   )}
                </div>
              )}
           </div>

           {listing.images && listing.images.length > 0 && (
              <div className="card p-2 bg-white overflow-hidden group dark:bg-slate-900">
                 <img src={listing.images[0]} alt="Lot" className="w-full h-48 object-cover rounded-xl group-hover:scale-105 transition-transform duration-500" />
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
