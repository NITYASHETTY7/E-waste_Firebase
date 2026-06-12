"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

interface RequiredDoc {
  id: string;
  name: string;
  description: string;
  icon: string;
  required: boolean;
}

const REQUIRED_DOCS: RequiredDoc[] = [
  {
    id: "emd_receipt",
    name: "EMD Payment Receipt",
    description: "Demand Draft / NEFT confirmation of Earnest Money Deposit",
    icon: "receipt_long",
    required: true,
  },
  {
    id: "cpcb_cert",
    name: "CPCB Authorization Certificate",
    description: "Valid Central Pollution Control Board license for e-waste handling",
    icon: "verified_user",
    required: true,
  },
  {
    id: "company_pan",
    name: "Company PAN Card",
    description: "PAN card of the registered company / entity",
    icon: "badge",
    required: true,
  },
  {
    id: "gst_reg",
    name: "GST Registration Certificate",
    description: "Valid GST registration document with GSTIN",
    icon: "description",
    required: true,
  },
  {
    id: "declaration",
    name: "Bidder Declaration Form",
    description: "Signed declaration accepting auction terms and conditions",
    icon: "draw",
    required: true,
  },
  {
    id: "transport_auth",
    name: "Transport Authorization",
    description: "MoEFCC / SPCB authorization for hazardous goods transportation (if applicable)",
    icon: "local_shipping",
    required: false,
  },
];

interface UploadedEntry {
  docId: string;
  fileName: string;
}

