"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

function StarSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className={`text-2xl transition-colors ${s <= (hover || value) ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function VendorRatingsPage() {
  const { currentUser } = useApp();
  const [pickups, setPickups] = useState<any[]>([]);
  const [ratings, setRatings] = useState<Record<string, any>>({});
  const [forms, setForms] = useState<Record<string, { score: number; comment: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    if (!currentUser?.companyId) return;
    try {
      const res = await api.get("/pickups");
      const completed = (res.data ?? []).filter((p: any) =>
        p.status === "COMPLETED" && p.auction?.winner?.id === currentUser.companyId
      );
      setPickups(completed);

      // Fetch existing ratings for each auction
      const ratingMap: Record<string, any> = {};
      await Promise.all(completed.map(async (p: any) => {
        try {
          const r = await api.get(`/ratings/auction/${p.auctionId}`);
          const myRating = (r.data ?? []).find((rt: any) => rt.fromCompanyId === currentUser.companyId && rt.type === "VENDOR_TO_CLIENT");
          if (myRating) ratingMap[p.auctionId] = myRating;
        } catch { /* silently ignore */ }
      }));
      setRatings(ratingMap);

      // Initialize forms
      const initForms: Record<string, { score: number; comment: string }> = {};
      completed.forEach((p: any) => {
        initForms[p.auctionId] = ratingMap[p.auctionId]
          ? { score: ratingMap[p.auctionId].score, comment: ratingMap[p.auctionId].comment ?? "" }
          : { score: 5, comment: "" };
      });
      setForms(initForms);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [currentUser?.companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submitRating = async (pickup: any) => {
    const actId = pickup.auctionId || pickup.auction?.id;
    const form = forms[actId];
    if (!form) return;
    setSubmitting(actId);
    try {
      await api.post("/ratings", {
        auctionId: actId,
        toCompanyId: pickup.auction?.clientId || pickup.auction?.client?.id,
        score: form.score,
        comment: form.comment,
        type: "VENDOR_TO_CLIENT",
      });
      showToast("Rating submitted successfully");
      await fetchData();
    } catch { showToast("Failed to submit rating", "error"); }
    finally { setSubmitting(null); }
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Rate Clients</h1>
        <p className="text-sm text-slate-500 mt-1">Share your feedback on completed projects to help the platform.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin block mb-2">progress_activity</span>
        </div>
      ) : pickups.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">star_rate</span>
          <p className="font-bold">No completed projects to rate yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pickups.map(pickup => {
            const auctionId = pickup.auctionId || pickup.auction?.id;
            const form = forms[auctionId] ?? { score: 5, comment: "" };
            const existing = ratings[auctionId];
            const isSubmitted = !!existing;

            return (
              <div key={pickup.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{pickup.auction?.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Client: <span className="font-bold">{pickup.auction?.client?.name}</span></p>
                  </div>
                  {isSubmitted && (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">Rated</span>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Your Rating *</p>
                    <StarSelector value={form.score} onChange={score => setForms(p => ({ ...p, [auctionId]: { ...form, score } }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Comment (optional)</label>
                    <textarea rows={2} value={form.comment}
                      onChange={e => setForms(p => ({ ...p, [auctionId]: { ...form, comment: e.target.value } }))}
                      placeholder="Share your experience working with this client..."
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-400 outline-none resize-none" />
                  </div>
                  <button onClick={() => submitRating(pickup)} disabled={submitting === auctionId}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm disabled:opacity-50 transition-all">
                    <span className="material-symbols-outlined text-sm">{submitting === auctionId ? "progress_activity" : "star"}</span>
                    {submitting === auctionId ? "Submitting…" : isSubmitted ? "Update Rating" : "Submit Rating"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
