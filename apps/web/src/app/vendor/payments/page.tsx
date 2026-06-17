"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

const fmtINR = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const PAYMENT_STATUS: Record<string, { color: string; label: string }> = {
  PENDING:   { color: "bg-amber-100 text-amber-700",    label: "Payment Due" },
  SUBMITTED: { color: "bg-blue-100 text-blue-700",      label: "Proof Uploaded" },
  CONFIRMED: { color: "bg-emerald-100 text-emerald-700", label: "Confirmed" },
  REJECTED:  { color: "bg-red-100 text-red-700",        label: "Rejected" },
};

const WECONNECT_BANK = {
  name: "WeConnect E-Waste Pvt Ltd",
  bank: "ICICI Bank",
  account: "001401000876",
  ifsc:    "ICIC0000014",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  PURCHASE_ORDER: "Purchase Order",
  WORK_ORDER: "Work Order",
  AGREEMENT: "Agreement Copy",
  FINAL_QUOTE: "Final Quote",
  LETTERHEAD_QUOTATION: "Letterhead Quotation",
  INVOICE: "Tax Invoice (GST)",
  PAYMENT_PROOF: "Payment Proof Receipt",
  FORM_6: "Form 6 / Manifest",
  RECYCLING_CERTIFICATE: "Recycling Certificate",
  DISPOSAL_CERTIFICATE: "DisPOSAL Certificate",
  EWASTE_RECYCLING_CERTIFICATE: "E-Waste Recycling Certificate",
  DATA_DESTRUCTION_CERTIFICATE: "Data Destruction Certificate",
  EWAY_BILL: "E-Way Bill",
  DELIVERY_CHALLAN: "Delivery Challan",
  WEIGHT_SLIP_EMPTY: "Weight Slip (Empty)",
  WEIGHT_SLIP_LOADED: "Weight Slip (Loaded)",
  MATERIAL_ACKNOWLEDGEMENT: "Material Acknowledgement",
  ASSET_HANDOVER_FORM: "Asset Handover Form",
};

