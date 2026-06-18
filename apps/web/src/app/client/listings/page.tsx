"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Listing } from "@/types";
import Link from "next/link";
import api from "@/lib/api";

const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

export default function ClientListings() {
  const { listings, bids, users, currentUser, updateListingStatus, editListing, approveRequirement } = useApp();
  const [filter, setFilter] = useState<"all" | "invites" | "sealed" | "live" | "ended" | "review">("all");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get('id');
    if (id) setSelectedListingId(id);
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{title: string; weight: number | string; basePrice: number | string; bidIncrement: number | string; description: string}>({title: "", weight: 0, basePrice: 0, bidIncrement: 0, description: ""});

  const [approveModal, setApproveModal] = useState<{ isOpen: boolean; listingId: string | null; title: string }>({ isOpen: false, listingId: null, title: "" });
  const [targetPrice, setTargetPrice] = useState("");
  const [approving, setApproving] = useState(false);

  const [sealedBidModal, setSealedBidModal] = useState<{ isOpen: boolean; listingId: string | null; title: string }>({ isOpen: false, listingId: null, title: "" });
  const [sealedBids, setSealedBids] = useState<any[]>([]);
  const [sealedBidsLoading, setSealedBidsLoading] = useState(false);
  const [sealedBidsError, setSealedBidsError] = useState<string | null>(null);
  const [reviewingBidId, setReviewingBidId] = useState<string | null>(null);

  const openSealedBidReview = async (listingId: string, title: string) => {
    setSealedBidModal({ isOpen: true, listingId, title });
    setSealedBidsLoading(true);
    setSealedBidsError(null);
    try {
      const res = await api.get(`/requirements/${listingId}/sealed-bids`);
      setSealedBids(res.data);
    } catch (e: any) {
      setSealedBids([]);
      setSealedBidsError(e?.response?.data?.message || e?.message || 'Failed to load bids');
    } finally { setSealedBidsLoading(false); }
  };

  const handleReviewBid = async (listingId: string, bidId: string, action: 'approve' | 'reject', remarks?: string) => {
    setReviewingBidId(bidId);
    try {
      await api.patch(`/requirements/${listingId}/bids/${bidId}/review`, { action, remarks });
      setSealedBids(prev => prev.map(b => b.id === bidId ? { ...b, clientStatus: action === 'approve' ? 'approved' : 'rejected' } : b));
    } catch { /* ignore */ }
    finally { setReviewingBidId(null); }
  };

  const myListings = listings.filter(l =>
    l.userId === currentUser?.id ||
    l.userId === currentUser?.companyId
  );
  const reviewListings = myListings.filter(l => l.requirementStatus === 'client_review');

  const handleApproveSheet = async () => {
    if (!approveModal.listingId || !targetPrice) return;
    setApproving(true);
    try {
      await approveRequirement(approveModal.listingId, Number(targetPrice));
      setApproveModal({ isOpen: false, listingId: null, title: "" });
      setTargetPrice("");
    } finally {
      setApproving(false);
    }
  };

  const getDisplayStatus = (listing: Listing) => {
    if (listing.requirementStatus === 'client_review') return "review";
    if (listing.auctionPhase === 'invitation_window') return "invites";
    if (listing.auctionPhase === 'sealed_bid') return "sealed";
    if (listing.auctionPhase === 'live') return "live";
    if (listing.auctionPhase === 'completed') return "ended";
    return "sealed";
  };

  const filtered = filter === "all"
    ? myListings
    : myListings.filter(l => getDisplayStatus(l) === filter);

  const urgencyColors = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
  };

  const openDetails = (listing: Listing) => {
    setSelectedListingId(listing.id);
    setIsEditing(false);
    setEditForm({
      title: listing.title,
      weight: listing.weight,
      basePrice: listing.basePrice || "",
      bidIncrement: listing.bidIncrement || "",
      description: listing.description
    });
  };

  const handleEditSave = () => {
    if (selectedListingId) {
      editListing(selectedListingId, {
        title: editForm.title,
        weight: Number(editForm.weight),
        basePrice: Number(editForm.basePrice),
        bidIncrement: Number(editForm.bidIncrement),
        description: editForm.description,
        status: 'pending',
        adminStatus: 'pending'
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">My Inventory & Auctions</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Monitor invitations, sealed bids, live events, and concluded sales.</p>
        </div>
        <Link href="/client/post" className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span>
          New Listing
        </Link>
      </div>

      <div className="flex gap-1 p-1 bg-surface-container-low rounded-xl w-fit flex-wrap border border-outline-variant/10">
        {(["all", "review", "invites", "sealed", "live", "ended"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`relative px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${
              filter === f 
                ? "bg-primary text-white shadow-md scale-[1.02]" 
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
            }`}>
            {f === "review" && reviewListings.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
            {f === "all" ? `All (${myListings.length})` : `${f} (${myListings.filter(l => getDisplayStatus(l) === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 block mb-4">gavel</span>
          <h3 className="text-xl font-headline font-bold text-[color:var(--color-on-surface)] mb-2">No Items Found</h3>
          <p className="text-[color:var(--color-on-surface-variant)] mb-6">List your e-waste to begin the transparent bidding process.</p>
          <Link href="/client/post" className="btn-primary inline-flex">Post E-Waste Now</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(listing => {
            const listingBids = bids.filter(b => b.listingId === listing.id);
            const sealedBids = listingBids.filter(b => b.type === "sealed");
            const openBids = listingBids.filter(b => b.type === "open");
            const topBid = [...listingBids].sort((a, b) => b.amount - a.amount)[0];
            const displayStatus = getDisplayStatus(listing);
            const currentPrice = topBid?.amount || listing.basePrice || 0;

            const interestedCount = listing.vendorResponses?.filter(r => r.status === 'interested').length || 0;
            const declinedCount = listing.vendorResponses?.filter(r => r.status === 'declined').length || 0;
            const totalInvited = listing.invitedVendorIds?.length || 0;

            return (
              <div key={listing.id} className="card p-0 overflow-hidden hover:shadow-lg transition-all flex flex-col md:flex-row">
                {listing.images && listing.images.length > 0 && (
                  <div className="w-full md:w-72 h-52 md:h-auto bg-slate-100 relative shrink-0 dark:bg-slate-800">
                    <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`pill shadow-lg backdrop-blur-md ${
                        displayStatus === "live" ? "bg-red-600 text-white animate-pulse" :
                        displayStatus === "invites" ? "bg-amber-600 text-white" :
                        displayStatus === "sealed" ? "bg-blue-600 text-white" : "bg-slate-800 text-white"
                      }`}>
                        {displayStatus === "live" ? "🔥 LIVE AUCTION" :
                         displayStatus === "invites" ? "✉️ INVITATION PHASE" :
                         displayStatus === "sealed" ? "🛡️ SEALED PHASE" : "COMPLETED"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-headline font-bold text-xl text-[color:var(--color-on-surface)]">{listing.title}</h3>
                        {listing.urgency && (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${urgencyColors[listing.urgency]}`}>
                            {listing.urgency}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[color:var(--color-on-surface-variant)]">
                        <span className="flex items-center gap-1 font-bold"><span className="material-symbols-outlined text-sm">category</span>{listing.category}</span>
                        <span className="flex items-center gap-1 font-bold"><span className="material-symbols-outlined text-sm">scale</span>{listing.weight} KG</span>
                      </div>
                    </div>

                    <div className="text-right bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl min-w-[150px] dark:bg-slate-950 dark:border-slate-800">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">
                        {displayStatus === "invites" ? "Base Price" : displayStatus === "sealed" ? "Est. Base Price" : "Current Price"}
                      </p>
                      <p className="font-headline font-bold text-slate-900 text-xl dark:text-white">₹{currentPrice.toLocaleString()}</p>
                      {displayStatus === "live" && (
                        <p className="text-[9px] text-[color:var(--color-primary)] font-black uppercase tracking-tighter mt-1">+{listing.bidIncrement?.toLocaleString()} Tick Size</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {displayStatus === "invites" ? (
                      <>
                        <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100/50">
                          <p className="text-[10px] uppercase font-black text-amber-600 tracking-widest mb-1">Accepted</p>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">how_to_reg</span>
                            <span className="text-lg font-headline font-bold text-amber-900">{interestedCount} / {totalInvited}</span>
                          </div>
                        </div>
                        <div className="bg-red-50/50 rounded-lg p-3 border border-red-100/50">
                          <p className="text-[10px] uppercase font-black text-red-600 tracking-widest mb-1">Declined</p>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500">cancel</span>
                            <span className="text-lg font-headline font-bold text-red-900">{declinedCount}</span>
                          </div>
                        </div>
                        {listing.sealedBidStartDate && (
                          <div className="col-span-2 bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
                            <p className="text-[10px] uppercase font-black text-blue-600 tracking-widest mb-1">Sealed Bid Window</p>
                            <p className="text-xs font-bold text-blue-900">{fmtDate(listing.sealedBidStartDate)} → {fmtDate(listing.sealedBidEndDate)}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
                          <p className="text-[10px] uppercase font-black text-blue-600 tracking-widest mb-1">Sealed Bids</p>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500">lock</span>
                            <span className="text-lg font-headline font-bold text-blue-900">{sealedBids.length}</span>
                          </div>
                        </div>
                        <div className="bg-red-50/50 rounded-lg p-3 border border-red-100/50">
                          <p className="text-[10px] uppercase font-black text-red-600 tracking-widest mb-1">Live Bids</p>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500">sensors</span>
                            <span className="text-lg font-headline font-bold text-red-900">{openBids.length}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {displayStatus === "review" && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <span className="material-symbols-outlined text-amber-500 mt-0.5 shrink-0">description</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-amber-800 uppercase tracking-wide">Processed Sheet Ready for Review</p>
                        <p className="text-xs text-amber-700 mt-0.5">Admin has uploaded a cleaned material list. Review and set your target price to proceed.</p>
                        <button
                          onClick={async () => {
                            try {
                              const res = await api.get(`/requirements/${listing.id}/download/processed`);
                              if (res.data?.url) window.open(res.data.url, '_blank');
                            } catch { /* no sheet yet */ }
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 underline mt-1"
                        >
                          <span className="material-symbols-outlined text-xs">download</span>
                          Download Sheet
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-[color:var(--color-outline-variant)]/20">
                    <button onClick={() => openDetails(listing)} className="btn-outline text-[11px] py-2 px-4 uppercase tracking-widest font-black">Details</button>
                    <div className="flex gap-2">
                      {displayStatus === "review" && (
                        <button
                          onClick={() => { setApproveModal({ isOpen: true, listingId: listing.id, title: listing.title }); setTargetPrice(""); }}
                          className="flex items-center gap-1.5 text-[11px] font-black px-5 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all uppercase tracking-widest shadow-md">
                          <span className="material-symbols-outlined text-sm">fact_check</span>
                          Approve Sheet
                        </button>
                      )}
                      {displayStatus === "invites" && (() => {
                        const isScheduled = !!listing.liveConfigured;
                        if (isScheduled && listing.auctionStartDate) {
                          const startMs = new Date(listing.auctionStartDate).getTime();
                          const isActive = Date.now() >= startMs - 5 * 60 * 1000;
                          const fmtStart = new Date(listing.auctionStartDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                          if (isActive) {
                            return (
                              <Link href="/client/live-auction"
                                className="btn-primary text-[11px] py-2.5 px-6 uppercase tracking-widest font-black shadow-md flex items-center gap-2 bg-red-600 hover:bg-red-700 border-none animate-pulse">
                                <span className="material-symbols-outlined text-sm">sensors</span>
                                View Bidding
                              </Link>
                            );
                          }
                          return (
                            <button disabled
                              className="btn-tertiary text-[11px] py-2.5 px-5 uppercase tracking-widest font-black shadow-md flex items-center gap-1.5 opacity-50 cursor-not-allowed">
                              <span className="material-symbols-outlined text-sm">sensors</span>
                              View Bidding · {fmtStart}
                            </button>
                          );
                        }
                        return (
                          <Link
                            href={`/client/listings/${listing.id}/configure-live`}
                            className="btn-primary text-[11px] py-2.5 px-5 uppercase tracking-widest font-black shadow-md flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 border-none">
                            <span className="material-symbols-outlined text-sm">event_available</span>
                            Schedule Open Bidding
                          </Link>
                        );
                      })()}
                      {displayStatus === "sealed" && (() => {
                        const isScheduled = !!listing.liveConfigured;
                        if (isScheduled && listing.auctionStartDate) {
                          const startMs = new Date(listing.auctionStartDate).getTime();
                          const nowMs = Date.now();
                          const isActive = nowMs >= startMs - 5 * 60 * 1000;
                          const fmtStart = new Date(listing.auctionStartDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                          if (isActive) {
                            return (
                              <>
                                <button onClick={() => openSealedBidReview(listing.id, listing.title)}
                                  className="btn-outline text-[11px] py-2.5 px-4 uppercase tracking-widest font-black flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-sm">rate_review</span>Review Bids
                                </button>
                                <Link href="/client/live-auction"
                                  className="btn-primary text-[11px] py-2.5 px-6 uppercase tracking-widest font-black shadow-md flex items-center gap-2 bg-red-600 hover:bg-red-700 border-none animate-pulse">
                                  <span className="material-symbols-outlined text-sm">sensors</span>
                                  View Bidding
                                </Link>
                              </>
                            );
                          }
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">check_circle</span>Scheduled
                              </span>
                              <button disabled
                                className="btn-tertiary text-[11px] py-2.5 px-6 uppercase tracking-widest font-black shadow-md flex items-center gap-2 opacity-50 cursor-not-allowed">
                                <span className="material-symbols-outlined text-sm">sensors</span>
                                View Bidding · {fmtStart}
                              </button>
                            </div>
                          );
                        }
                        return (
                          <>
                            <button onClick={() => openSealedBidReview(listing.id, listing.title)}
                              className="btn-outline text-[11px] py-2.5 px-4 uppercase tracking-widest font-black flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm">rate_review</span>Review Bids
                            </button>
                            <Link href={`/client/listings/${listing.id}/configure-live`}
                              className="btn-tertiary text-[11px] py-2.5 px-6 uppercase tracking-widest font-black shadow-md flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm">settings_input_component</span>
                              Configure Live
                            </Link>
                          </>
                        );
                      })()}
                      {displayStatus === "live" && (
                        <Link href="/client/live-auction" className="btn-primary text-[11px] py-2.5 px-6 uppercase tracking-widest font-black shadow-md flex items-center gap-2 bg-red-600 hover:bg-red-700">
                          <span className="material-symbols-outlined text-sm">monitoring</span>
                          Monitor Live
                        </Link>
                      )}
                      <Link href="/client/bids" className="btn-outline text-[11px] py-2.5 px-6 uppercase tracking-widest font-black">Ledger</Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve Sheet Modal */}
      {approveModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-xl font-headline font-extrabold text-slate-900 dark:text-white">Approve Material Sheet</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Review the processed sheet and set your minimum acceptable target price. Vendors will bid above this price.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Listing</p>
              <p className="font-bold text-amber-900 text-sm">{approveModal.title}</p>
            </div>

            <div>
              <label className="label">Your Target Price (₹) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 50000"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  className="input-base !pl-8"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Vendors submitting sealed bids must bid above this floor price.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setApproveModal({ isOpen: false, listingId: null, title: "" })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSheet}
                disabled={!targetPrice || Number(targetPrice) <= 0 || approving}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {approving
                  ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Submitting...</>
                  : <><span className="material-symbols-outlined text-sm">check_circle</span>Confirm & Proceed</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sealed Bid Review Modal */}
      {sealedBidModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSealedBidModal({ isOpen: false, listingId: null, title: "" })}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-headline font-extrabold text-slate-900 dark:text-white">Sealed Bid Submissions</h3>
                <p className="text-xs text-slate-500 mt-0.5">{sealedBidModal.title}</p>
              </div>
              <button onClick={() => setSealedBidModal({ isOpen: false, listingId: null, title: "" })}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center dark:bg-slate-800">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {sealedBidsLoading ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
                </div>
              ) : sealedBidsError ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-5xl text-red-300 block mb-3">error</span>
                  <p className="font-bold text-red-500">Failed to load bids</p>
                  <p className="text-xs text-slate-400 mt-1">{sealedBidsError}</p>
                </div>
              ) : sealedBids.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-200 block mb-3">inbox</span>
                  <p className="font-bold text-slate-500">No sealed bids submitted yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Vendors will submit their bids after conducting site visits.</p>
                </div>
              ) : (
                sealedBids.map((bid: any) => (
                  <div key={bid.id} className="rounded-2xl border-2 p-5 space-y-4 border-emerald-200 bg-emerald-50/20 dark:bg-slate-900 dark:border-emerald-900">
                    {/* Vendor header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-sm">
                          {(bid.vendor?.name || "?")[0]}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">{bid.vendor?.name || bid.vendorId}</p>
                          <p className="text-[10px] text-slate-400 font-mono uppercase">{bid.vendor?.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sealed Bid</p>
                        <p className="text-2xl font-headline font-bold text-[color:var(--color-primary)]">₹{bid.amount?.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
                        Shortlisted
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(bid.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Documents */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {bid.auditReportUrl && (
                        <a href={bid.auditReportUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 transition-colors dark:bg-slate-800 dark:border-slate-700">
                          <span className="material-symbols-outlined text-red-500">description</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Audit Report</p>
                            <p className="text-xs font-bold text-slate-700 truncate dark:text-slate-300">{bid.auditReportFileName || "Download"}</p>
                          </div>
                          <span className="material-symbols-outlined text-sm text-slate-400">download</span>
                        </a>
                      )}
                      {bid.priceSheetUrl && (
                        <a href={bid.priceSheetUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 transition-colors dark:bg-slate-800 dark:border-slate-700">
                          <span className="material-symbols-outlined text-emerald-500">table_chart</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Price Sheet</p>
                            <p className="text-xs font-bold text-slate-700 truncate dark:text-slate-300">{bid.priceSheetFileName || "Download"}</p>
                          </div>
                          <span className="material-symbols-outlined text-sm text-slate-400">download</span>
                        </a>
                      )}
                    </div>

                    {/* Site visit images */}
                    {bid.imageUrls && bid.imageUrls.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Site Visit Photos ({bid.imageUrls.length})</p>
                        <div className="grid grid-cols-4 gap-2">
                          {bid.imageUrls.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={url} alt={`Site photo ${i + 1}`}
                                className="w-full h-20 object-cover rounded-xl border border-slate-200 hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No docs warning */}
                    {!bid.auditReportUrl && !bid.priceSheetUrl && (!bid.imageUrls || bid.imageUrls.length === 0) && (
                      <p className="text-xs text-slate-400 italic">No documents uploaded with this bid.</p>
                    )}

                    {/* Client remarks */}
                    {bid.clientRemarks && (
                      <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 dark:bg-slate-800">
                        <span className="font-black text-slate-400 uppercase tracking-widest">Remarks: </span>
                        {bid.clientRemarks}
                      </div>
                    )}

                  </div>
                ))
              )}

              {sealedBids.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    <span className="font-black text-emerald-600">{sealedBids.length}</span> shortlisted vendors shared by admin
                  </p>
                  {sealedBidModal.listingId && (
                    <Link href={`/client/listings/${sealedBidModal.listingId}/configure-live`}
                      onClick={() => setSealedBidModal({ isOpen: false, listingId: null, title: "" })}
                      className="btn-primary text-[11px] py-2.5 px-5 uppercase tracking-widest font-black flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 border-none">
                      <span className="material-symbols-outlined text-sm">event_available</span>
                      Configure Live Auction
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedListingId && (() => {
        const listing = listings.find(l => l.id === selectedListingId);
        if (!listing) return null;
        const displayStatus = getDisplayStatus(listing);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedListingId(null)}>
            <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl dark:bg-slate-900" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[color:var(--color-outline-variant)]/20">
                <h3 className="text-2xl font-headline font-extrabold text-[color:var(--color-on-surface)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[color:var(--color-primary)]">inventory_2</span>
                  {isEditing ? "Edit Listing" : "Inventory Details"}
                </h3>
                <button onClick={() => setSelectedListingId(null)} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors dark:bg-slate-800">
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="card bg-slate-50 border-none p-6 dark:bg-slate-950">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Material Characteristics</h4>
                  <div className="space-y-4">
                    {isEditing ? (
                      <>
                        <div>
                          <label className="label">Listing Title</label>
                          <input className="input-base" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="label">Weight (KG)</label>
                            <input type="number" className="input-base" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} />
                          </div>
                        </div>
                        <div>
                          <label className="label">Description</label>
                          <textarea rows={3} className="input-base" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Declared Title</p>
                          <p className="font-bold text-slate-900 text-lg dark:text-white">{listing.title}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Net Weight</p>
                            <p className="font-bold text-slate-900 dark:text-white">{listing.weight} KG</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Category Segment</p>
                            <p className="font-bold text-slate-900 dark:text-white">{listing.category}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Lot Description</p>
                          <p className="text-sm text-slate-600 leading-relaxed dark:text-slate-400">{listing.description}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {displayStatus === "invites" && listing.invitedVendorIds && listing.invitedVendorIds.length > 0 && (
                  <div className="card bg-amber-50/30 border-amber-100 p-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-4">Vendor Invitation Responses</h4>
                    <div className="space-y-2">
                      {listing.invitedVendorIds.map(vid => {
                        const vendor = users.find(u => u.id === vid);
                        const response = listing.vendorResponses?.find(r => r.vendorId === vid);
                        return (
                          <div key={vid} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100 dark:bg-slate-900">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center font-black text-amber-800 text-sm">{(vendor?.name || "?")[0]}</div>
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{vendor?.name || vid}</p>
                            </div>
                            <span className={`pill text-[10px] ${
                              response?.status === 'interested' ? 'pill-success' :
                              response?.status === 'declined' ? 'pill-error' : 'pill-warning'
                            }`}>
                              {response?.status || 'Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="card bg-slate-50 border-none p-6 dark:bg-slate-950">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Financial State</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Base Price</p>
                      <p className="text-2xl font-headline font-bold text-slate-900 dark:text-white">₹{listing.basePrice?.toLocaleString() || "TBD"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Active Tick Size</p>
                      <p className="text-2xl font-headline font-bold text-[color:var(--color-primary)]">{listing.bidIncrement ? `+ ₹${listing.bidIncrement.toLocaleString()}` : "TBD"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Compliance Documents</h4>
                  {listing.documents && listing.documents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {listing.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl dark:bg-slate-900 dark:border-slate-700">
                          <span className="material-symbols-outlined text-red-500">description</span>
                          <span className="text-xs font-bold text-slate-700 truncate flex-1 dark:text-slate-300">{doc.name}</span>
                          <a href={doc.url} download className="material-symbols-outlined text-slate-400 hover:text-[color:var(--color-primary)] transition-colors">download</a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No legal documents attached to this lot.</p>
                  )}
                </div>

                <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                  {isEditing ? (
                    <>
                      <button onClick={() => setIsEditing(false)} className="btn-outline flex-1 py-3 uppercase text-[11px] font-black">Cancel</button>
                      <button onClick={handleEditSave} className="btn-primary flex-1 py-3 uppercase text-[11px] font-black">Save Changes</button>
                    </>
                  ) : (
                    displayStatus !== "ended" && <button onClick={() => setIsEditing(true)} className="btn-outline w-full py-3 uppercase text-[11px] font-black">Edit Listing Details</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
