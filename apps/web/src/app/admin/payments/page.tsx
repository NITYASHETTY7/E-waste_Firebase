"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminPayments() {
  const { listings, confirmPayment } = useApp();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);
  const [proofModal, setProofModal] = useState<{ url: string; isImage: boolean } | null>(null);
  const [loadingProof, setLoadingProof] = useState<string | null>(null);

  const buildMockPayments = (listingSnapshot: typeof listings) =>
    listingSnapshot
      .filter(l => l.paymentStatus && l.winnerVendorId)
      .map(l => {
        const statusMap: Record<string, string> = {
          pending: 'PENDING',
          proof_uploaded: 'SUBMITTED',
          confirmed: 'CONFIRMED',
        };
        return {
          id: `MOCK-${l.id}`,
          _listingId: l.id,
          status: statusMap[l.paymentStatus || 'pending'] || 'PENDING',
          clientAmount: l.paymentClientAmount || 0,
          commissionAmount: l.paymentCommissionAmount || 0,
          totalAmount: (l.paymentClientAmount || 0) + (l.paymentCommissionAmount || 0),
          utrNumber: l.paymentUTR,
          proofS3Key: l.paymentProofUrl,
          proofS3Bucket: 'ecoloop-uploads',
          paymentProofUrl: l.paymentProofUrl,
          paymentSubmittedAt: l.paymentSubmittedAt,
          auction: {
            id: l.id,
            title: l.title,
            client: { name: l.userName || '—' },
            winner: { name: l.winnerVendorName || '—' },
          },
        };
      });

  const fetchPayments = async (currentListings?: typeof listings) => {
    try {
      setLoading(true);
      const res = await api.get('/payments');
      setPayments(res.data);
    } catch {
      // Backend unavailable — build from in-memory listing state
      setPayments(buildMockPayments(currentListings ?? listings));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleVerify = async (paymentId: string) => {
    if (paymentId.startsWith('MOCK-')) {
      const listingId = paymentId.replace('MOCK-', '');
      try {
        await confirmPayment(listingId);
        setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'CONFIRMED' } : p));
        showToast("Payment verified successfully.");
      } catch {
        showToast("Verification failed.", "error");
      }
      return;
    }
    try {
      await api.patch(`/admin/payments/${paymentId}/verify`);
      showToast("Payment verified successfully.");
      fetchPayments();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Verification failed.", "error");
    }
  };

  const handleViewProof = async (payment: any) => {
    const proofKey = payment.proofS3Key || payment.paymentProofUrl;
    if (!proofKey) return;
    setLoadingProof(payment.id);
    try {
      // If it's already a full HTTP URL, blob, or data URI, use it directly
      if (proofKey.startsWith('http') || proofKey.startsWith('blob:') || proofKey.startsWith('data:')) {
        const urlWithoutQuery = proofKey.split('?')[0];
        const isImage = proofKey.startsWith('data:image') || /\.(png|jpg|jpeg|gif|webp)$/i.test(urlWithoutQuery);
        setProofModal({ url: proofKey, isImage });
        return;
      }
      // Otherwise fetch a pre-signed S3 URL
      const bucket = payment.proofS3Bucket || 'ecoloop-uploads';
      const res = await api.get(`/companies/signed-url?s3Key=${encodeURIComponent(proofKey)}&s3Bucket=${encodeURIComponent(bucket)}`);
      const signedUrl = res.data?.url || res.data?.signedUrl || res.data;
      if (typeof signedUrl === 'string') {
        const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(proofKey);
        setProofModal({ url: signedUrl, isImage });
      } else {
        showToast("Could not retrieve proof URL.", "error");
      }
    } catch {
      showToast("Failed to load proof. Please try again.", "error");
    } finally {
      setLoadingProof(null);
    }
  };

  const statusMeta = (status?: string) => {
    if (status === "CONFIRMED") return { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Confirmed" };
    if (status === "SUBMITTED") return { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Proof Uploaded" };
    return { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Awaiting Payment" };
  };

  const stats = {
    total: payments.length,
    pending: payments.filter(p => p.status === "PENDING").length,
    proofUploaded: payments.filter(p => p.status === "SUBMITTED").length,
    confirmed: payments.filter(p => p.status === "CONFIRMED").length,
    totalValue: payments.filter(p => p.status === "CONFIRMED").reduce((s, p) => s + (p.totalAmount || 0), 0),
  };

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pb-20">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-xl z-50 text-white font-bold text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Payment Management</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Monitor vendor payment submissions and confirm settlements.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Deals", value: stats.total, icon: "payments", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20" },
            { label: "Awaiting Payment", value: stats.pending, icon: "hourglass_empty", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20" },
            { label: "Proof Submitted", value: stats.proofUploaded, icon: "upload_file", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
            { label: "Confirmed", value: stats.confirmed, icon: "verified", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
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

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="card p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
            <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">payments</span>
            <p className="font-bold text-slate-600 dark:text-slate-400">No payments to review yet</p>
          </div>
        ) : (
          <div className="card overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map(payment => {
                const meta = statusMeta(payment.status);
                const auction = payment.auction;
                const hasProof = !!(payment.proofS3Key || payment.paymentProofUrl);
                const isPenalty = payment.isPenalty;

                return (
                  <div key={payment.id} className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          {isPenalty ? 'PENALTY' : auction?.id?.substring(0, 8) || '—'}
                        </span>
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${meta.color}`}>{meta.label}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 truncate dark:text-white">
                        {isPenalty ? `Penalty Payment - ${payment.penaltyCompany?.name || 'Unknown Vendor'}` : auction?.title || "Unknown Auction"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isPenalty ? (
                          <>Vendor: <span className="font-semibold text-red-600 dark:text-red-400">{payment.penaltyCompany?.name || "—"}</span></>
                        ) : (
                          <>
                            Client: <span className="font-semibold">{auction?.client?.name || "—"}</span>
                            {" · "}
                            Vendor: <span className="font-semibold">{auction?.winner?.name || "—"}</span>
                          </>
                        )}
                      </p>

                      <div className="flex gap-4 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500">
                          Total: <span className={`font-bold ${isPenalty ? 'text-red-600 dark:text-red-500' : 'text-[#1E8E3E] dark:text-emerald-500'}`}>₹{(payment.totalAmount || 0).toLocaleString()}</span>
                        </span>
                        {!isPenalty && (
                          <>
                            <span className="text-xs text-slate-500">
                              Client gets: <span className="font-bold text-slate-700 dark:text-slate-300">₹{(payment.clientAmount || 0).toLocaleString()}</span>
                            </span>
                            <span className="text-xs text-slate-500">
                              Commission: <span className="font-bold">₹{(payment.commissionAmount || 0).toLocaleString()}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {(payment.status === "SUBMITTED" || payment.status === "CONFIRMED") && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          {payment.utrNumber && (
                            <p className="text-xs text-slate-500">
                              UTR: <span className="font-bold font-mono">{payment.utrNumber}</span>
                            </p>
                          )}
                          {payment.paymentSubmittedAt && (
                            <p className="text-xs text-slate-500">
                              Submitted: <span className="font-bold">{new Date(payment.paymentSubmittedAt).toLocaleDateString("en-IN")}</span>
                            </p>
                          )}
                          {hasProof && (
                            <button
                              onClick={() => handleViewProof(payment)}
                              disabled={loadingProof === payment.id}
                              className="text-xs text-[#1E8E3E] dark:text-emerald-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                            >
                              {loadingProof === payment.id
                                ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                : <span className="material-symbols-outlined text-sm">image</span>
                              }
                              View Proof
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {payment.status === "SUBMITTED" && (
                        <button
                          onClick={() => handleVerify(payment.id)}
                          className="px-5 py-2.5 rounded-xl bg-[#1E8E3E] text-white text-xs font-black uppercase hover:bg-emerald-700 transition-colors"
                        >
                          Verify Payment
                        </button>
                      )}
                      {payment.status === "CONFIRMED" && (
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-2xl text-[#1E8E3E]">verified</span>
                          <span className="text-xs font-bold text-emerald-600">Confirmed</span>
                        </div>
                      )}
                      {payment.status === "PENDING" && (
                        <span className="text-xs text-slate-400 font-bold">Awaiting vendor</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Payment Proof Modal */}
      <AnimatePresence>
        {proofModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setProofModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1E8E3E]">receipt</span>
                  <h3 className="font-headline font-extrabold text-slate-900 dark:text-white">Payment Proof</h3>
                </div>
                <button
                  onClick={() => setProofModal(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <div className="p-6">
                {proofModal.isImage ? (
                  <div className="space-y-3">
                    <img
                      src={proofModal.url}
                      alt="Payment Proof"
                      className="w-full rounded-xl object-contain max-h-[60vh] bg-slate-50 dark:bg-slate-950"
                    />
                    <a
                      href={proofModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                      Open Full Size
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-4">
                    <span className="material-symbols-outlined text-5xl text-slate-300">description</span>
                    <p className="text-slate-500 text-sm">This proof is a PDF or non-image document.</p>
                    <a
                      href={proofModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E8E3E] text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                      Open Document
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
