"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { toLocalDatetimeString } from "@/utils/format";

export default function ConfigureLiveAuction() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { listings, bids, users, editListing, refreshData, currentUser, addNotification } = useApp();

  const listing = listings.find(l => l.id === id);
  const sealedBids = bids.filter(b =>
    (b.auctionId === listing?.auctionId || b.listingId === id) &&
    (b.phase === 'SEALED' || b.type === 'sealed')
  );
  const sealedBidAvg = sealedBids.length > 0 ? Math.round(sealedBids.reduce((s, b) => s + b.amount, 0) / sealedBids.length) : 0;
  const sealedBidMax = sealedBids.length > 0 ? Math.max(...sealedBids.map(b => b.amount)) : 0;
  const sealedBidMin = sealedBids.length > 0 ? Math.min(...sealedBids.map(b => b.amount)) : 0;

  // Client-editable fields
  const [form, setForm] = useState({
    basePrice: "",
    targetPrice: "",
    auctionStartDate: "",
    auctionEndDate: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [requestingSending, setRequestingSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (listing && !isInitialized) {
      setForm({
        basePrice: listing.basePrice?.toString() || "",
        targetPrice: listing.targetPrice?.toString() || "",
        auctionStartDate: toLocalDatetimeString(listing.auctionStartDate),
        auctionEndDate: toLocalDatetimeString(listing.auctionEndDate),
      });
      setIsInitialized(true);
    }
  }, [listing, isInitialized]);

  const handleRequestChanges = async () => {
    setRequestingSending(true);
    try {
      const requirementId = listing?.requirementId || id;
      await api.post(`/requirements/${requirementId}/client-request-changes`, { message: changeMessage });
      setRequestSent(true);
      setShowChangeRequest(false);
      setChangeMessage("");
    } catch {
      // silently fail — admin will still get in-app notification
      setRequestSent(true);
      setShowChangeRequest(false);
    } finally {
      setRequestingSending(false);
    }
  };

  if (!listing) return <div className="p-20 text-center">Listing not found</div>;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.basePrice || isNaN(Number(form.basePrice)) || Number(form.basePrice) <= 0)
      e.basePrice = "Enter a valid base price";
    if (!form.auctionStartDate) e.auctionStartDate = "Select a start date & time";
    if (!form.auctionEndDate) e.auctionEndDate = "Select an end date & time";
    if (form.auctionStartDate && form.auctionEndDate && new Date(form.auctionEndDate) <= new Date(form.auctionStartDate))
      e.auctionEndDate = "End time must be after start time";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleApprove = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);

    try {
      const requirementId = listing.requirementId || id;
      await api.patch(`/requirements/${requirementId}/client-approve-live`, {
        basePrice: Number(form.basePrice),
        targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
        startDate: new Date(form.auctionStartDate).toISOString(),
        endDate: new Date(form.auctionEndDate).toISOString(),
      });

      // Phase stays as 'open_configuration' until the scheduled start time
      editListing(id, { liveConfigured: true, auctionPhase: 'open_configuration',
        auctionStartDate: new Date(form.auctionStartDate).toISOString(),
        auctionEndDate: new Date(form.auctionEndDate).toISOString(),
      });
      addNotification({
        userId: currentUser?.id || "",
        type: "live_auction_approved",
        title: "Live Auction Scheduled",
        message: `Your live auction for "${listing?.title}" has been configured. It will go live at ${new Date(form.auctionStartDate).toLocaleString('en-IN')}.`,
        link: "/client/listings",
      });
      await refreshData().catch(() => {});
      router.push("/client/listings");
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to approve. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Admin-set params from listing
  const adminTickSize = listing.bidIncrement ?? listing.tickSize ?? "—";
  const adminMaxTick = listing.maximumTickSize ?? listing.maxTicks ?? "—";
  const adminExtension = listing.extensionTime ?? listing.extensionMinutes ?? "—";
  const adminMaxExtensions = listing.maxExtensions ?? "—";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-fade-in px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Link href="/client/listings" className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all dark:bg-slate-900 dark:border-slate-700">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Configure Live Auction</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Set your pricing and schedule for the open auction. Admin governance parameters are shown read-only below.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Client-editable: Pricing */}
          <div className="card p-6 space-y-5 border-2 border-primary/20">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-base">sell</span>
              Your Pricing (Set by You)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Base Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={form.basePrice}
                    onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
                    placeholder="e.g. 50000"
                    className={`input-base !pl-7 ${errors.basePrice ? 'border-red-400' : ''}`}
                  />
                </div>
                {errors.basePrice && <p className="text-red-500 text-xs mt-1">{errors.basePrice}</p>}
                <p className="text-[10px] text-slate-400 mt-1">Minimum opening bid vendors must beat</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Target / Reserve Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={form.targetPrice}
                    onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
                    placeholder="e.g. 75000"
                    className="input-base !pl-7"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Your internal target — not shown to vendors</p>
              </div>
            </div>
          </div>

          {/* Client-editable: Schedule */}
          <div className="card p-6 space-y-5 border-2 border-primary/20">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-base">schedule</span>
              Auction Schedule (Set by You)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Start Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.auctionStartDate}
                  onChange={e => setForm(f => ({ ...f, auctionStartDate: e.target.value }))}
                  className={`input-base ${errors.auctionStartDate ? 'border-red-400' : ''}`}
                />
                {errors.auctionStartDate && <p className="text-red-500 text-xs mt-1">{errors.auctionStartDate}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  End Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.auctionEndDate}
                  onChange={e => setForm(f => ({ ...f, auctionEndDate: e.target.value }))}
                  className={`input-base ${errors.auctionEndDate ? 'border-red-400' : ''}`}
                />
                {errors.auctionEndDate && <p className="text-red-500 text-xs mt-1">{errors.auctionEndDate}</p>}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2 dark:bg-blue-950/30 dark:border-blue-900">
              <span className="material-symbols-outlined text-sm text-blue-500 shrink-0 mt-0.5">info</span>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                After you confirm, all shortlisted vendors will be notified of the live auction date and time.
              </p>
            </div>
          </div>

          {/* Admin-set (read-only) */}
          <div className="card p-6 space-y-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                Admin-Set Governance (Read Only)
              </h3>
              {!requestSent ? (
                <button
                  onClick={() => setShowChangeRequest(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                >
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  Request Changes
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Change request sent to admin
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tick Size</label>
                <p className="text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  {adminTickSize !== "—" ? `₹${adminTickSize}` : "—"}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Tick</label>
                <p className="text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  {adminMaxTick !== "—" ? `₹${adminMaxTick}` : "—"}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Extension</label>
                <p className="text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  {adminExtension !== "—" ? `${adminExtension} min` : "—"}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Ext.</label>
                <p className="text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5">{adminMaxExtensions}</p>
              </div>
            </div>

            {showChangeRequest && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500">Describe what you'd like the admin to change:</p>
                <textarea
                  value={changeMessage}
                  onChange={e => setChangeMessage(e.target.value)}
                  placeholder="e.g. Please increase the tick size to ₹1000 and reduce extension to 1 minute."
                  rows={3}
                  className="input-base w-full resize-none text-sm"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowChangeRequest(false); setChangeMessage(""); }}
                    className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestChanges}
                    disabled={requestingSending}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-widest bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {requestingSending
                      ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Sending...</>
                      : <><span className="material-symbols-outlined text-sm">send</span>Send to Admin</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>

          {saveError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm shrink-0">error</span>
              {saveError}
            </div>
          )}

          <div className="flex gap-4">
            <Link href="/client/listings" className="btn-outline flex-1 py-4 rounded-xl text-center">Cancel</Link>
            <button onClick={handleApprove} disabled={saving}
              className="btn-tertiary flex-[2] py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
              {saving
                ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Confirming...</>
                : <><span className="material-symbols-outlined">check_circle</span>Confirm & Launch Live Auction</>
              }
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {listing.invitedVendorIds && listing.invitedVendorIds.length > 0 && (
            <div className="card p-6 bg-white border border-amber-100 dark:bg-slate-900">
              <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">mail</span>
                Invited Vendors
              </h4>
              <div className="space-y-2">
                {listing.invitedVendorIds.map((vid: string) => {
                  const vendor = users.find((u: any) => u.id === vid);
                  return (
                    <div key={vid} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                      <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{vendor?.name || vid}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card p-6 bg-[color:var(--color-primary-container)] text-[color:var(--color-on-primary-container)]">
            <h4 className="text-xs font-black uppercase tracking-widest opacity-70 mb-4">Sealed Bid Intelligence</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-[color:var(--color-on-primary-container)]/10 pb-4">
                <p className="text-xs font-bold">Total Bids Received</p>
                <p className="text-2xl font-headline font-bold">{sealedBids.length}</p>
              </div>
              {sealedBids.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Bid Range & Average</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/40 p-2 rounded-lg text-center">
                      <p className="text-[9px] opacity-60 uppercase font-black">Min</p>
                      <p className="text-xs font-headline font-bold">₹{(sealedBidMin/1000).toFixed(0)}k</p>
                    </div>
                    <div className="bg-white/60 p-2 rounded-lg text-center border border-white/40">
                      <p className="text-[9px] opacity-60 uppercase font-black">Avg</p>
                      <p className="text-xs font-headline font-bold">₹{(sealedBidAvg/1000).toFixed(0)}k</p>
                    </div>
                    <div className="bg-white/40 p-2 rounded-lg text-center">
                      <p className="text-[9px] opacity-60 uppercase font-black">Max</p>
                      <p className="text-xs font-headline font-bold">₹{(sealedBidMax/1000).toFixed(0)}k</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-2">Top Bids</p>
                  {[...sealedBids].sort((a: any, b: any) => b.amount - a.amount).slice(0, 3).map((bid: any) => (
                    <div key={bid.id} className="flex justify-between items-center bg-white/40 p-2 rounded-lg border border-white/20">
                      <span className="text-xs font-bold truncate max-w-[100px]">{bid.vendorName}</span>
                      <span className="text-sm font-headline font-bold">₹{bid.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2">
                <p className="text-[10px] italic leading-tight opacity-70">
                  Use sealed bid values to guide your base and target price.
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6 border-dashed border-2 border-slate-200 bg-slate-50 dark:bg-slate-950 dark:border-slate-700">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Auction Preview</h4>
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{listing.title}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="material-symbols-outlined text-sm">scale</span> {listing.weight} KG
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="material-symbols-outlined text-sm">location_on</span> {listing.location}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
