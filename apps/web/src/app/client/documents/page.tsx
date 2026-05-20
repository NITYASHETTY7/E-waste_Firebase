"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

interface KycDoc {
  id: string;
  fileName: string;
  type: string;
  uploadedAt: string;
  signedUrl?: string;
  s3Key: string;
  s3Bucket: string;
}

const fmtType = (t: string) =>
  t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export default function ClientDocuments() {
  const { listings, bids, currentUser, rateVendor, vendorRatings } = useApp();
  const [kycDocs, setKycDocs] = useState<KycDoc[]>([]);
  const [loadingKyc, setLoadingKyc] = useState(true);
  const [urlLoading, setUrlLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"kyc" | "compliance">("kyc");
  const [ratingModal, setRatingModal] = useState<{ open: boolean; listingId: string | null; vendorId: string | null; vendorName: string | null }>({ open: false, listingId: null, vendorId: null, vendorName: null });
  const [ratingVals, setRatingVals] = useState({ overall: 5, audit: 5, timeliness: 5, compliance: 5, comment: "" });

  useEffect(() => {
    if (currentUser?.companyId) {
      loadKycDocs(currentUser.companyId);
    } else {
      setLoadingKyc(false);
    }
  }, [currentUser?.companyId]);

  const loadKycDocs = async (companyId: string) => {
    setLoadingKyc(true);
    try {
      const res = await api.get(`/companies/${companyId}`);
      setKycDocs(res.data?.kycDocuments || []);
    } catch (e) {
      console.error("Failed to load KYC docs", e);
    } finally {
      setLoadingKyc(false);
    }
  };

  const openDoc = async (doc: KycDoc) => {
    if (doc.signedUrl) { window.open(doc.signedUrl, "_blank"); return; }
    setUrlLoading(doc.id);
    try {
      const res = await api.get("/companies/signed-url", {
        params: { s3Key: doc.s3Key, s3Bucket: doc.s3Bucket },
      });
      window.open(res.data.url, "_blank");
    } catch {
      alert("Could not open document. Please try again.");
    } finally {
      setUrlLoading(null);
    }
  };

  const completedListings = listings.filter(l =>
    l.userId === currentUser?.id && l.complianceStatus === "verified"
  );

  const getWinBid = (listingId: string) =>
    bids.find(b => b.listingId === listingId && b.status === "accepted");

  const COMPLIANCE_DOCS = [
    { key: "form6Url" as const, label: "Form 6", icon: "description" },
    { key: "weightSlipEmptyUrl" as const, label: "Weight Slip (Empty)", icon: "scale" },
    { key: "weightSlipLoadedUrl" as const, label: "Weight Slip (Loaded)", icon: "scale" },
    { key: "recyclingCertUrl" as const, label: "Recycling Certificate", icon: "recycling" },
    { key: "disposalCertUrl" as const, label: "Disposal Certificate", icon: "delete_forever" },
  ];

  const totalKyc = kycDocs.length;
  const totalCompliance = completedListings.reduce((s, l) =>
    s + COMPLIANCE_DOCS.filter(d => !!l[d.key]).length, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">My Documents</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">View and download your registration and compliance documents.</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-primary">{totalKyc + totalCompliance}</p>
          <p className="text-xs font-bold text-slate-500 uppercase">Docs on File</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-[color:var(--color-surface-container-low)] rounded-xl w-fit">
        {([
          { key: "kyc", label: `Registration (${totalKyc})`, icon: "badge" },
          { key: "compliance", label: `Compliance (${totalCompliance})`, icon: "verified" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              tab === t.key ? "bg-white shadow-sm text-[color:var(--color-on-surface)]" : "text-[color:var(--color-on-surface-variant)]"
            }`}>
            <span className="material-symbols-outlined text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "kyc" && (
        <div className="space-y-3">
          {loadingKyc ? (
            <div className="card p-12 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin block mb-2">progress_activity</span>
              <p className="text-slate-400 text-sm">Loading documents...</p>
            </div>
          ) : kycDocs.length === 0 ? (
            <div className="card p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">badge</span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Registration Documents</h3>
              <p className="text-slate-500 mt-2">Documents uploaded during onboarding will appear here.</p>
            </div>
          ) : (
            kycDocs.map(doc => (
              <div key={doc.id} className="card p-4 flex items-center justify-between gap-4 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-purple-600">description</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">{fmtType(doc.type)} · {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
                <button
                  onClick={() => openDoc(doc)}
                  disabled={urlLoading === doc.id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all disabled:opacity-50"
                >
                  {urlLoading === doc.id
                    ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Loading...</>
                    : <><span className="material-symbols-outlined text-sm">open_in_new</span>View</>
                  }
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "compliance" && (
        <div className="space-y-5">
          {completedListings.length === 0 ? (
            <div className="card p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">verified</span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Compliance Documents Yet</h3>
              <p className="text-slate-500 mt-2">Documents become available once e-waste disposal is fully verified.</p>
            </div>
          ) : (
            completedListings.map(listing => {
              const win = getWinBid(listing.id);
              return (
                <div key={listing.id} className="card p-0 overflow-hidden border-2 border-emerald-200">
                  <div className="p-5 bg-emerald-50/50 border-b border-emerald-100 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-slate-400">{listing.id}</span>
                        <span className="text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase bg-emerald-100 text-emerald-700">Disposal Verified</span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{listing.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{listing.location} · {listing.weight} KG · Vendor: {win?.vendorName || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!vendorRatings.some(r => r.listingId === listing.id) && (
                        <button
                          onClick={() => setRatingModal({ open: true, listingId: listing.id, vendorId: win?.vendorId || "", vendorName: win?.vendorName || "" })}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100"
                        >
                          <span className="material-symbols-outlined text-sm">star</span>Rate Vendor
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3">
                    {COMPLIANCE_DOCS.map(doc => {
                      const url = listing[doc.key];
                      return (
                        <div key={doc.key} className={`p-3 rounded-xl border text-center ${url ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100" : "border-dashed border-slate-200 bg-slate-50 opacity-50"}`}>
                          <span className={`material-symbols-outlined text-xl block mb-1 ${url ? "text-emerald-600" : "text-slate-300"}`}>{doc.icon}</span>
                          <p className="text-[9px] font-black uppercase text-slate-600 leading-tight mb-2 dark:text-slate-400">{doc.label}</p>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer"
                              className="text-[9px] font-black text-primary px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary hover:text-white transition-colors block">
                              Download
                            </a>
                          ) : (
                            <p className="text-[9px] text-slate-400">Not available</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {ratingModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-xl font-headline font-extrabold text-slate-900 dark:text-white">Rate Vendor</h3>
              <p className="text-sm text-slate-500">Rate {ratingModal.vendorName}&apos;s performance.</p>
            </div>
            <div className="space-y-4">
              {[
                { key: "overall", label: "Overall Experience" },
                { key: "audit", label: "Audit Accuracy" },
                { key: "timeliness", label: "Pickup Timeliness" },
                { key: "compliance", label: "Compliance Handling" },
              ].map(cat => (
                <div key={cat.key} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{cat.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRatingVals(p => ({ ...p, [cat.key]: star }))}>
                        <span className={`material-symbols-outlined text-xl transition-all ${
                          star <= (ratingVals[cat.key as keyof typeof ratingVals] as number) ? "text-amber-400" : "text-slate-200 hover:text-amber-200"
                        }`} style={{ fontVariationSettings: star <= (ratingVals[cat.key as keyof typeof ratingVals] as number) ? "'FILL' 1" : "" }}>
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <label className="label">Comment (Optional)</label>
                <textarea className="input-base min-h-[80px] resize-none" placeholder="Share your experience..."
                  value={ratingVals.comment} onChange={e => setRatingVals(p => ({ ...p, comment: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setRatingModal({ open: false, listingId: null, vendorId: null, vendorName: null })}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700">Cancel</button>
              <button
                onClick={() => {
                  if (ratingModal.listingId && ratingModal.vendorId && ratingModal.vendorName) {
                    rateVendor(ratingModal.listingId, ratingModal.vendorId, ratingModal.vendorName, ratingVals.overall, ratingVals.audit, ratingVals.timeliness, ratingVals.compliance, ratingVals.comment);
                    setRatingModal({ open: false, listingId: null, vendorId: null, vendorName: null });
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600">
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
