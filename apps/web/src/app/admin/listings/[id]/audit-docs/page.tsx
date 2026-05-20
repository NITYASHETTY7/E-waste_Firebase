"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

interface AuditDoc {
  id: string;
  vendorUserId: string;
  vendor?: { id: string; name: string; email: string };
  vendorName?: string;
  vendorEmail?: string;
  auditReportUrl?: string;
  auditReportFileName?: string;
  excelUrl?: string;
  excelFileName?: string;
  imageUrls?: string[];
  imageFileNames?: string[];
  status: "pending" | "approved" | "rejected";
  adminRemarks?: string;
  createdAt: string;
}

interface ListingDetails {
  id: string;
  title: string;
  category: string;
  weight: number;
  location: string;
  auctionPhase?: string;
  auditApprovedVendorIds: string[];
  sealedBidEventCreatedAt?: string;
  sealedBidDeadline?: string;
}

export default function AdminAuditDocsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { listings, addNotification } = useApp();

  const [docs, setDocs] = useState<AuditDoc[]>([]);
  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Sealed bid event modal
  const [sbeModal, setSbeModal] = useState(false);
  const [sbeStart, setSbeStart] = useState("");
  const [sbeDeadline, setSbeDeadline] = useState("");
  const [creatingSbe, setCreatingSbe] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const [docsRes, reqRes] = await Promise.all([
        api.get(`/requirements/${id}/audit-docs`).catch((e: any) => { throw new Error(e?.response?.data?.message || e?.message || "Failed to load audit docs"); }),
        api.get(`/requirements/${id}`).catch(() => null),
      ]);
      setDocs(docsRes.data || []);
      if (reqRes) {
        const data = reqRes.data;
        setListing({
          id: data.id,
          title: data.title,
          category: data.category,
          weight: data.totalWeight,
          location: data.location || "",
          auctionPhase: data.auction?.status,
          auditApprovedVendorIds: data.auditApprovedVendorIds || [],
          sealedBidEventCreatedAt: data.sealedBidEventCreatedAt,
          sealedBidDeadline: data.sealedBidDeadline,
        });
      }
    } catch (err: any) {
      setFetchError(err?.message || "Could not reach server");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Also get listing from context as fallback
  const contextListing = listings.find(l => l.id === id || l.requirementId === id);

  const handleReview = async (docId: string, action: "approve" | "reject") => {
    if (action === "reject" && !remarks.trim()) {
      showToast("Please provide a reason for rejection.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/requirements/${id}/audit-docs/${docId}/review`, { action, remarks: remarks || undefined });
      const doc = docs.find(d => d.id === docId);
      const vendorId = doc?.vendor?.id || doc?.vendorUserId;
      if (vendorId) {
        const listingTitle = listing?.title || contextListing?.title || "your auction";
        addNotification({
          userId: vendorId,
          type: action === "approve" ? "audit_approved" : "audit_rejected",
          title: action === "approve" ? "Audit Approved" : "Audit Rejected",
          message: action === "approve"
            ? `Your audit documents for "${listingTitle}" have been approved. You may now submit a sealed bid.`
            : `Your audit documents for "${listingTitle}" were rejected${remarks ? `: ${remarks}` : "."}`,
          link: `/vendor/invitations/${id}`,
        });
      }
      showToast(action === "approve" ? "Audit doc approved." : "Audit doc rejected.");
      setReviewingId(null);
      setRemarks("");
      await fetchData();
    } catch {
      showToast("Action failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSealedBidEvent = async () => {
    if (!sbeStart || !sbeDeadline) {
      showToast("Please set both start time and deadline.", "error");
      return;
    }
    if (new Date(sbeDeadline) <= new Date(sbeStart)) {
      showToast("Deadline must be after start time.", "error");
      return;
    }
    setCreatingSbe(true);
    try {
      await api.post(`/requirements/${id}/sealed-bid-event`, {
        sealedBidStart: new Date(sbeStart).toISOString(),
        sealedBidDeadline: new Date(sbeDeadline).toISOString(),
      });
      const listingTitle = listing?.title || contextListing?.title || "an auction";
      const approvedDocs = docs.filter(d => d.status === "approved");
      approvedDocs.forEach(doc => {
        const vendorId = doc.vendor?.id || doc.vendorUserId;
        if (vendorId) {
          addNotification({
            userId: vendorId,
            type: "sealed_bid_event",
            title: "Sealed Bid Window Open",
            message: `The sealed bid window for "${listingTitle}" is now open. Submit your bid before the deadline.`,
            link: `/vendor/invitations/${id}`,
          });
        }
      });
      showToast("Sealed bid event created! Vendors notified.");
      setSbeModal(false);
      setSbeStart("");
      setSbeDeadline("");
      await fetchData();
    } catch {
      showToast("Failed to create event.", "error");
    } finally {
      setCreatingSbe(false);
    }
  };

  const approvedCount = docs.filter(d => d.status === "approved").length;
  const pendingCount = docs.filter(d => d.status === "pending").length;
  const rejectedCount = docs.filter(d => d.status === "rejected").length;
  const canCreateEvent = approvedCount > 0 && !listing?.sealedBidEventCreatedAt;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2 px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm font-bold mb-4 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Audit Document Review</h1>
            <p className="text-slate-500 text-sm mt-1">
              {contextListing?.title || listing?.title || id}
            </p>
          </div>
          {listing?.sealedBidEventCreatedAt ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-bold">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Sealed Bid Event Created
              {listing.sealedBidDeadline && (
                <span className="font-normal text-green-600">
                  · Deadline: {new Date(listing.sealedBidDeadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSbeModal(true)}
              disabled={!canCreateEvent}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={!canCreateEvent ? "Approve at least one audit doc to create the event" : ""}
            >
              <span className="material-symbols-outlined text-base">campaign</span>
              Create Sealed Bid Event
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending Review", value: pendingCount, color: "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400", icon: "pending" },
          { label: "Approved", value: approvedCount, color: "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400", icon: "check_circle" },
          { label: "Rejected", value: rejectedCount, color: "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400", icon: "cancel" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-5 flex items-center gap-4 ${s.color} border-current/20`}>
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            <div>
              <p className="text-3xl font-black">{s.value}</p>
              <p className="text-xs font-bold uppercase tracking-widest opacity-70">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="px-5 py-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-xl shrink-0 mt-0.5">error</span>
          <div>
            <p className="font-bold text-red-700 dark:text-red-400 text-sm">Could not load audit documents</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{fetchError}</p>
            <button onClick={fetchData} className="mt-2 text-xs font-bold text-red-700 dark:text-red-400 underline">Retry</button>
          </div>
        </div>
      )}

      {/* Audit doc cards */}
      {!fetchError && docs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">folder_open</span>
          <p className="text-slate-500 font-bold">No audit documents submitted yet.</p>
          <p className="text-slate-400 text-sm mt-1">Vendors will appear here once they upload their audit reports.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {docs.map(doc => (
            <div key={doc.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Doc header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{doc.vendor?.name || doc.vendorName || "Vendor"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.vendor?.email || doc.vendorEmail} · Submitted {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                  doc.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : doc.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}>
                  {doc.status}
                </span>
              </div>

              {/* Files */}
              <div className="px-6 py-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  {doc.auditReportUrl && (
                    <a href={doc.auditReportUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 hover:border-blue-300 transition-colors">
                      <span className="material-symbols-outlined text-base">description</span>
                      {doc.auditReportFileName || "Audit Report"}
                    </a>
                  )}
                  {doc.excelUrl && (
                    <a href={doc.excelUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 hover:border-green-300 transition-colors">
                      <span className="material-symbols-outlined text-base">table_chart</span>
                      {doc.excelFileName || "Filled Excel"}
                    </a>
                  )}
                </div>

                {/* Site photos */}
                {doc.imageUrls && doc.imageUrls.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Site Photos ({doc.imageUrls.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {doc.imageUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={doc.imageFileNames?.[i] || `Photo ${i + 1}`}
                            className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin remarks (if rejected) */}
                {doc.adminRemarks && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-widest mb-1">Admin Remarks</p>
                    <p className="text-sm text-red-600 dark:text-red-400">{doc.adminRemarks}</p>
                  </div>
                )}

                {/* Review actions */}
                {doc.status === "pending" && reviewingId !== doc.id && (
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => { setReviewingId(doc.id); setRemarks(""); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Approve
                    </button>
                    <button
                      onClick={() => { setReviewingId(doc.id + "_reject"); setRemarks(""); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">cancel</span>
                      Reject
                    </button>
                  </div>
                )}

                {/* Approve confirm */}
                {reviewingId === doc.id && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-bold text-green-700 dark:text-green-400">Confirm approval for {doc.vendor?.name || doc.vendorName || "this vendor"}?</p>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Optional remarks for vendor..."
                      className="w-full px-3 py-2 rounded-xl border border-green-200 dark:border-green-800 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(doc.id, "approve")} disabled={saving}
                        className="flex-1 py-2 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Approving...</> : "Confirm Approve"}
                      </button>
                      <button onClick={() => { setReviewingId(null); setRemarks(""); }}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Reject confirm */}
                {reviewingId === doc.id + "_reject" && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">Rejection reason <span className="text-red-500">*</span></p>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Explain why the audit docs are being rejected..."
                      className="w-full px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(doc.id, "reject")} disabled={saving || !remarks.trim()}
                        className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Rejecting...</> : "Confirm Reject"}
                      </button>
                      <button onClick={() => { setReviewingId(null); setRemarks(""); }}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Re-review for already approved/rejected */}
                {doc.status !== "pending" && reviewingId !== doc.id && reviewingId !== doc.id + "_reject" && (
                  <button
                    onClick={() => { setReviewingId(doc.status === "approved" ? doc.id + "_reject" : doc.id); setRemarks(""); }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                  >
                    {doc.status === "approved" ? "Revoke approval" : "Re-approve"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sealed Bid Event Modal */}
      {sbeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Create Sealed Bid Event</h3>
              <p className="text-sm text-slate-500 mt-1">
                All <span className="font-bold text-primary">{approvedCount} audit-approved</span> vendors will receive an email and in-app notification to submit their sealed bid.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Bidding Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={sbeStart}
                onChange={e => setSbeStart(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              />
              <p className="text-[11px] text-slate-400">When vendors can begin submitting sealed bids.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Bidding Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={sbeDeadline}
                onChange={e => setSbeDeadline(e.target.value)}
                min={sbeStart || new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              />
              <p className="text-[11px] text-slate-400">Vendors must submit their sealed bid before this time.</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400 font-bold">
              <span className="material-symbols-outlined text-base align-middle mr-1">warning</span>
              This action cannot be undone. Vendors will be notified immediately.
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setSbeModal(false); setSbeDeadline(""); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={handleCreateSealedBidEvent} disabled={!sbeStart || !sbeDeadline || creatingSbe}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {creatingSbe
                  ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Creating...</>
                  : <><span className="material-symbols-outlined text-sm">campaign</span>Create & Notify Vendors</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
