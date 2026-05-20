"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

interface SealedBid {
  id: string;
  vendorId: string;
  vendor?: { id: string; name: string; email: string };
  amount: number;
  remarks?: string;
  isShortlisted: boolean;
  createdAt: string;
}

export default function AdminSealedBidsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { listings } = useApp();

  const [bids, setBids] = useState<SealedBid[]>([]);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const contextListing = listings.find(l => l.id === id || l.requirementId === id);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBids = useCallback(async () => {
    try {
      const res = await api.get(`/requirements/${id}/sealed-bids`);
      const sorted = (res.data || []).sort((a: SealedBid, b: SealedBid) => b.amount - a.amount);
      setBids(sorted);
      setShortlisted(new Set(sorted.filter((b: SealedBid) => b.isShortlisted).map((b: SealedBid) => b.id)));
    } catch {
      showToast("Failed to load bids.", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchBids(); }, [fetchBids]);

  const toggleShortlist = (bidId: string) => {
    setShortlisted(prev => {
      const next = new Set(prev);
      if (next.has(bidId)) next.delete(bidId);
      else next.add(bidId);
      return next;
    });
  };

  const handleShareWithClient = async () => {
    if (shortlisted.size === 0) {
      showToast("Please shortlist at least one bid before sharing.", "error");
      return;
    }
    setSharing(true);
    try {
      await api.patch(`/requirements/${id}/share-bids-with-client`, {
        bidIds: Array.from(shortlisted),
      });
      showToast(`${shortlisted.size} shortlisted bid(s) shared with client via email and in-app notification.`);
    } catch (e: any) {
      showToast(e?.response?.data?.message || "Failed to share bids.", "error");
    } finally {
      setSharing(false);
    }
  };

  const highest = bids[0]?.amount;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2 relative px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm font-bold mb-4 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Sealed Bids Review</h1>
            <p className="text-slate-500 text-sm mt-1">{contextListing?.title || id}</p>
          </div>
          <button
            onClick={handleShareWithClient}
            disabled={sharing || shortlisted.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-base">share</span>
            {sharing ? "Sharing..." : `Share${shortlisted.size > 0 ? ` (${shortlisted.size})` : ""} with Client`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Bids", value: bids.length, icon: "gavel", color: "text-primary" },
          { label: "Highest Bid", value: highest ? `₹${Number(highest).toLocaleString("en-IN")}` : "—", icon: "trending_up", color: "text-green-600" },
          { label: "Shortlisted", value: shortlisted.size, icon: "done_all", color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
            <span className={`material-symbols-outlined text-3xl ${s.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {bids.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl px-5 py-3 text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          Toggle the shortlist switch for top vendors, then click <strong className="mx-1">Share with Client</strong> to send them a notification.
        </div>
      )}

      {bids.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">gavel</span>
          <p className="text-slate-500 font-bold">No sealed bids submitted yet.</p>
          <p className="text-slate-400 text-sm mt-1">Bids appear here once vendors submit before the deadline.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Bid Amount</th>
                <th className="px-6 py-4">Remarks</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4 text-center">Shortlist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {bids.map((bid, idx) => {
                const isTop = idx === 0;
                const isShortlisted = shortlisted.has(bid.id);
                return (
                  <tr key={bid.id} className={`transition-colors ${isShortlisted ? "bg-emerald-50/40 dark:bg-emerald-900/10" : isTop ? "bg-yellow-50/30 dark:bg-yellow-900/5" : "hover:bg-slate-50 dark:hover:bg-slate-800/20"}`}>
                    <td className="px-6 py-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base ${
                        idx === 0 ? "bg-yellow-100 text-yellow-700" :
                        idx === 1 ? "bg-slate-100 text-slate-500 dark:bg-slate-800" :
                        idx === 2 ? "bg-amber-50 text-amber-600" :
                        "bg-slate-50 text-slate-400 dark:bg-slate-800/50"
                      }`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">{bid.vendor?.name || "Unknown"}</p>
                      <p className="text-xs text-slate-400">{bid.vendor?.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-xl font-black ${isTop ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"}`}>
                        ₹{Number(bid.amount).toLocaleString("en-IN")}
                      </p>
                      {isTop && (
                        <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-wider mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                          Highest
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-[180px] truncate" title={bid.remarks}>
                      {bid.remarks || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(bid.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <label className="relative flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isShortlisted}
                            onChange={() => toggleShortlist(bid.id)}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
