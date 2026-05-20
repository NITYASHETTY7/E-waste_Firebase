"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";

const PAYMENT_TERMS = [
  "Advance Payment — 100% before pickup",
  "Net 15 — Payment within 15 days of PO acknowledgement",
  "Net 30 — Payment within 30 days of PO acknowledgement",
  "50% Advance, 50% on delivery",
  "100% on delivery",
];

const DELIVERY_TERMS = [
  "Ex-Works (Client premises)",
  "FOB — Free On Board (Client loading bay)",
  "CIF — Cost, Insurance & Freight included",
  "Door-to-Door delivery by vendor",
];

export default function AdminPurchaseOrders() {
  const { listings, bids, users, issuePO, verifyEMD, editListing } = useApp();
  const [poModal, setPoModal] = useState<{ open: boolean; listingId: string | null }>({ open: false, listingId: null });
  const [form, setForm] = useState({ paymentTerms: PAYMENT_TERMS[0], deliveryTerms: DELIVERY_TERMS[0], penaltyClause: "2% per week of delay, capped at 10%", specialConditions: "" });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [emdModal, setEmdModal] = useState<{ open: boolean; listingId: string | null }>({ open: false, listingId: null });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Only listings with a winner selected (post-auction)
  const poListings = listings.filter(l => l.winnerVendorId && l.finalQuoteStatus === "approved");

  const getWinBid = (listingId: string, vendorId: string) =>
    bids.find(b => b.listingId === listingId && b.vendorId === vendorId && b.status === "accepted") ||
    bids.filter(b => b.listingId === listingId).sort((a, b) => b.amount - a.amount)[0];

  const getVendor = (vendorId: string) => users.find(u => u.id === vendorId);
  const getClient = (userId: string) => users.find(u => u.id === userId);

  const handleIssuePO = () => {
    if (!poModal.listingId) return;
    issuePO(poModal.listingId, form);
    setPoModal({ open: false, listingId: null });
    showToast("Purchase Order issued successfully.");
  };

  const handleVerifyEMD = (listingId: string) => {
    verifyEMD(listingId);
    setEmdModal({ open: false, listingId: null });
    showToast("EMD verified and approved.");
  };

  const poStatusMeta = (status?: string) => {
    if (status === "acknowledged") return { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Acknowledged" };
    if (status === "issued") return { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Issued — Awaiting Vendor" };
    return { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "PO Not Issued" };
  };

  const emdMeta = (status?: string) => {
    if (status === "verified") return { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "EMD Verified" };
    if (status === "submitted") return { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "EMD Submitted" };
    if (status === "not_required") return { color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: "Not Required" };
    return { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "EMD Pending" };
  };

  const stats = {
    total: poListings.length,
    pending: poListings.filter(l => !l.poStatus || l.poStatus === "pending").length,
    issued: poListings.filter(l => l.poStatus === "issued").length,
    acknowledged: poListings.filter(l => l.poStatus === "acknowledged").length,
    emdPending: poListings.filter(l => l.emdStatus === "submitted").length,
  };

  const printPO = (listing: typeof poListings[0]) => {
    const winBid = getWinBid(listing.id, listing.winnerVendorId!);
    const vendor = getVendor(listing.winnerVendorId!);
    const client = getClient(listing.userId);
    const commission = Math.round((winBid?.amount || 0) * 0.05);
    const clientAmount = (winBid?.amount || 0) - commission;

    const html = `
<!DOCTYPE html><html><head><title>Purchase Order ${listing.poNumber}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#111}
h1{color:#1e8e3e;border-bottom:3px solid #1e8e3e;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th{background:#f1f5f9;padding:10px;text-align:left;border:1px solid #e2e8f0}
td{padding:10px;border:1px solid #e2e8f0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:16px 0}
.section{background:#f8fafc;padding:16px;border-radius:8px;border-left:4px solid #1e8e3e}
.label{font-size:11px;color:#64748b;text-transform:uppercase;font-weight:bold}
.val{font-size:14px;margin-top:2px;font-weight:bold}
.sig{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sig-box{border-top:2px solid #111;padding-top:8px;font-size:12px}
@media print{body{margin:0}}</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:center">
  <div><h1 style="margin:0">PURCHASE ORDER</h1><p style="color:#64748b;margin:4px 0">WeConnect E-Waste Aggregator Platform</p></div>
  <div style="text-align:right"><div class="label">PO Number</div><div style="font-size:22px;font-weight:900;color:#1e8e3e">${listing.poNumber || 'WC-DRAFT'}</div>
  <div class="label">Date</div><div>${listing.poIssuedAt ? new Date(listing.poIssuedAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</div></div>
</div>
<div class="grid">
  <div class="section"><div class="label">Buyer (Client)</div><div class="val">${client?.name || listing.userName}</div>
  <div style="font-size:12px;color:#64748b;margin-top:4px">${client?.onboardingProfile?.address || ''}, ${client?.onboardingProfile?.city || ''}</div>
  ${client?.onboardingProfile?.gstin ? `<div style="font-size:12px;margin-top:4px">GSTIN: <b>${client.onboardingProfile.gstin}</b></div>` : ''}</div>
  <div class="section"><div class="label">Seller (Vendor)</div><div class="val">${vendor?.name || listing.winnerVendorName}</div>
  <div style="font-size:12px;color:#64748b;margin-top:4px">${vendor?.onboardingProfile?.address || ''}, ${vendor?.onboardingProfile?.city || ''}</div></div>
</div>
<table><thead><tr><th>Description</th><th>Category</th><th>Est. Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
<tbody><tr><td>${listing.title}</td><td>${listing.category}</td><td>${listing.weight}</td><td>KG</td>
<td>${winBid ? Math.round((winBid.amount || 0) / listing.weight).toLocaleString() : '—'}</td>
<td><b>${(winBid?.amount || 0).toLocaleString()}</b></td></tr>
<tr><td colspan="5" style="text-align:right"><b>WeConnect Commission (5%)</b></td><td style="color:#ef4444">−₹${commission.toLocaleString()}</td></tr>
<tr><td colspan="5" style="text-align:right"><b>Net Payable to Client</b></td><td><b style="color:#1e8e3e">₹${clientAmount.toLocaleString()}</b></td></tr></tbody></table>
<div class="grid">
  <div><div class="label">Payment Terms</div><div class="val">${listing.poPaymentTerms || '—'}</div></div>
  <div><div class="label">Delivery Terms</div><div class="val">${listing.poDeliveryTerms || '—'}</div></div>
  <div><div class="label">Penalty Clause</div><div class="val">${listing.poPenaltyClause || '—'}</div></div>
  ${listing.poSpecialConditions ? `<div><div class="label">Special Conditions</div><div class="val">${listing.poSpecialConditions}</div></div>` : ''}
</div>
<p style="font-size:12px;color:#64748b;margin-top:16px">This Purchase Order is generated by WeConnect E-Waste Aggregator platform and is subject to platform terms and conditions. EMD amount of ₹${(listing.emdAmount || 0).toLocaleString()} is ${listing.emdStatus === 'not_required' ? 'not applicable' : listing.emdStatus === 'verified' ? 'verified and on record' : 'pending'}.</p>
<div class="sig">
  <div class="sig-box">Authorised Signatory — Client<br><br><br><br>${client?.name || 'Client'}<br>Date: _______________</div>
  <div class="sig-box">Authorised Signatory — Vendor<br><br><br><br>${vendor?.name || 'Vendor'}<br>Date: _______________</div>
</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-xl z-50 text-white font-bold text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Purchase Orders</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Issue and manage Purchase Orders for completed auctions. Verify EMD submissions.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Deals", value: stats.total, icon: "description", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "PO Pending", value: stats.pending, icon: "pending_actions", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
          { label: "PO Issued", value: stats.issued, icon: "send", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
          { label: "PO Acknowledged", value: stats.acknowledged, icon: "verified", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "EMD Review", value: stats.emdPending, icon: "account_balance", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20" },
        ].map(s => (
          <div key={s.label} className="card p-4 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <span className="material-symbols-outlined text-base">{s.icon}</span>
              </div>
              <div>
                <p className="text-xl font-black text-[color:var(--color-on-surface)]">{s.value}</p>
                <p className="text-[10px] text-[color:var(--color-on-surface-variant)] font-medium leading-tight">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {poListings.length === 0 ? (
        <div className="card p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">description</span>
          <p className="font-bold text-slate-600 dark:text-slate-400">No completed auctions with approved quotes yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {poListings.map(listing => {
            const po = poStatusMeta(listing.poStatus);
            const emd = emdMeta(listing.emdStatus);
            const winBid = getWinBid(listing.id, listing.winnerVendorId!);

            return (
              <div key={listing.id} className="card p-0 overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {listing.poNumber && <span className="text-xs font-black text-slate-400">{listing.poNumber}</span>}
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${po.color}`}>{po.label}</span>
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${emd.color}`}>EMD: {emd.label}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{listing.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Client: <span className="font-semibold">{listing.userName}</span> · Winner: <span className="font-semibold">{listing.winnerVendorName}</span> · Bid: <span className="font-semibold text-primary">₹{(winBid?.amount || 0).toLocaleString()}</span>
                    </p>
                    {listing.emdStatus === "submitted" && (
                      <p className="text-xs text-blue-600 mt-1 font-bold">
                        <span className="material-symbols-outlined text-sm align-middle mr-1">account_balance</span>
                        EMD of ₹{(listing.emdAmount || 0).toLocaleString()} submitted · UTR: {listing.emdUTR}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap shrink-0">
                    {listing.emdStatus === "submitted" && (
                      <button onClick={() => verifyEMD(listing.id)}
                        className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-black uppercase hover:bg-orange-600 transition-colors">
                        Verify EMD
                      </button>
                    )}
                    {(!listing.poStatus || listing.poStatus === "pending") && (
                      <button onClick={() => { setPoModal({ open: true, listingId: listing.id }); setForm({ paymentTerms: PAYMENT_TERMS[0], deliveryTerms: DELIVERY_TERMS[0], penaltyClause: "2% per week of delay, capped at 10%", specialConditions: "" }); }}
                        className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase hover:bg-primary/90 transition-colors">
                        Issue PO
                      </button>
                    )}
                    {listing.poStatus && listing.poStatus !== "pending" && (
                      <button onClick={() => printPO(listing)}
                        className="px-4 py-2 rounded-xl border border-primary text-primary text-xs font-black uppercase hover:bg-primary/5 transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">print</span>Print / Download
                      </button>
                    )}
                    {listing.emdStatus === "submitted" && (
                      <button onClick={() => handleVerifyEMD(listing.id)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase hover:bg-emerald-700 transition-colors">
                        Approve EMD
                      </button>
                    )}
                  </div>
                </div>

                {listing.poStatus && listing.poStatus !== "pending" && (
                  <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {[
                      { label: "Payment Terms", value: listing.poPaymentTerms },
                      { label: "Delivery Terms", value: listing.poDeliveryTerms },
                      { label: "Penalty Clause", value: listing.poPenaltyClause },
                      { label: "EMD Amount", value: listing.emdAmount ? `₹${listing.emdAmount.toLocaleString()}` : "Not Required" },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">{item.label}</p>
                        <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">{item.value || "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Issue PO Modal */}
      {poModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-headline font-extrabold text-slate-900 dark:text-white">Issue Purchase Order</h3>
            {(() => {
              const listing = listings.find(l => l.id === poModal.listingId);
              const winBid = listing && getWinBid(listing.id, listing.winnerVendorId!);
              return listing && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs">
                  <p className="font-bold text-primary">{listing.title}</p>
                  <p className="text-slate-500 mt-1">Winner: {listing.winnerVendorName} · Bid Amount: ₹{(winBid?.amount || 0).toLocaleString()}</p>
                </div>
              );
            })()}

            <div>
              <label className="label">Payment Terms</label>
              <select className="input-base" value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))}>
                {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Delivery Terms</label>
              <select className="input-base" value={form.deliveryTerms} onChange={e => setForm(p => ({ ...p, deliveryTerms: e.target.value }))}>
                {DELIVERY_TERMS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Penalty Clause</label>
              <input className="input-base" value={form.penaltyClause} onChange={e => setForm(p => ({ ...p, penaltyClause: e.target.value }))} />
            </div>
            <div>
              <label className="label">Special Conditions (optional)</label>
              <textarea className="input-base min-h-[80px] resize-none" placeholder="E.g., Data destruction required on site…" value={form.specialConditions} onChange={e => setForm(p => ({ ...p, specialConditions: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPoModal({ open: false, listingId: null })} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={handleIssuePO} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90">Issue PO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
