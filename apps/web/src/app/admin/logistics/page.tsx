"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function AdminLogistics() {
  const { listings, bids, users } = useApp();
  const [filter, setFilter] = useState<"all" | "pending" | "pickup_scheduled" | "documents_uploaded" | "verified">("all");

  // Listings where payment is confirmed → pickup phase
  const logisticsListings = listings.filter(l =>
    l.paymentStatus === "confirmed" || l.complianceStatus
  );

  const filtered = logisticsListings.filter(l =>
    filter === "all" || (l.complianceStatus || "pending") === filter
  );

  const statusMeta = (status?: string) => {
    if (status === "verified") return { color: "bg-emerald-100 text-emerald-700", label: "Verified", icon: "verified" };
    if (status === "documents_uploaded") return { color: "bg-blue-100 text-blue-700", label: "Docs Uploaded", icon: "upload_file" };
    if (status === "pickup_scheduled") return { color: "bg-purple-100 text-purple-700", label: "Pickup Scheduled", icon: "event" };
    return { color: "bg-amber-100 text-amber-700", label: "Pending", icon: "hourglass_empty" };
  };

  const getWinner = (listingId: string) =>
    bids.find(b => b.listingId === listingId && b.status === "accepted");

  const stats = {
    total: logisticsListings.length,
    pending: logisticsListings.filter(l => !l.complianceStatus || l.complianceStatus === "pending").length,
    scheduled: logisticsListings.filter(l => l.complianceStatus === "pickup_scheduled").length,
    docsUploaded: logisticsListings.filter(l => l.complianceStatus === "documents_uploaded").length,
    verified: logisticsListings.filter(l => l.complianceStatus === "verified").length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Pickups & Logistics</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Track pickup scheduling, Form 6 submissions, and weight slips.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Pickups", value: stats.total, icon: "local_shipping", color: "text-blue-600 bg-blue-50" },
          { label: "Pending", value: stats.pending, icon: "hourglass_empty", color: "text-amber-600 bg-amber-50" },
          { label: "Scheduled", value: stats.scheduled, icon: "event", color: "text-purple-600 bg-purple-50" },
          { label: "Verified", value: stats.verified, icon: "verified", color: "text-primary bg-primary/10" },
        ].map(s => (
          <div key={s.label} className="card p-5 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <span className="material-symbols-outlined text-lg">{s.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-black text-[color:var(--color-on-surface)]">{s.value}</p>
                <p className="text-xs text-[color:var(--color-on-surface-variant)] font-medium">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "pickup_scheduled", "documents_uploaded", "verified"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${filter === f ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"}`}>
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">local_shipping</span>
          <p className="font-bold text-slate-600 dark:text-slate-400">No pickups in this status</p>
          <p className="text-sm text-slate-400 mt-1">Pickups appear once payment is confirmed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(listing => {
            const winner = getWinner(listing.id);
            const meta = statusMeta(listing.complianceStatus);
            const client = users.find(u => u.id === listing.userId);

            return (
              <div key={listing.id} className="card p-5 border border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-slate-400">{listing.id}</span>
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{listing.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{listing.location} · {listing.weight} KG · Client: {client?.name || listing.userName}</p>

                    {winner && (
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-bold">Vendor:</span> {winner.vendorName}
                        {listing.pickupScheduledDate && <> · <span className="font-bold">Scheduled:</span> {new Date(listing.pickupScheduledDate).toLocaleDateString("en-IN")}</>}
                      </p>
                    )}

                    {/* Compliance document checklist */}
                    {listing.complianceStatus && listing.complianceStatus !== "pending" && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[
                          { label: "Form 6", url: listing.form6Url, icon: "description" },
                          { label: "Weight Slip (Empty)", url: listing.weightSlipEmptyUrl, icon: "scale" },
                          { label: "Weight Slip (Loaded)", url: listing.weightSlipLoadedUrl, icon: "scale" },
                          { label: "Recycling Cert", url: listing.recyclingCertUrl, icon: "recycling" },
                          { label: "Disposal Cert", url: listing.disposalCertUrl, icon: "delete_forever" },
                        ].map(doc => (
                          <div key={doc.label} className={`p-2 rounded-xl border text-center ${doc.url ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                            <span className={`material-symbols-outlined text-lg block mb-0.5 ${doc.url ? "text-emerald-600" : "text-slate-300"}`}>{doc.icon}</span>
                            <p className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400">{doc.label}</p>
                            {doc.url && (
                              <a href={doc.url} download className="text-[9px] text-primary hover:underline">Download</a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <span className={`material-symbols-outlined text-2xl ${meta.color.split(" ")[1]}`}>{meta.icon}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