export default function VendorPayments() {
  const { currentUser, refreshData } = useApp();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ auctionId: string; pickupId: string | null; title: string } | null>(null);
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [logistics, setLogistics] = useState({ vehicleNumber: "", driverName: "", preferredDate: "" });
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Penalty payment states
  const [penaltyPayModal, setPenaltyPayModal] = useState<{ open: boolean; amount: number } | null>(null);
  const [penaltyUtr, setPenaltyUtr] = useState("");
  const [penaltyFile, setPenaltyFile] = useState<File | null>(null);
  const [payingPenalty, setPayingPenalty] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openDocUrl = async (doc: any) => {
    if (doc.signedUrl) {
      window.open(doc.signedUrl, "_blank");
      return;
    }
    if (!doc.s3Key) return;
    try {
      const res = await api.get(`/companies/signed-url?s3Key=${encodeURIComponent(doc.s3Key)}&s3Bucket=${encodeURIComponent(doc.s3Bucket)}`);
      const url = res.data?.url || res.data?.signedUrl || res.data;
      if (typeof url === "string") window.open(url, "_blank");
    } catch { showToast("Download failed", "error"); }
  };

  const fetchAuctions = useCallback(async () => {
    if (!currentUser?.companyId) return;
    try {
      const res = await api.get("/auctions?status=COMPLETED");
      const won = (res.data ?? []).filter((a: any) => a.winnerId === currentUser.companyId);
      const enriched = await Promise.all(won.map(async (a: any) => {
        try {
          const [postRes, payRes, pickupRes] = await Promise.allSettled([
            api.get(`/auctions/${a.id}/post-auction`),
            api.get(`/payments/auction/${a.id}`),
            api.get(`/pickups/by-auction/${a.id}`),
          ]);
          return {
            ...(postRes.status === "fulfilled" ? postRes.value.data : a),
            payment: payRes.status === "fulfilled" ? payRes.value.data : a.payment,
            pickup: pickupRes.status === "fulfilled" ? pickupRes.value.data : null,
          };
        } catch {
          return a;
        }
      }));
      setAuctions(enriched);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [currentUser?.companyId]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  const handleUpload = async () => {
    if (!modal || !utr) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("utrNumber", utr);
      if (file) fd.append("file", file);
      await api.post(`/payments/auction/${modal.auctionId}/proof`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Save vendor logistics details to pickup
      if (logistics.vehicleNumber || logistics.driverName || logistics.preferredDate) {
        await api.patch(`/pickups/by-auction/${modal.auctionId}/vendor-logistics`, {
          vehicleNumber: logistics.vehicleNumber || undefined,
          driverName: logistics.driverName || undefined,
          preferredDate: logistics.preferredDate || undefined,
        }).catch(() => {});
      }
      showToast("Payment proof submitted successfully");
      setModal(null);
      setUtr("");
      setFile(null);
      setLogistics({ vehicleNumber: "", driverName: "", preferredDate: "" });
      await fetchAuctions();
    } catch {
      showToast("Failed to upload proof", "error");
    } finally {
      setUploading(false);
    }
  };

  const handlePayPenalty = async () => {
    if (!penaltyPayModal || !penaltyUtr || !penaltyFile) return;
    setPayingPenalty(true);
    try {
      const fd = new FormData();
      fd.append("companyId", currentUser.companyId);
      fd.append("amount", penaltyPayModal.amount.toString());
      fd.append("utrNumber", penaltyUtr);
      fd.append("file", penaltyFile);

      await api.post("/payments/penalty", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Still clear it locally for immediate UI update
      await api.patch(`/companies/${currentUser.companyId}`, { penaltyAmount: 0 });

      showToast("Penalty payment submitted for verification. Outstanding balance cleared.");
      setPenaltyPayModal(null);
      setPenaltyUtr("");
      setPenaltyFile(null);
      
      // refresh context data
      await refreshData();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to process penalty payment", "error");
    } finally {
      setPayingPenalty(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8 py-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Payments</h2>
        <p className="text-sm text-slate-500 mt-1">View payment details and upload proof of payment for auctions you have won.</p>
      </div>

      {currentUser.penaltyAmount ? (
        <div className="bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-700 dark:text-red-400 shrink-0">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <p className="text-xs font-black uppercase text-red-600 dark:text-red-400 tracking-wider">Outstanding Penalty Balance</p>
              <p className="text-2xl font-black text-red-800 dark:text-red-200 mt-0.5">{fmtINR(currentUser.penaltyAmount)}</p>
              <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-1">Please pay this balance here or it will be added to your next auction transaction.</p>
            </div>
          </div>
          <button
            onClick={() => setPenaltyPayModal({ open: true, amount: currentUser.penaltyAmount || 0 })}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">payment</span>
            Pay Penalty Now
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin block mb-2">progress_activity</span>
        </div>
      ) : auctions.length === 0 ? (
        <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <span className="material-symbols-outlined text-6xl mb-3 block">payments</span>
          <p className="font-bold text-slate-900 dark:text-white">No Payments Due</p>
          <p className="text-sm mt-1">Payment records will appear here once you win an auction.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {auctions.map(auction => {
            const payment = auction.payment;
            const pickup = auction.pickup;
            const topBid = auction.bids?.[0];
            const winningAmount = payment?.clientAmount ?? topBid?.amount ?? auction.basePrice ?? 0;
            const commission = payment?.commissionAmount ?? Math.round(winningAmount * 0.05);
            const status = payment?.status ?? "PENDING";
            const hasPenalty = (status === "PENDING" || status === "REJECTED") && currentUser.penaltyAmount && currentUser.penaltyAmount > 0;
            const totalWithoutPenalty = winningAmount + commission;
            const total = totalWithoutPenalty + (hasPenalty ? currentUser.penaltyAmount : 0);
            const meta = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.PENDING;
            const isExpanded = expandedId === auction.id;

            // Gather all associated documents
            const docs: any[] = [];
            if (auction.auctionDocs) {
              auction.auctionDocs.forEach((d: any) => {
                if (["PURCHASE_ORDER", "WORK_ORDER", "AGREEMENT", "FINAL_QUOTE", "LETTERHEAD_QUOTATION"].includes(d.type)) {
                  docs.push({ ...d, source: "auction" });
                }
              });
            }
            if (pickup) {
              if (pickup.auctionDocs) {
                pickup.auctionDocs.forEach((d: any) => {
                  if (!docs.some(existing => existing.s3Key === d.s3Key)) {
                    docs.push({ ...d, source: "pickup" });
                  }
                });
              }
              if (pickup.pickupDocs) {
                pickup.pickupDocs.forEach((d: any) => {
                  docs.push({ ...d, source: "pickup" });
                });
              }
            }
            if (payment) {
              if (payment.proofS3Key) {
                docs.push({
                  id: payment.id,
                  fileName: `Payment_Proof_${payment.id.slice(0, 8)}.pdf`,
                  type: "PAYMENT_PROOF",
                  s3Key: payment.proofS3Key,
                  s3Bucket: payment.proofS3Bucket,
                  source: "payment"
                });
              } else if (payment.paymentProofUrl) {
                docs.push({
                  id: payment.id,
                  fileName: `Payment_Proof_${payment.id.slice(0, 8)}.pdf`,
                  type: "PAYMENT_PROOF",
                  signedUrl: payment.paymentProofUrl,
                  source: "payment"
                });
              }
            }

            return (
              <div key={auction.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                {/* Header (Interactive Trigger) */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : auction.id)}
                  className="flex items-center justify-between px-6 py-5 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-headline font-bold text-lg text-slate-900 dark:text-white truncate">{auction.title}</p>
                    <p className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                      <span>{auction.category}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Client: {auction.client?.name || "Unknown"}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">ID: {auction.id.substring(0, 8)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${meta.color}`}>{meta.label}</span>
                    <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Payment breakdown */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Breakdown</p>
                        <div className="space-y-2">
                          {[
                            { label: "Amount to Client (Full Bid)", value: winningAmount, color: "text-emerald-700 font-black" },
                            { label: "Platform Commission (5%)", value: commission, color: "text-blue-700 font-bold" },
                            hasPenalty ? { label: "Outstanding Penalty (Added)", value: currentUser.penaltyAmount || 0, color: "text-red-600 font-bold" } : null,
                            { label: "Total You Pay", value: total, color: "text-slate-900 dark:text-white font-black" },
                          ].filter((row): row is { label: string; value: number; color: string } => row !== null).map(row => (
                            <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                              <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
                              <span className={`text-sm ${row.color}`}>{fmtINR(row.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bank accounts */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Transfer To</p>
                        <div className="space-y-2">
                          {/* Client */}
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                            <p className="text-[9px] font-black text-emerald-700 uppercase mb-2">Client Account (Main Amount)</p>
                            {auction.client?.bankDetails ? (
                              <div className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                                <p><span className="font-bold">Name:</span> {auction.client.bankDetails.accountHolderName}</p>
                                <p><span className="font-bold">Bank:</span> {auction.client.bankDetails.bankName}</p>
                                <p><span className="font-bold">A/C:</span> {auction.client.bankDetails.accountNumber}</p>
                                <p><span className="font-bold">IFSC:</span> {auction.client.bankDetails.ifscCode}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">Bank details not on file — contact admin</p>
                            )}
                            <p className="text-xs font-black text-emerald-700 mt-2 pt-2 border-t border-emerald-100">{fmtINR(winningAmount)}</p>
                          </div>
                          {/* Platform */}
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <p className="text-[9px] font-black text-blue-700 uppercase mb-2">WeConnect (Commission)</p>
                            <div className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                              <p><span className="font-bold">Name:</span> {WECONNECT_BANK.name}</p>
                              <p><span className="font-bold">Bank:</span> {WECONNECT_BANK.bank}</p>
                              <p><span className="font-bold">A/C:</span> {WECONNECT_BANK.account}</p>
                              <p><span className="font-bold">IFSC:</span> {WECONNECT_BANK.ifsc}</p>
                            </div>
                            <p className="text-xs font-black text-blue-700 mt-2 pt-2 border-t border-blue-100">{fmtINR(commission)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Associated Documents */}
                    <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Associated Documents</p>
                      {docs.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                          <p className="text-xs text-slate-400 italic">No documents available yet for this transaction.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {docs.map((doc, idx) => (
                            <button key={idx} onClick={() => openDocUrl(doc)}
                              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left group">
                              <span className="material-symbols-outlined text-purple-600 text-base">description</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{doc.fileName}</p>
                                <p className="text-[9px] text-slate-400 uppercase">{DOC_TYPE_LABELS[doc.type] ?? doc.type.replace(/_/g, " ")}</p>
                              </div>
                              <span className="material-symbols-outlined text-slate-400 text-sm">download</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Proof submitted info */}
                    {payment?.utrNumber && (
                      <div className="px-6 pb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-center gap-3">
                          <span className="material-symbols-outlined text-blue-600">receipt_long</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Proof Submitted</p>
                            <p className="text-xs text-slate-500">UTR: {payment.utrNumber}</p>
                          </div>
                          {status === "CONFIRMED" && (
                            <span className="material-symbols-outlined text-emerald-600 text-xl">verified</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action */}
                    {status === "PENDING" || status === "REJECTED" ? (
                      <div className="px-6 pb-5">
                        {status === "REJECTED" && (
                          <p className="text-xs text-red-600 mb-2 font-bold">Payment proof was rejected. Please re-upload with the correct details.</p>
                        )}
                        <button
                          onClick={() => setModal({ auctionId: auction.id, pickupId: auction.pickup?.id ?? null, title: auction.title })}
                          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-black flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">upload_file</span>
                          Upload Payment Proof
                        </button>
                      </div>
                    ) : status === "SUBMITTED" ? (
                      <div className="px-6 pb-5">
                        <span className="text-xs text-blue-700 font-bold bg-blue-50 px-4 py-2 rounded-xl inline-block">Under Review by Admin</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 my-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Submit Payment & Schedule Pickup</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{modal.title}</p>
            </div>

            {/* Payment proof */}
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Payment Proof</p>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">UTR / Transaction Reference Number <span className="text-red-500">*</span></label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter UTR number"
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Payment Screenshot / Receipt (optional)</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:border-primary transition-colors ${file ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-200 dark:border-slate-700"}`}
                  onClick={() => document.getElementById("payment-proof-input")?.click()}
                >
                  <input id="payment-proof-input" type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  {file ? (
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{file.name}</p>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">receipt</span>
                      <p className="text-sm text-slate-500">Click to upload screenshot or PDF</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Pickup scheduling */}
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Pickup Schedule (optional — share your logistics plan)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Preferred Pickup Date</label>
                  <input type="date"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={logistics.preferredDate}
                    onChange={e => setLogistics(p => ({ ...p, preferredDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Vehicle Number</label>
                  <input type="text" placeholder="e.g. KA-01-AB-1234"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={logistics.vehicleNumber}
                    onChange={e => setLogistics(p => ({ ...p, vehicleNumber: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Driver Name</label>
                <input type="text" placeholder="Full name"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={logistics.driverName}
                  onChange={e => setLogistics(p => ({ ...p, driverName: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => { setModal(null); setUtr(""); setFile(null); setLogistics({ vehicleNumber: "", driverName: "", preferredDate: "" }); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!utr || uploading}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span>Submitting...</>
                ) : (
                  <><span className="material-symbols-outlined text-base">upload</span>Submit</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Penalty Payment Modal */}
      {penaltyPayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Pay Outstanding Penalty</h3>
              <p className="text-xs text-slate-500 mt-1">Upload proof of payment to clear your penalty balance of {fmtINR(penaltyPayModal.amount)}.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">UTR / Transaction Reference Number <span className="text-red-500">*</span></label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter UTR number"
                  value={penaltyUtr}
                  onChange={e => setPenaltyUtr(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Receipt Screenshot (optional)</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:border-primary transition-colors ${penaltyFile ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-200 dark:border-slate-700"}`}
                  onClick={() => document.getElementById("penalty-proof-input")?.click()}
                >
                  <input id="penalty-proof-input" type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => setPenaltyFile(e.target.files?.[0] ?? null)} />
                  {penaltyFile ? (
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{penaltyFile.name}</p>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">receipt</span>
                      <p className="text-sm text-slate-500">Click to upload screenshot or PDF</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setPenaltyPayModal(null); setPenaltyUtr(""); setPenaltyFile(null); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePayPenalty}
                disabled={!penaltyUtr || payingPenalty}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {payingPenalty ? (
                  <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span>Processing...</>
                ) : (
                  <><span className="material-symbols-outlined text-base">check_circle</span>Confirm Payment</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
