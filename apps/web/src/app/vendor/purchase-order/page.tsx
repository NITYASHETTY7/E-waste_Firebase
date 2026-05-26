"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

const fmtINR = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const DOC_TYPE_LABELS: Record<string, string> = {
  PURCHASE_ORDER: "Purchase Order",
  WORK_ORDER: "Work Order",
  AGREEMENT: "Agreement Copy",
  FINAL_QUOTE: "Final Quote",
  LETTERHEAD_QUOTATION: "Letterhead Quotation",
};

function printPO(auction: any, docs: any[]) {
  const poDoc = docs.find(d => d.type === "PURCHASE_ORDER");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Purchase Order</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}h1{color:#1E8E3E;border-bottom:2px solid #1E8E3E;padding-bottom:12px}.section{margin-bottom:20px}.section h3{color:#1E8E3E;font-size:11px;text-transform:uppercase;border-bottom:1px solid #d1fae5;padding-bottom:4px;margin-bottom:10px}table{width:100%;border-collapse:collapse}th{background:#f0fdf4;padding:7px 10px;font-size:11px;border:1px solid #d1fae5;text-align:left}td{padding:7px 10px;border:1px solid #e5e7eb}.total{font-weight:bold;color:#1E8E3E}.sig{margin-top:60px;display:flex;justify-content:space-between}.sig-box{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px;font-size:11px}</style>
</head><body>
<h1>PURCHASE ORDER</h1>
<div class="section"><h3>Auction Details</h3>
  <table>
    <tr><th>Auction Title</th><td>${auction.title}</td><th>Category</th><td>${auction.category}</td></tr>
    <tr><th>Client</th><td>${auction.client?.name}</td><th>Vendor</th><td>${auction.winner?.name}</td></tr>
    <tr><th>Winning Amount</th><td class="total">${fmtINR(auction.bids?.[0]?.amount ?? auction.basePrice)}</td><th>Commission (5%)</th><td>${fmtINR(Math.round((auction.bids?.[0]?.amount ?? auction.basePrice) * 0.05))}</td></tr>
  </table>
</div>
<div class="section"><h3>Payment Summary</h3>
  <table>
    <tr><th>Material Value</th><td>${fmtINR(auction.payment?.clientAmount ?? 0)}</td></tr>
    <tr><th>Platform Fee</th><td>${fmtINR(auction.payment?.commissionAmount ?? 0)}</td></tr>
    <tr><th class="total">Total Payable</th><td class="total">${fmtINR(auction.payment?.totalAmount ?? 0)}</td></tr>
  </table>
</div>
<div class="sig">
  <div class="sig-box">Client Signature</div>
  <div class="sig-box">Vendor Signature</div>
  <div class="sig-box">WeConnect Authority</div>
</div>
<p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:40px">WeConnect E-Waste Aggregator Platform</p>
</body></html>`);
  w.document.close();
  w.print();
}

export default function VendorPurchaseOrderPage() {
  const { currentUser } = useApp();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAuctions = useCallback(async () => {
    if (!currentUser?.companyId) return;
    try {
      // Fetch all completed auctions won by this vendor
      const res = await api.get("/auctions?status=COMPLETED");
      const won = (res.data ?? []).filter((a: any) => a.winnerId === currentUser.companyId);
      // Enrich each with post-auction details
      const enriched = await Promise.all(won.map(async (a: any) => {
        try {
          const r = await api.get(`/auctions/${a.id}/post-auction`);
          return r.data;
        } catch {
          return a;
        }
      }));
      setAuctions(enriched);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [currentUser?.companyId]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  const openDocUrl = async (doc: any) => {
    try {
      const res = await api.get(`/companies/signed-url?s3Key=${encodeURIComponent(doc.s3Key)}&s3Bucket=${encodeURIComponent(doc.s3Bucket)}`);
      const url = res.data?.url || res.data?.signedUrl || res.data;
      if (typeof url === "string") window.open(url, "_blank");
    } catch { showToast("Download failed", "error"); }
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Purchase Orders</h1>
        <p className="text-sm text-slate-500 mt-1">View purchase orders, work orders, and agreements for auctions you have won.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin block mb-2">progress_activity</span>
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">description</span>
          <p className="font-bold">No purchase orders yet.</p>
          <p className="text-sm">Purchase orders will appear here once you win an auction and the admin generates documents.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {auctions.map(auction => {
            const winningAmount = auction.bids?.[0]?.amount ?? auction.basePrice ?? 0;
            const docs: any[] = (auction.auctionDocs ?? []).filter((d: any) =>
              ["PURCHASE_ORDER", "WORK_ORDER", "AGREEMENT", "FINAL_QUOTE", "LETTERHEAD_QUOTATION"].includes(d.type)
            );
            const payment = auction.payment;
            const isExpanded = expandedId === auction.id;

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
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">ID: {auction.id.substring(0, 8)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-black uppercase">Won</span>
                    <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                    {/* Commercial summary */}
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Winning Bid", value: fmtINR(winningAmount), color: "text-emerald-700 font-black" },
                          { label: "Platform Fee (5%)", value: fmtINR(Math.round(winningAmount * 0.05)), color: "text-slate-500" },
                          { label: "Total Payable", value: fmtINR(Math.round(winningAmount * 1.05)), color: "text-purple-700 font-black" },
                          { label: "Payment Status", value: payment?.status ?? "PENDING", color: payment?.status === "CONFIRMED" ? "text-emerald-700 font-black" : "text-amber-700 font-bold" },
                        ].map(s => (
                          <div key={s.label}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{s.label}</p>
                            <p className={`text-sm mt-0.5 ${s.color}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="px-6 py-5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Official Documents</p>
                      {docs.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center dark:bg-slate-950 dark:border-slate-800">
                          <p className="text-xs text-slate-400 italic">Documents are being generated by WeConnect Admin — check back shortly.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {docs.map((doc, i) => (
                            <button key={i} onClick={() => openDocUrl(doc)}
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

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 px-6 pb-5">
                      {docs.some(d => d.type === "PURCHASE_ORDER") && (
                        <button onClick={() => printPO(auction, docs)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                          <span className="material-symbols-outlined text-base">print</span>
                          Print PO Summary
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
