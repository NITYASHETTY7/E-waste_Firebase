"use client";

import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface InvitationDetails {
  id: string;
  title: string;
  description?: string;
  category?: string;
  totalWeight?: number;
  sealedPhaseStart?: string;
  sealedPhaseEnd?: string;
  sealedBidDeadline?: string;
  sealedBidEventCreatedAt?: string;
  openPhaseStart?: string | null;
  openPhaseEnd?: string | null;
  clientName?: string;
  processedSheetUrl?: string;
  isInvited: boolean;
  hasAccepted: boolean;
  hasDeclined: boolean;
  auditApproved: boolean;
  auditDoc?: { status: string; adminRemarks?: string } | null;
  hasSealedBid: boolean;
  sealedBidAmount?: number | null;
  auctionId?: string;
  auctionStatus?: string | null;
  auctionLiveApprovalStatus?: string;
}

export default function VendorInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser, addNotification } = useApp();

  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [auditFile, setAuditFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docsSubmitted, setDocsSubmitted] = useState(false);

  const auditRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchDetails = async () => {
    try {
      const res = await api.get(`/requirements/${id}/invitation`);
      setDetails(res.data);
      setFetchError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to load invitation details.";
      setFetchError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetails(); }, [id]);

  useEffect(() => {
    const action = searchParams?.get("action");
    if (action === "accept" || action === "decline") {
      if (details && !details.hasAccepted && !details.hasDeclined) handleRespond(action);
    }
  }, [details]);

  const handleRespond = async (action: "accept" | "decline") => {
    if (!details || details.hasAccepted || details.hasDeclined) return;
    setResponding(true);
    try {
      await api.patch(`/requirements/${id}/invitation-respond`, { action });
      await fetchDetails();
      showToast(
        action === "accept" ? "Invitation accepted! Download the sheet and complete your site visit." : "You have declined this invitation.",
        action === "accept" ? "success" : "error",
      );
    } catch { showToast("Failed to respond. Please try again.", "error"); }
    finally { setResponding(false); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImages(prev => [...prev, ...Array.from(e.target.files || [])]);
  };

  const handleSubmitDocs = async () => {
    if (!auditFile && !excelFile && images.length === 0) {
      showToast("Upload at least one document or photo.", "error");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      if (auditFile) fd.append("auditReport", auditFile);
      if (excelFile) fd.append("filledExcel", excelFile);
      images.forEach(img => fd.append("images", img));
      await api.post(`/requirements/${id}/audit-docs`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDocsSubmitted(true);
      await fetchDetails();
      addNotification({
        userId: currentUser?.id || "",
        type: "general",
        title: "Audit Docs Submitted",
        message: `Your audit documents for "${details?.title || 'the listing'}" have been submitted. The admin will review them shortly.`,
        link: `/vendor/invitations/${id}`,
      });
      showToast("Audit documents submitted! Admin will review them.");
    } catch { showToast("Upload failed. Please try again.", "error"); }
    finally { setUploading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
    </div>
  );

  if (!details) return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <span className="material-symbols-outlined text-5xl text-slate-300 block mb-4">error</span>
      <h2 className="text-xl font-bold text-[color:var(--color-on-surface)]">Invitation not found</h2>
      {fetchError && <p className="text-sm text-slate-500 mt-2">{fetchError}</p>}
    </div>
  );

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  const auditStatus = details.auditDoc?.status || (docsSubmitted ? "pending" : null);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Sealed Bid Invitation</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Complete the site audit and submit your sealed bid when invited.</p>
      </div>

      {/* Listing details */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-[color:var(--color-on-surface)]">{details.title}</h3>
            <p className="text-sm text-[color:var(--color-on-surface-variant)] mt-1">{details.clientName}</p>
          </div>
          {details.hasAccepted && <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 uppercase tracking-wider shrink-0">Accepted</span>}
          {details.hasDeclined && <span className="px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 uppercase tracking-wider shrink-0">Declined</span>}
          {!details.hasAccepted && !details.hasDeclined && <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700 uppercase tracking-wider shrink-0 animate-pulse">Awaiting Response</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Category", value: details.category || "—" },
            { label: "Weight", value: details.totalWeight ? `${details.totalWeight} KG` : "—" },
            { label: "Sealed Bid Opens", value: fmtDate(details.sealedPhaseStart) },
            { label: "Sealed Bid Closes", value: fmtDate(details.sealedBidDeadline || details.sealedPhaseEnd) },
          ].map(d => (
            <div key={d.label} className="bg-[color:var(--color-surface-container-low)] rounded-xl p-3">
              <p className="text-[10px] font-black text-[color:var(--color-on-surface-variant)] uppercase tracking-widest mb-0.5">{d.label}</p>
              <p className="text-sm font-bold text-[color:var(--color-on-surface)]">{d.value}</p>
            </div>
          ))}
        </div>
        {details.description && <p className="text-sm text-[color:var(--color-on-surface-variant)] leading-relaxed">{details.description}</p>}
      </div>

      {/* Accept / Decline */}
      {!details.hasAccepted && !details.hasDeclined && (
        <div className="card p-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] mb-4">Respond to Invitation</h4>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => handleRespond("decline")} disabled={responding}
              className="flex-1 py-3 rounded-xl border-2 border-red-300 text-red-600 font-black text-sm hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              <span className="material-symbols-outlined text-sm">cancel</span>Decline
            </button>
            <button onClick={() => handleRespond("accept")} disabled={responding}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              {responding ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Processing...</> : <><span className="material-symbols-outlined text-sm">check_circle</span>Accept Invitation</>}
            </button>
          </div>
        </div>
      )}

      {details.hasDeclined && (
        <div className="card p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-red-300 block mb-3">cancel</span>
          <h3 className="text-lg font-black text-[color:var(--color-on-surface)] mb-2">Invitation Declined</h3>
          <p className="text-sm text-[color:var(--color-on-surface-variant)]">Contact admin if this was a mistake.</p>
        </div>
      )}

      {details.hasAccepted && (
        <>
          {/* Step 1 — Upload Audit Docs (includes material sheet download) */}
          {/* Hide upload if already submitted sealed bid */}
          {details.hasSealedBid ? (
            <div className="card p-6 space-y-4 border-2 border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                  <span className="material-symbols-outlined text-xs">check</span>
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest text-emerald-700">Audit Documents Submitted</h4>
              </div>
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-5xl text-emerald-400 block mb-3">task_alt</span>
                <p className="font-bold text-emerald-700">You have already submitted your sealed bid.</p>
                <p className="text-sm text-slate-500 mt-1">Audit documents cannot be modified after bid submission.</p>
              </div>
            </div>
          ) : !auditStatus || auditStatus === "pending" ? (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white ${auditStatus === "pending" ? "bg-amber-500" : "bg-blue-600"}`}>1</div>
                <h4 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)]">
                  {auditStatus === "pending" ? "Audit Docs Submitted — Awaiting Admin Review" : "Upload Audit Documents"}
                </h4>
              </div>

              {/* Material sheet download (embedded in step 1) */}
              {!auditStatus && (
                <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div>
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Material Sheet</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Download and review before uploading your audit report</p>
                  </div>
                  {details.processedSheetUrl ? (
                    <a href={details.processedSheetUrl} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all">
                      <span className="material-symbols-outlined text-sm">download</span>Download
                    </a>
                  ) : (
                    <span className="text-xs text-amber-600 font-bold">Not available yet</span>
                  )}
                </div>
              )}

              {auditStatus === "pending" ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-5xl text-amber-400 block mb-3 animate-pulse">hourglass_top</span>
                  <p className="font-bold text-amber-700">Your audit documents are under review.</p>
                  <p className="text-sm text-slate-500 mt-1">Admin will approve or reject your submission. You'll get a notification.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[color:var(--color-on-surface-variant)]">After completing your site visit, upload your audit report, filled Excel, and site photos.</p>

                  {/* Audit report */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] mb-2">Audit Report (PDF)</p>
                    <div onClick={() => auditRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${auditFile ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-200 hover:border-[color:var(--color-primary)] hover:bg-slate-50 dark:border-slate-700"}`}>
                      <input ref={auditRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setAuditFile(e.target.files?.[0] || null)} />
                      {auditFile ? (
                        <><span className="material-symbols-outlined text-2xl text-emerald-600 block mb-1">check_circle</span><p className="font-bold text-sm text-emerald-700">{auditFile.name}</p></>
                      ) : (
                        <><span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">description</span><p className="text-sm text-slate-500 font-bold">Click to upload Audit Report</p><p className="text-xs text-slate-400">PDF, DOC, DOCX</p></>
                      )}
                    </div>
                  </div>

                  {/* Filled Excel */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] mb-2">Filled Price Sheet (Excel)</p>
                    <div onClick={() => excelRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${excelFile ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-200 hover:border-[color:var(--color-primary)] hover:bg-slate-50 dark:border-slate-700"}`}>
                      <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
                      {excelFile ? (
                        <><span className="material-symbols-outlined text-2xl text-emerald-600 block mb-1">check_circle</span><p className="font-bold text-sm text-emerald-700">{excelFile.name}</p></>
                      ) : (
                        <><span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">table_chart</span><p className="text-sm text-slate-500 font-bold">Click to upload Filled Price Sheet</p><p className="text-xs text-slate-400">XLSX, XLS, CSV</p></>
                      )}
                    </div>
                  </div>

                  {/* Site Visit Photos */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] mb-2">Site Visit Photos</p>
                    <div onClick={() => imageRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-[color:var(--color-primary)] hover:bg-slate-50 dark:border-slate-700 rounded-xl p-5 text-center cursor-pointer transition-colors">
                      <input ref={imageRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                      <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">add_photo_alternate</span>
                      <p className="text-sm text-slate-500 font-bold">Click to add site photos</p>
                      <p className="text-xs text-slate-400">JPG, PNG, WEBP — up to 10 photos</p>
                    </div>
                    {images.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        {images.map((img, i) => (
                          <div key={i} className="relative group">
                            <img src={URL.createObjectURL(img)} alt="" className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                            <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white items-center justify-center hidden group-hover:flex">
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={handleSubmitDocs} disabled={uploading || (!auditFile && !excelFile && images.length === 0)}
                    className="w-full py-4 rounded-xl bg-[color:var(--color-primary)] text-white font-black text-sm hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
                    {uploading ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Uploading...</> : <><span className="material-symbols-outlined text-sm">cloud_upload</span>Submit Audit Documents</>}
                  </button>
                </>
              )}
            </div>
          ) : auditStatus === "rejected" ? (
            <div className="card p-6 space-y-4 border-2 border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-black">1</div>
                <h4 className="text-sm font-black uppercase tracking-widest text-red-600">Audit Documents Rejected</h4>
              </div>
              <div className="p-4 bg-red-50 rounded-xl">
                <p className="text-sm font-bold text-red-700">Your documents were rejected.</p>
                {details.auditDoc?.adminRemarks && <p className="text-sm text-red-600 mt-1">Reason: {details.auditDoc.adminRemarks}</p>}
              </div>
              <p className="text-sm text-slate-500">Please resubmit corrected documents.</p>
              <button onClick={() => { setDocsSubmitted(false); setAuditFile(null); setExcelFile(null); setImages([]); }}
                className="btn-primary py-3 px-6 rounded-xl text-sm font-black bg-slate-900 text-white border-none">
                Resubmit Documents
              </button>
            </div>
          ) : null}

          {/* Step 2 — Sealed Bid (only after audit approved AND event created) */}
          {details.auditApproved && (
            <div className={`card p-6 space-y-4 ${details.sealedBidEventCreatedAt ? "border-2 border-purple-200" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white ${details.hasSealedBid ? "bg-emerald-600" : details.sealedBidEventCreatedAt ? "bg-purple-600" : "bg-slate-400"}`}>
                  {details.hasSealedBid ? <span className="material-symbols-outlined text-xs">check</span> : "2"}
                </div>
                <h4 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)]">Submit Sealed Bid</h4>
              </div>

              {!details.sealedBidEventCreatedAt ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">lock_clock</span>
                  <p className="text-sm font-bold text-slate-500">Waiting for admin to create the sealed bid event.</p>
                  <p className="text-xs text-slate-400 mt-1">You'll receive a notification when it's time to bid.</p>
                </div>
              ) : details.hasSealedBid ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-5xl text-emerald-400 block mb-3">task_alt</span>
                  <p className="font-bold text-emerald-700">Sealed Bid Submitted!</p>
                  <p className="text-sm text-slate-500 mt-1">Your bid of <strong>₹{details.sealedBidAmount?.toLocaleString()}</strong> has been recorded.</p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-xs font-bold text-purple-700">Sealed bid event is open! Deadline: {fmtDate(details.sealedBidDeadline)}</p>
                  </div>
                  <button onClick={() => router.push(`/vendor/sealed-bid/${id}`)}
                    className="btn-primary w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white border-none flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">gavel</span>Submit Your Sealed Bid
                  </button>
                </>
              )}
            </div>
          )}

          {/* Live Auction notice (no step number) */}
          {details.hasSealedBid && details.auctionLiveApprovalStatus === 'approved' && (
            <div className="card p-6 space-y-4 border-2 border-emerald-300">
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-5xl text-emerald-400 block mb-3">celebration</span>
                <p className="font-bold text-emerald-700">You're approved for the live open auction!</p>
              </div>
              {(details.openPhaseStart || details.openPhaseEnd) && (
                <div className="grid grid-cols-2 gap-3">
                  {details.openPhaseStart && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Live Bidding Starts</p>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{fmtDate(details.openPhaseStart)}</p>
                    </div>
                  )}
                  {details.openPhaseEnd && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-0.5">Auction Ends</p>
                      <p className="text-sm font-bold text-red-800 dark:text-red-300">{fmtDate(details.openPhaseEnd)}</p>
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => router.push(`/vendor/live-auction`)} className="btn-primary w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                <span className="material-symbols-outlined text-sm">sensors</span>Join Live Auction
              </button>
            </div>
          )}
          {details.hasSealedBid && details.auctionLiveApprovalStatus !== 'approved' && (
            <div className="px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">pending</span>
              <p className="text-sm text-slate-500 font-bold">Awaiting client approval of live auction parameters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
