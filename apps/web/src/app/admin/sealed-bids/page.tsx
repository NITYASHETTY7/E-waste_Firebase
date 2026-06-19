"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminSealedBids() {
  const { listings } = useApp();
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);

  const sealedPhaseAuctions = listings;

  const fetchBids = async (requirementId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/requirements/${requirementId}/sealed-bids`);
      const sealedBids = (res.data || []).slice().sort((a: any, b: any) => b.amount - a.amount);
      
      // Assign ranks based on sorted position
      sealedBids.forEach((b: any, i: number) => b.calculatedRank = i + 1);
      
      setBids(sealedBids);
    } catch (err) {
      console.error(err);
      showToast("Failed to load bids.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAuction) fetchBids(selectedAuction);
  }, [selectedAuction]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleShortlist = async (bidId: string, currentStatus: boolean) => {
    // Optimistic UI update
    setBids(prev => prev.map(b => b.id === bidId ? { ...b, isShortlisted: !currentStatus } : b));
  };

  const handleShareWithClient = async () => {
    if (!selectedAuction) return;
    const shortlistedIds = bids.filter(b => b.isShortlisted).map(b => b.id);
    if (shortlistedIds.length === 0) {
      showToast("Please shortlist at least one bid before sharing.", "error");
      return;
    }
    try {
      setSubmitting(true);
      await api.patch(`/requirements/${selectedAuction}/share-bids-with-client`, { bidIds: shortlistedIds });
      showToast("Shortlisted bids shared with client via email and in-app notification.");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to share bids.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Sealed Bid Review</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Compare sealed bids, shortlist vendors, and share results with the client.</p>
      </div>

      <div className="card p-6 border border-slate-100 dark:border-slate-800">
        <label className="label">Select Auction Event</label>
        <select 
          className="input-base" 
          value={selectedAuction || ""} 
          onChange={(e) => setSelectedAuction(e.target.value)}
        >
          <option value="">-- Choose Auction --</option>
          {sealedPhaseAuctions.map(a => (
            <option key={a.id} value={a.id}>{a.title} ({a.id.substring(0,8)})</option>
          ))}
        </select>
      </div>

      {selectedAuction && (
        <div className="card p-0 overflow-hidden border border-slate-100 dark:border-slate-800">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Bid Comparison Table</h3>
            <button
              onClick={handleShareWithClient}
              disabled={submitting || bids.length === 0}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">share</span>
              {submitting ? "Sharing..." : "Share with Client"}
            </button>
          </div>

          {loading ? (
            <div className="p-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bids.length === 0 ? (
            <div className="p-16 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">inbox</span>
              <p className="font-bold text-slate-600 dark:text-slate-400">No sealed bids received yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Vendor Name</th>
                    <th className="px-6 py-4">Bid Amount</th>
                    <th className="px-6 py-4">Remarks</th>
                    <th className="px-6 py-4">Price Sheet</th>
                    <th className="px-6 py-4">Shortlist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bids.map((bid) => {
                    const isRank1 = bid.calculatedRank === 1;
                    return (
                      <tr key={bid.id} className={`transition-colors ${isRank1 ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/20"}`}>
                        <td className="px-6 py-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${isRank1 ? "bg-[#1E8E3E] text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                            {bid.calculatedRank}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {bid.vendor?.name || "Unknown"}
                        </td>
                        <td className="px-6 py-4 font-bold text-primary dark:text-emerald-500">
                          ₹{bid.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-slate-500 truncate max-w-[200px]" title={bid.remarks}>
                          {bid.remarks || "—"}
                        </td>
                        <td className="px-6 py-4">
                          {bid.priceSheetS3Key ? (
                            <a href={`/api/documents/${bid.priceSheetS3Key}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline font-bold text-xs">
                              <span className="material-symbols-outlined text-sm">description</span> View Sheet
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">Not provided</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <label className="relative flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={bid.isShortlisted || false}
                              onChange={() => toggleShortlist(bid.id, bid.isShortlisted)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}