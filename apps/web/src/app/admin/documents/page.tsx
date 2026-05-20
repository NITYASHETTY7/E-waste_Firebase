"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";

type DocCategory = "all" | "kyc" | "compliance" | "payment";

interface DocRow {
  id: string;
  fileName: string;
  type: string;
  category: DocCategory;
  ownerName: string;
  ownerType: string;
  uploadedAt: string;
  signedUrl?: string;
  s3Key?: string;
  s3Bucket?: string;
}

export default function AdminDocuments() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DocCategory>("all");
  const [search, setSearch] = useState("");
  const [urlLoading, setUrlLoading] = useState<string | null>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    const rows: DocRow[] = [];

    try {
      // KYC documents from all companies
      const companiesRes = await api.get("/companies");
      for (const company of companiesRes.data || []) {
        for (const doc of company.kycDocuments || []) {
          rows.push({
            id: doc.id,
            fileName: doc.fileName,
            type: doc.type,
            category: "kyc",
            ownerName: company.name,
            ownerType: company.type,
            uploadedAt: doc.uploadedAt,
            signedUrl: doc.signedUrl,
            s3Key: doc.s3Key,
            s3Bucket: doc.s3Bucket,
          });
        }
      }
    } catch (e) { /* non-fatal */ }

    try {
      // Pickup/compliance documents
      const pickupsRes = await api.get("/pickups");
      for (const pickup of pickupsRes.data || []) {
        const clientName = pickup.auction?.client?.name || "—";
        for (const doc of pickup.pickupDocs || []) {
          rows.push({
            id: doc.id,
            fileName: doc.fileName,
            type: doc.type,
            category: "compliance",
            ownerName: clientName,
            ownerType: "PICKUP",
            uploadedAt: doc.uploadedAt,
            signedUrl: doc.signedUrl,
            s3Key: doc.s3Key,
            s3Bucket: doc.s3Bucket,
          });
        }
      }
    } catch (e) { /* non-fatal */ }

    try {
      // Payment proofs
      const paymentsRes = await api.get("/payments");
      for (const pmt of paymentsRes.data || []) {
        if (pmt.proofS3Key) {
          rows.push({
            id: pmt.id,
            fileName: `Payment_Proof_${pmt.id.slice(0, 8)}.pdf`,
            type: "PAYMENT_PROOF",
            category: "payment",
            ownerName: pmt.auctionId,
            ownerType: "PAYMENT",
            uploadedAt: pmt.updatedAt || pmt.createdAt,
            s3Key: pmt.proofS3Key,
            s3Bucket: pmt.proofS3Bucket,
          });
        }
      }
    } catch (e) { /* non-fatal */ }

    setDocs(rows);
    setLoading(false);
  };

  const getSignedUrl = async (doc: DocRow) => {
    if (doc.signedUrl) {
      window.open(doc.signedUrl, "_blank");
      return;
    }
    if (!doc.s3Key) return;
    setUrlLoading(doc.id);
    try {
      // For payment proofs, fetch via payments endpoint
      // For others, fetch via the companies endpoint
      const res = await api.get(`/companies/signed-url`, {
        params: { s3Key: doc.s3Key, s3Bucket: doc.s3Bucket },
      });
      window.open(res.data.url, "_blank");
    } catch (e) {
      alert("Could not generate download link. Please try again.");
    } finally {
      setUrlLoading(null);
    }
  };

  const filtered = docs.filter(d =>
    (category === "all" || d.category === category) &&
    (d.fileName.toLowerCase().includes(search.toLowerCase()) ||
      d.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      d.type.toLowerCase().includes(search.toLowerCase()))
  );

  const counts = {
    all: docs.length,
    kyc: docs.filter(d => d.category === "kyc").length,
    compliance: docs.filter(d => d.category === "compliance").length,
    payment: docs.filter(d => d.category === "payment").length,
  };

  const catIcon: Record<DocCategory, string> = {
    all: "folder_open",
    kyc: "badge",
    compliance: "verified",
    payment: "receipt_long",
  };

  const catColor: Record<DocCategory, string> = {
    all: "bg-slate-100 text-slate-600",
    kyc: "bg-purple-100 text-purple-700",
    compliance: "bg-emerald-100 text-emerald-700",
    payment: "bg-blue-100 text-blue-700",
  };

  const fmtType = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Document Library</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">All KYC, compliance, and payment documents stored in S3.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadDocs} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors" title="Refresh">
            <span className="material-symbols-outlined text-slate-600">refresh</span>
          </button>
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input className="input-base pl-10 h-11 text-sm" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "kyc", "compliance", "payment"] as DocCategory[]).map(t => (
          <button key={t} onClick={() => setCategory(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
              category === t ? "bg-primary text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"
            }`}>
            <span className="material-symbols-outlined text-sm">{catIcon[t]}</span>
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-16 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin block mb-3">progress_activity</span>
          <p className="text-slate-400">Loading documents from S3...</p>
        </div>
      ) : (
        <div className="card overflow-hidden border border-slate-100 dark:border-slate-800">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <span className="material-symbols-outlined text-5xl block mb-2">folder_open</span>
              No documents found
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(doc => (
                <div key={doc.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${catColor[doc.category]}`}>
                      <span className="material-symbols-outlined text-sm">{catIcon[doc.category]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-xs">{doc.fileName}</p>
                      <p className="text-xs text-slate-500">{doc.ownerName} · {fmtType(doc.type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${catColor[doc.category]}`}>{doc.category}</span>
                    <p className="text-xs text-slate-400">{new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</p>
                    <button
                      onClick={() => getSignedUrl(doc)}
                      disabled={urlLoading === doc.id}
                      title="View / Download"
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-primary hover:text-white text-slate-500 flex items-center justify-center transition-colors dark:bg-slate-800 disabled:opacity-50"
                    >
                      {urlLoading === doc.id
                        ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        : <span className="material-symbols-outlined text-sm">open_in_new</span>
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
