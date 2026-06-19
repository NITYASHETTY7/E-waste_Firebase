"use client";

import { useApp } from "@/context/AppContext";
import { Listing } from "@/types";
import Link from "next/link";
import { formatDate, formatTime } from "@/utils/format";

function InvitationCard({ listing, status }: { listing: Listing; status: "pending" | "accepted" | "declined"; myId?: string }) {
  const isLive = listing.auctionPhase === 'live';
  const borderColor = isLive ? "border-red-500/30 bg-red-50/10" : status === "accepted" ? "border-emerald-500/30 bg-emerald-50/10" : status === "declined" ? "border-red-500/20 bg-red-50/5 opacity-70" : "border-blue-500/20 bg-blue-50/10";
  const iconColor = isLive ? "bg-red-600" : status === "accepted" ? "bg-emerald-600" : status === "declined" ? "bg-red-500" : "bg-blue-600";
  const icon = isLive ? "sensors" : status === "accepted" ? "check_circle" : status === "declined" ? "cancel" : "mail";
  const badgeColor = isLive ? "bg-red-600" : status === "accepted" ? "bg-emerald-600" : status === "declined" ? "bg-red-500" : "bg-blue-600";
  const badgeText = isLive ? "Live Now" : status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "New Invitation";
  const linkHref = status === "accepted" ? `/vendor/invitations/${listing.id}` : `/vendor/marketplace/${listing.id}`;
  const linkText = isLive ? "View Invitation & Live Auction" : status === "accepted" ? "Continue Process" : status === "declined" ? "View Details" : "View Invitation";

  return (
    <div className={`card p-0 flex flex-col group overflow-hidden border-2 ${borderColor}`}>
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 ${badgeColor} text-white rounded text-[8px] font-black uppercase tracking-widest`}>{badgeText}</span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{listing.category}</span>
            </div>
            <h3 className="text-xl font-headline font-extrabold text-slate-900 line-clamp-1 dark:text-white">{listing.title}</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">location_on</span>
              {listing.location}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl ${iconColor} text-white flex items-center justify-center shrink-0 shadow-lg`}>
            <span className="material-symbols-outlined">{icon}</span>
          </div>
        </div>

        <div className="bg-white/60 rounded-xl p-4 mb-6 border border-blue-100 dark:bg-white/5 dark:border-white/10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Available Qty</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{listing.weight} KG</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Value</p>
              <p className="text-sm font-bold text-[color:var(--color-primary)]">₹{listing.basePrice?.toLocaleString() || "—"}</p>
            </div>
          </div>
        </div>

        {listing.invitationDeadline && status === "pending" && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-red-600 uppercase tracking-widest mb-6 px-1">
            <span className="material-symbols-outlined text-xs animate-pulse">timer</span>
            Deadline: {formatDate(new Date(listing.invitationDeadline))} {formatTime(new Date(listing.invitationDeadline))}
          </div>
        )}

        <div className="mt-auto pt-6 border-t border-blue-100 dark:border-white/10">
          <Link href={linkHref} className={`btn-primary w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all ${
            status === "accepted" ? "bg-emerald-600 hover:bg-emerald-700" :
            status === "declined" ? "bg-slate-500 hover:bg-slate-600" :
            "bg-blue-600 hover:bg-blue-700"}`}>
            {linkText}
            <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VendorInvitations() {
  const { listings, currentUser } = useApp();

  const myId = currentUser?.companyId || currentUser?.id || "";
  // Show all listings the vendor is invited to (pending, accepted, or declined) — including live phase
  const invitationListings = listings.filter(l =>
    (l.auctionPhase === 'invitation_window' || l.auctionPhase === 'sealed_bid' || l.auctionPhase === 'live') &&
    l.invitedVendorIds?.includes(myId)
  );

  const pendingListings = invitationListings.filter(l =>
    !l.acceptedVendorIds?.includes(myId) && !l.declinedVendorIds?.includes(myId)
  );
  const acceptedListings = invitationListings.filter(l => l.acceptedVendorIds?.includes(myId));
  const declinedListings = invitationListings.filter(l => l.declinedVendorIds?.includes(myId));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Direct Invitations</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Exclusive auction opportunities hand-picked for you.</p>
      </div>

      {invitationListings.length === 0 ? (
        <div className="card p-20 text-center bg-white/50 border-dashed border-2 border-slate-200 dark:border-slate-700">
           <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">mail</span>
           <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Invitations Yet</h3>
           <p className="text-slate-500 mt-2">You don't have any invitations at the moment. Keep an eye on your inbox!</p>
           <Link href="/vendor/marketplace" className="btn-primary inline-flex items-center gap-2 mt-6 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-900 text-white">
              <span className="material-symbols-outlined text-sm text-amber-400">explore</span>
              Explore Market
           </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending */}
          {pendingListings.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Awaiting Response ({pendingListings.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingListings.map(listing => (
                  <InvitationCard key={listing.id} listing={listing} status="pending" myId={myId} />
                ))}
              </div>
            </section>
          )}

          {/* Accepted */}
          {acceptedListings.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-4">Accepted ({acceptedListings.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {acceptedListings.map(listing => (
                  <InvitationCard key={listing.id} listing={listing} status="accepted" myId={myId} />
                ))}
              </div>
            </section>
          )}

          {/* Declined */}
          {declinedListings.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-red-500 mb-4">Declined ({declinedListings.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {declinedListings.map(listing => (
                  <InvitationCard key={listing.id} listing={listing} status="declined" myId={myId} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