export default function AuctionEntryPage() {
  const params = useParams();
  const router = useRouter();
  const { listings, currentUser } = useApp();

  const listingId = params?.id as string;
  const listing = listings.find((l) => l.id === listingId);

  const [uploads, setUploads] = useState<Map<string, UploadedEntry>>(new Map());
  const [uploading, setUploading] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const requiredDocs = REQUIRED_DOCS.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every((d) => uploads.has(d.id));
  const canProceed = allRequiredUploaded && agreed;

  const handleFileSelect = async (doc: RequiredDoc, file: File) => {
    setUploading(doc.id);
    // Simulate upload delay
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
    setUploads((prev) => {
      const next = new Map(prev);
      next.set(doc.id, { docId: doc.id, fileName: file.name });
      return next;
    });
    setUploading(null);
  };

  const handleRemove = (docId: string) => {
    setUploads((prev) => {
      const next = new Map(prev);
      next.delete(docId);
      return next;
    });
  };

  const handleFillDemo = async () => {
    const demoFiles: Record<string, string> = {
      emd_receipt: "EMD_DD_GreenRecyclersPvtLtd_2024.pdf",
      cpcb_cert: "CPCB_Authorization_GR_FY2024-25.pdf",
      company_pan: "GreenRecyclers_PAN_AABCG1234D.pdf",
      gst_reg: "GST_Reg_27AABCG1234D1Z5.pdf",
      declaration: "Bidder_Declaration_Signed.pdf",
      transport_auth: "MoEFCC_TransportAuth_KA2024.pdf",
    };
    for (const [id, name] of Object.entries(demoFiles)) {
      setUploading(id);
      await new Promise((r) => setTimeout(r, 400));
      setUploads((prev) => {
        const next = new Map(prev);
        next.set(id, { docId: id, fileName: name });
        return next;
      });
      setUploading(null);
    }
    setAgreed(true);
  };

  const handleProceed = async () => {
    if (!canProceed) {
      setError("Please upload all required documents and accept the terms.");
      return;
    }
    setSubmitting(true);
    setError("");
    // Simulate a brief verification
    await new Promise((r) => setTimeout(r, 1200));
    router.push(`/vendor/auctions/${listingId}/live`);
  };

  const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  if (!listing) {
    return (
      <div className="p-10 text-center">
        <p className="text-slate-500">Auction listing not found.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 underline text-sm text-slate-600 dark:text-slate-400"
        >
          Go back
        </button>
      </div>
    );
  }

  const uploadedCount = uploads.size;
  const totalDocs = REQUIRED_DOCS.length;
  const progressPct = Math.round((uploadedCount / totalDocs) * 100);

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.back()}
              className="text-slate-400 hover:text-slate-700 transition"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </button>
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Auction Entry
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Document Verification Gate
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Upload the required documents below to enter the live auction.
          </p>
        </div>

        <button
          onClick={handleFillDemo}
          className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          Fill Demo Docs
        </button>
      </div>

      {/* Lot info card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <span className="material-symbols-outlined text-[8rem]">gavel</span>
        </div>
        <div className="flex flex-wrap gap-6 relative z-10">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-500">Lot ID</p>
            <p className="text-white font-mono font-bold text-sm">{listing.id}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-500">Description</p>
            <p className="text-white font-bold text-sm truncate">{listing.title}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-500">Base Price</p>
            <p className="text-emerald-400 font-mono font-bold text-sm">{fmtINR(listing.basePrice ?? 0)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-500">EMD Required</p>
            <p className="text-amber-400 font-mono font-bold text-sm">{fmtINR(listing.highestEmdAmount ?? 0)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-500">Tick Size</p>
            <p className="text-blue-400 font-mono font-bold text-sm">{fmtINR(listing.bidIncrement ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Upload Progress
          </span>
          <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">
            {uploadedCount} / {totalDocs} documents
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Document upload list */}
      <div className="space-y-3 mb-6">
        {REQUIRED_DOCS.map((doc) => {
          const uploaded = uploads.get(doc.id);
          const isUploading = uploading === doc.id;

          return (
            <div
              key={doc.id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 flex items-start gap-4 transition-all ${
                uploaded
                  ? "border-emerald-200 bg-emerald-50/20"
                  : doc.required
                  ? "border-slate-200 dark:border-slate-800"
                  : "border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30"
              }`}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  uploaded
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <span
                  className="material-symbols-outlined text-xl"
                >
                  {uploaded ? "check_circle" : doc.icon}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-sm text-slate-900 dark:text-white">
                    {doc.name}
                  </p>
                  {doc.required ? (
                    <span className="text-[8px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">
                      Required
                    </span>
                  ) : (
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full dark:bg-slate-800">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {doc.description}
                </p>

                {uploaded && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="material-symbols-outlined text-emerald-500 text-sm">
                      attach_file
                    </span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[240px]">
                      {uploaded.fileName}
                    </span>
                    <button
                      onClick={() => handleRemove(doc.id)}
                      className="text-slate-400 hover:text-red-500 transition ml-1"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="shrink-0">
                {isUploading ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                    <span className="material-symbols-outlined text-base animate-spin">
                      progress_activity
                    </span>
                    Uploading…
                  </span>
                ) : uploaded ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-black uppercase tracking-wider">
                    <span className="material-symbols-outlined text-sm">
                      verified
                    </span>
                    Uploaded
                  </span>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(doc, file);
                        e.target.value = "";
                      }}
                    />
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-blue-100 text-blue-600 hover:bg-blue-50 transition-all dark:border-blue-900/30 dark:text-blue-400">
                      <span className="material-symbols-outlined text-sm">upload</span>
                      Upload
                    </span>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terms acceptance */}
      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl mb-8">
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="mt-0.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="hidden"
            />
            <div
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                agreed
                  ? "bg-blue-600 border-blue-600"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            >
              {agreed && (
                <span className="material-symbols-outlined text-white text-base">
                  check
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              I accept the Auction Terms & Conditions
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              I confirm that all uploaded documents are authentic and legally valid. I understand that placing a bid constitutes a binding offer and that my EMD is subject to forfeiture in case of bid withdrawal post-confirmation.
            </p>
          </div>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl mb-6 text-xs text-red-600 font-bold">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {/* Proceed button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => router.back()}
          className="flex-1 py-4 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleProceed}
          disabled={!canProceed || submitting}
          className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all
            ${canProceed
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20 hover:bg-blue-700"
              : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800"
            }`}
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              Verifying & Entering Auction…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">gavel</span>
              Enter Live Auction
              {!canProceed && (
                <span className="text-[9px] font-bold normal-case tracking-normal ml-1 opacity-60">
                  ({requiredDocs.filter((d) => !uploads.has(d.id)).length} required docs missing)
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
