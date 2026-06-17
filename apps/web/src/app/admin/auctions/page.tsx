"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import api from "@/lib/api";

const PHASE_ORDER = ["invitation_window", "sealed_bid", "open_configuration", "live", "completed"] as const;
type Phase = typeof PHASE_ORDER[number];

const PHASE_META: Record<Phase, { label: string; color: string; next?: Phase }> = {
  invitation_window: { label: "Invitation Window", color: "bg-blue-100 text-blue-700", next: "sealed_bid" },
  sealed_bid: { label: "Sealed Bid", color: "bg-amber-100 text-amber-700", next: "open_configuration" },
  open_configuration: { label: "Configuring Open Bid", color: "bg-orange-100 text-orange-700", next: "live" },
  live: { label: "Live Auction", color: "bg-red-100 text-red-700", next: "completed" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700" },
};

export default function AdminAuctions() {
  const { listings, bids, updateAuctionPhase, editListing, refreshData, addNotification } = useApp();
  const [filter, setFilter] = useState<Phase | "all">("all");
  const [search, setSearch] = useState("");
  const [configModal, setConfigModal] = useState<{isOpen: boolean, listingId: string | null}>({isOpen: false, listingId: null});
  const [configForm, setConfigForm] = useState({ tickSize: "", maxTick: "", extensionTime: "3", maxExtensions: "3" });
  const [launching, setLaunching] = useState(false);
  const [notifyingClient, setNotifyingClient] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleNotifyClient = async (listing: any) => {
    const requirementId = listing.requirementId || listing.id;
    setNotifyingClient(requirementId);
    try {
      await api.post(`/requirements/${requirementId}/notify-client-live`);
      addNotification({
        userId: listing.userId,
        type: "live_auction_approval",
        title: "Action Required: Configure Live Auction",
        message: `The live auction for "${listing.title}" is ready to configure. Please set your pricing and schedule.`,
        link: `/client/listings/${requirementId || listing.id}/configure-live`,
      });
      showToast("Client notified for live auction approval via email and in-app notification.");
      await refreshData();
    } catch {
      showToast("Failed to notify client.", "error");
    } finally {
      setNotifyingClient(null);
    }
  };

  const auctionListings = listings.filter(l =>
    l.auctionPhase && !["draft", "pending"].includes(l.auctionPhase)
  );

  const filtered = auctionListings
    .filter(l => filter === "all" || l.auctionPhase === filter)
    .filter(l => l.title.toLowerCase().includes(search.toLowerCase()));

  const countByPhase = (phase: Phase) => auctionListings.filter(l => l.auctionPhase === phase).length;

  const getTopBid = (listingId: string) => {
    const listingBids = bids.filter(b => b.listingId === listingId && b.status !== "rejected");
    return listingBids.length > 0 ? Math.max(...listingBids.map(b => b.amount)) : null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Auction Control</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Manage all auction phases and advance deals through the pipeline.</p>
        </div>
        <div className="relative w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input className="input-base !pl-11 h-11 text-sm" placeholder="Search auctions..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Phase summary */}
      <div className="grid grid-cols-5 gap-3">
        {PHASE_ORDER.map(phase => {
          const m = PHASE_META[phase];
          return (
            <button
              key={phase}
              onClick={() => setFilter(filter === phase ? "all" : phase)}
              className={`card p-4 text-left border-2 transition-all ${filter === phase ? "border-primary" : "border-transparent"}`}
            >
              <p className="text-2xl font-black text-[color:var(--color-on-surface)]">{countByPhase(phase)}</p>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase mt-1 inline-block ${m.color}`}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Listings table */}
      <div className="card overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 dark:border-slate-800">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{filtered.length} auction{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-5xl block mb-2">gavel</span>
            No auctions found
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(listing => {
              const phase = listing.auctionPhase as Phase;
              const meta = PHASE_META[phase] || { label: phase, color: "bg-slate-100 text-slate-600" };
              const topBid = getTopBid(listing.id);
              const listingBids = bids.filter(b => b.listingId === listing.id);

              return (
                <div key={listing.id} className="p-5 flex items-start justify-between gap-4 hover:bg-emerald-950/40 border-l-4 border-transparent hover:border-emerald-500 transition-all group cursor-default">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black text-slate-400 group-hover:text-emerald-400/60">{listing.id}</span>
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${meta.color} group-hover:bg-emerald-500/20 group-hover:text-emerald-400`}>{meta.label}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 truncate dark:text-white group-hover:text-emerald-50">{listing.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 group-hover:text-slate-400">{listing.location} · {listing.weight} KG · {listing.category}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-slate-500 group-hover:text-slate-400">{listingBids.length} bid{listingBids.length !== 1 ? "s" : ""}</span>
                      {topBid && <span className="text-xs font-bold text-primary group-hover:text-emerald-400">Top: ₹{topBid.toLocaleString()}</span>}
                      {listing.basePrice && <span className="text-xs text-slate-400 group-hover:text-slate-500">Base: ₹{listing.basePrice.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {(phase === "invitation_window" || phase === "sealed_bid") && (
                      <Link href={`/admin/listings/${listing.requirementId || listing.id}/audit-docs`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-850 text-white text-xs font-black uppercase hover:bg-blue-950 transition-colors border border-blue-900 shadow-sm group-hover:bg-white group-hover:text-blue-800 group-hover:border-white">
                        <span className="material-symbols-outlined text-sm">fact_check</span>
                        Audit Docs
                      </Link>
                    )}
                    {phase === "sealed_bid" && (
                      <>
                        <Link href={`/admin/listings/${listing.requirementId || listing.id}/sealed-bids`}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-800 text-white text-xs font-black uppercase hover:bg-amber-900 transition-colors border border-amber-900 shadow-sm group-hover:bg-white group-hover:text-amber-800 group-hover:border-white">
                          <span className="material-symbols-outlined text-sm">gavel</span>
                          Sealed Bids
                        </Link>
                        <button
                          onClick={() => {
                            setConfigModal({ isOpen: true, listingId: listing.id });
                            setConfigForm({ tickSize: "", maxTick: "", extensionTime: "3", maxExtensions: "3" });
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-800 text-white text-xs font-black uppercase hover:bg-orange-900 transition-colors border border-orange-900 shadow-sm group-hover:bg-white group-hover:text-orange-800 group-hover:border-white"
                        >
                          <span className="material-symbols-outlined text-sm">settings</span>
                          Set Params
                        </button>
                      </>
                    )}
                    {phase === "open_configuration" && (
                      <button
                        onClick={() => handleNotifyClient(listing)}
                        disabled={notifyingClient === (listing.requirementId || listing.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-800 text-white text-xs font-black uppercase hover:bg-purple-900 disabled:opacity-50 transition-colors border border-purple-900 shadow-sm group-hover:bg-white group-hover:text-purple-800 group-hover:border-white"
                      >
                        {notifyingClient === (listing.requirementId || listing.id)
                          ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Notifying...</>
                          : <><span className="material-symbols-outlined text-sm">notifications</span>Notify Client</>
                        }
                      </button>
                    )}
                    {phase === "live" && (!listing.auctionStartDate || new Date() >= new Date(listing.auctionStartDate)) && (
                      <Link href={`/admin/auctions/${listing.id}/live`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-750 text-white text-xs font-black uppercase hover:bg-red-850 transition-colors border border-red-800 shadow-sm group-hover:bg-white group-hover:text-red-700 group-hover:border-white">
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        View Live
                      </Link>
                    )}
                    {phase === "live" && listing.auctionStartDate && new Date() < new Date(listing.auctionStartDate) && (
                      <span className="text-xs text-slate-400 italic px-2 group-hover:text-emerald-50">
                        Starts {new Date(listing.auctionStartDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {phase === "completed" && listing.auctionId && (
                      <Link href={`/admin/auctions/${listing.auctionId}/manage`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-805 text-white text-xs font-black uppercase hover:bg-emerald-905 transition-colors border border-emerald-900 shadow-sm group-hover:bg-white group-hover:text-emerald-700 group-hover:border-white">
                        <span className="material-symbols-outlined text-sm">manage_accounts</span>
                        Manage
                      </Link>
                    )}
                    {phase === "completed" && !listing.auctionId && (
                      <Link href={`/admin/auctions/${listing.id}/live`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-800 text-white text-xs font-black uppercase hover:bg-purple-900 transition-colors border border-purple-900 shadow-sm group-hover:bg-white group-hover:text-purple-800 group-hover:border-white">
                        <span className="material-symbols-outlined text-sm">gavel</span>
                        Approve Winner
                      </Link>
                    )}
                    {meta.next && phase === "open_configuration" && (
                      <button
                        onClick={() => {
                          setConfigModal({ isOpen: true, listingId: listing.id });
                          setConfigForm({ tickSize: "", maxTick: "", extensionTime: "3", maxExtensions: "3" });
                        }}
                        className="px-4 py-2 rounded-xl bg-orange-800 text-white text-xs font-black uppercase hover:bg-orange-900 transition-colors border border-orange-900 shadow-sm group-hover:bg-white group-hover:text-orange-800 group-hover:border-white"
                      >
                        Configure & Launch →
                      </button>
                    )}
                    {meta.next && phase !== "open_configuration" && phase !== "invitation_window" && phase !== "sealed_bid" && (
                      <button
                        onClick={() => updateAuctionPhase(listing.id, meta.next!)}
                        className="px-4 py-2 rounded-xl bg-emerald-800 text-white text-xs font-black uppercase hover:bg-emerald-900 transition-colors border border-emerald-900 shadow-sm group-hover:bg-white group-hover:text-emerald-800 group-hover:border-white"
                      >
                        Advance →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {configModal.isOpen && configModal.listingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-fade-in">
            <div>
              <h3 className="text-xl font-headline font-extrabold text-slate-900 dark:text-white">Admin Auction Setup</h3>
              <p className="text-sm text-slate-500 mt-1">Set the final parameters to launch the live auction.</p>
            </div>
            
            <div className="space-y-4 px-1">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300">
                These governance parameters will be sent to the client as read-only. The client sets their own pricing and schedule.
              </div>
              <div>
                <label className="label">Tick Size / Increment (₹) *</label>
                <input type="number" className="input-base" value={configForm.tickSize} onChange={e => setConfigForm({...configForm, tickSize: e.target.value})} placeholder="e.g. 500" />
              </div>
              <div>
                <label className="label">Max Tick Size (₹)</label>
                <input type="number" className="input-base" value={configForm.maxTick} onChange={e => setConfigForm({...configForm, maxTick: e.target.value})} placeholder="Optional max jump" />
              </div>
              <div>
                <label className="label">Auto-Extension (Mins) *</label>
                <select className="input-base" value={configForm.extensionTime} onChange={e => setConfigForm({...configForm, extensionTime: e.target.value})}>
                  <option value="1">1 Minute</option>
                  <option value="3">3 Minutes</option>
                  <option value="5">5 Minutes</option>
                  <option value="10">10 Minutes</option>
                </select>
              </div>
              <div>
                <label className="label">Max Extensions (count)</label>
                <input type="number" className="input-base" value={configForm.maxExtensions} onChange={e => setConfigForm({...configForm, maxExtensions: e.target.value})} placeholder="e.g. 3" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfigModal({isOpen: false, listingId: null})} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700">Cancel</button>
              <button
                onClick={async () => {
                  if (!configModal.listingId) return;
                  setLaunching(true);
                  try {
                    const listing = listings.find(l => l.id === configModal.listingId);
                    const auctionId = listing?.auctionId;
                    const requirementId = listing?.requirementId || listing?.id;
                    if (auctionId) {
                      await api.patch(`/auctions/${auctionId}/schedule`, {
                        sealedPhaseStart: listing.sealedBidStartDate || new Date().toISOString(),
                        sealedPhaseEnd: listing.sealedBidEndDate || new Date().toISOString(),
                        openPhaseStart: listing.auctionStartDate || new Date().toISOString(),
                        openPhaseEnd: listing.auctionEndDate || new Date(Date.now() + 86400000).toISOString(),
                        tickSize: Number(configForm.tickSize),
                        maximumTickSize: configForm.maxTick ? Number(configForm.maxTick) : undefined,
                        maxTicks: Number(configForm.maxExtensions || 3),
                        extensionMinutes: Number(configForm.extensionTime),
                      }).catch(() => {});
                    }
                    // Notify client via email + in-app notification for live auction approval
                    if (requirementId) {
                      await api.post(`/requirements/${requirementId}/notify-client-live`).catch(() => {});
                    }
                    const configListing = listings.find(l => l.id === configModal.listingId);
                    editListing(configModal.listingId, {
                      bidIncrement: Number(configForm.tickSize),
                      maximumTickSize: configForm.maxTick ? Number(configForm.maxTick) : undefined,
                      extensionTime: Number(configForm.extensionTime),
                      liveConfigured: true,
                    });
                    if (configListing) {
                      addNotification({
                        userId: configListing.userId,
                        type: "live_auction_approval",
                        title: "Action Required: Configure Live Auction",
                        message: `Admin has set the auction parameters for "${configListing.title}". Please review and configure your live auction.`,
                        link: `/client/listings/${configListing.requirementId || configListing.id}/configure-live`,
                      });
                    }
                    showToast("Governance parameters sent to client for review.");
                    await refreshData().catch(() => {});
                  } finally {
                    setLaunching(false);
                    setConfigModal({isOpen: false, listingId: null});
                  }
                }}
                disabled={!configForm.tickSize || launching}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {launching
                  ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Sending...</>
                  : "Send for Approval"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
