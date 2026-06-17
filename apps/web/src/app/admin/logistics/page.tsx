"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

export default function AdminLogistics() {
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "scheduled" | "completed">("all");

  const fetchPickups = useCallback(async () => {
    try {
      const res = await api.get("/pickups");
      setPickups(res.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  const filtered = pickups.filter(p => {
    if (filter === "all") return true;
    const s = p.status?.toLowerCase() || "pending";
    return s === filter;
  });

  const statusMeta = (status?: string) => {
    const s = status?.toUpperCase();
    if (s === "COMPLETED") return { color: "bg-emerald-100 text-emerald-700", label: "Completed", icon: "verified" };
    if (s === "SCHEDULED") return { color: "bg-purple-100 text-purple-700", label: "Scheduled", icon: "event" };
    return { color: "bg-amber-100 text-amber-700", label: "Pending", icon: "hourglass_empty" };
  };

  const stats = {
    total: pickups.length,
    pending: pickups.filter(p => !p.status || p.status === "PENDING").length,
    scheduled: pickups.filter(p => p.status === "SCHEDULED").length,
    completed: pickups.filter(p => p.status === "COMPLETED").length,
  };

  const getDocUrl = (pickup: any, type: string) => {
    const doc = pickup.pickupDocs?.find((d: any) => d.type === type);
    return doc?.signedUrl || null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Pickups & Logistics</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Track pickup scheduling, Form 6 submissions, and weight slips.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin block mb-2">progress_activity</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Pickups", value: stats.total, icon: "local_shipping", color: "text-blue-600 bg-blue-50" },
              { label: "Pending", value: stats.pending, icon: "hourglass_empty", color: "text-amber-600 bg-amber-50" },
              { label: "Scheduled", value: stats.scheduled, icon: "event", color: "text-purple-600 bg-purple-50" },
              { label: "Completed", value: stats.completed, icon: "verified", color: "text-primary bg-primary/10" },
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

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "scheduled", "completed"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${filter === f ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"}`}>
                {f}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">local_shipping</span>
              <p className="font-bold text-slate-600 dark:text-slate-400">No pickups in this status</p>
              <p className="text-sm text-slate-400 mt-1">Pickups appear once payment is confirmed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(pickup => {
                const meta = statusMeta(pickup.status);
                const title = pickup.auction?.title || pickup.product?.name || "Unknown Item";
                const location = pickup.auction?.client?.city || pickup.product?.city || "Various";
                const weight = pickup.auction?.totalWeight || pickup.product?.weightKg || 0;
                const clientName = pickup.auction?.client?.name || pickup.product?.user?.name || "Unknown Client";
                const winnerName = pickup.auction?.winner?.name || pickup.product?.winner?.name || "Unknown Vendor";

                return (
                  <div key={pickup.id} className="card p-5 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-slate-400">{pickup.id.slice(0, 8)}</span>
                          <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{location} · {weight} KG · Client: {clientName}</p>

                        <p className="text-xs text-slate-500 mt-1">
                          <span className="font-bold">Vendor:</span> {winnerName}
                          {pickup.scheduledDate && <> · <span className="font-bold">Scheduled:</span> {new Date(pickup.scheduledDate).toLocaleDateString("en-IN")}</>}
                        </p>

                        {/* Compliance document checklist */}
                        {pickup.status && pickup.status !== "PENDING" && (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                            {[
                              { label: "Form 6", url: getDocUrl(pickup, "FORM_6"), icon: "description" },
                              { label: "Weight Slip (Empty)", url: getDocUrl(pickup, "WEIGHT_SLIP_EMPTY"), icon: "scale" },
                              { label: "Weight Slip (Loaded)", url: getDocUrl(pickup, "WEIGHT_SLIP_LOADED"), icon: "scale" },
                              { label: "Recycling Cert", url: getDocUrl(pickup, "RECYCLING_CERTIFICATE"), icon: "recycling" },
                              { label: "Disposal Cert", url: getDocUrl(pickup, "DISPOSAL_CERTIFICATE"), icon: "delete_forever" },
                            ].map(doc => (
                              <div key={doc.label} className={`p-2 rounded-xl border text-center ${doc.url ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                                <span className={`material-symbols-outlined text-lg block mb-0.5 ${doc.url ? "text-emerald-600" : "text-slate-300"}`}>{doc.icon}</span>
                                <p className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400">{doc.label}</p>
                                {doc.url && (
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline">View</a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span className={`material-symbols-outlined text-2xl ${meta.color.split(" ")[1]}`}>{meta.icon}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
