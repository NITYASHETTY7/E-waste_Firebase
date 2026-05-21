"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

interface InvitationDetails {
  id: string;
  title: string;
  category?: string;
  totalWeight?: number;
  location?: string;
  sealedBidDeadline?: string;
  sealedBidEventCreatedAt?: string;
  auditApproved: boolean;
  hasSealedBid: boolean;
  sealedBidAmount?: number | null;
}

export default function VendorSealedBidPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/requirements/${id}/invitation`)
      .then((res) => {
        const data = res.data;
        setDetails(data);
        if (data.hasSealedBid) setSubmitted(true);
        if (data.sealedBidAmount) setAmount(String(data.sealedBidAmount));
      })
      .catch(() => setError("Failed to load details."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    let parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid bid amount.");
      return;
    }
    parsed = Math.round(parsed * 100) / 100;
    setError("");
    setSubmitting(true);
    try {
      await api.post(`/requirements/${id}/sealed-bid`, { amount: parsed, remarks: remarks || undefined });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">error</span>
        <p className="text-slate-500 font-bold">Could not load invitation details.</p>
        <button onClick={() => router.back()} className="mt-4 text-primary text-sm font-bold hover:underline">Go back</button>
      </div>
    );
  }

  if (!details.auditApproved) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <span className="material-symbols-outlined text-5xl text-amber-400 block mb-3">pending</span>
        <p className="text-slate-700 dark:text-slate-200 font-bold text-lg">Audit Not Yet Approved</p>
        <p className="text-slate-500 text-sm mt-2">Your audit documents must be approved by the admin before you can submit a sealed bid.</p>
        <button onClick={() => router.back()} className="mt-4 text-primary text-sm font-bold hover:underline">Go back</button>
      </div>
    );
  }

  const deadline = details.sealedBidDeadline ? new Date(details.sealedBidDeadline) : null;
  const isExpired = deadline && deadline < new Date();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm font-bold mb-4 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Invitation
        </button>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Submit Sealed Bid</h1>
        <p className="text-slate-500 text-sm mt-1">Your bid is confidential until the auction opens.</p>
      </div>

      {/* Listing Info */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Listing Details</h2>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{details.title}</p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          {details.category && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">category</span>
              {details.category}
            </span>
          )}
          {details.totalWeight && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">scale</span>
              {details.totalWeight} kg
            </span>
          )}
        </div>
      </div>

      {/* Deadline banner */}
      {deadline && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
          isExpired
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
        }`}>
          <span className="material-symbols-outlined text-xl">{isExpired ? "timer_off" : "timer"}</span>
          {isExpired
            ? `Deadline passed: ${deadline.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : `Deadline: ${deadline.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
        </div>
      )}

      {/* Submitted state */}
      {submitted ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-5xl text-green-500 block" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-xl font-black text-green-700 dark:text-green-400">Sealed Bid Submitted!</p>
          {details.sealedBidAmount && (
            <p className="text-slate-600 dark:text-slate-400 font-bold text-lg">
              Your bid: <span className="text-green-600 dark:text-green-400">₹{Number(details.sealedBidAmount).toLocaleString("en-IN")}</span>
            </p>
          )}
          <p className="text-slate-500 text-sm">Your bid has been recorded. You will be notified when the live auction is scheduled.</p>
          <button
            onClick={() => router.push("/vendor/invitations")}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Invitations
          </button>
        </div>
      ) : isExpired ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-5xl text-red-400 block">timer_off</span>
          <p className="text-lg font-black text-red-700 dark:text-red-400">Submission Deadline Passed</p>
          <p className="text-slate-500 text-sm">The deadline for submitting a sealed bid has passed. Contact the admin for assistance.</p>
        </div>
      ) : (
        /* Bid Form */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Your Bid</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Bid Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-lg">₹</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              />
            </div>
            <p className="text-[11px] text-slate-400">Enter your total bid price for the lot. This is confidential until auction opens.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Remarks <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Any conditions, notes, or comments about your bid..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !amount}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">gavel</span>
                  Submit Sealed Bid
                </>
              )}
            </button>
            <button
              onClick={() => router.back()}
              className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            <span className="material-symbols-outlined text-sm align-middle mr-1">lock</span>
            Your sealed bid is encrypted and cannot be seen by other vendors or the client until the live auction begins.
          </p>
        </div>
      )}
    </div>
  );
}
