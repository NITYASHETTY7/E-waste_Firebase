"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import api from "@/lib/api";

const PICKUP_STEPS = [
  { key: "requested", label: "Pickup Requested", icon: "pending_actions", desc: "Vendor has been notified" },
  { key: "scheduled", label: "Scheduled", icon: "event_available", desc: "Pickup date confirmed" },
  { key: "in_transit", label: "Vendor En Route", icon: "local_shipping", desc: "Vendor is on the way" },
  { key: "completed", label: "Completed", icon: "task_alt", desc: "Pickup done successfully" },
];

interface Pickup {
  id: string;
  status: string;
  scheduledDate?: string;
  notes?: string;
  vendorCompany: { id: string; name: string };
}

interface Product {
  id: string;
  name: string;
  weightKg: number;
  askingPrice: number;
  acceptedQuoteId?: string;
  status: string;
  photoUrls: string[];
  quotes: { id: string; offeredPrice: number; status: string; vendorCompany: { name: string } }[];
  pickup?: Pickup;
}

export default function TrackPickupPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user-products/mine').then(r => {
      setProducts(r.data.filter((p: Product) =>
        ['PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS', 'COMPLETED'].includes(p.status)
      ));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Track Pickup</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Monitor the status of your scheduled pickups</p>
      </motion.div>

      {loading ? (
        <div className="space-y-6">{[1, 2].map(i => <div key={i} className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-4">local_shipping</span>
          <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">No pickups yet</h3>
          <p className="text-slate-400 text-sm">Once you accept a vendor quote, your pickup will appear here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {products.map(product => {
            const acceptedQuote = product.quotes?.find(q => q.status === 'accepted');
            const pickup = product.pickup;
            const currentStepIdx = pickup ? PICKUP_STEPS.findIndex(s => s.key === pickup.status) : 0;

            return (
              <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {/* Product + Vendor Info */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    {product.photoUrls?.[0] ? (
                      <img src={product.photoUrls[0]} alt={product.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-purple-600 text-xl">devices</span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">{product.name}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{product.weightKg}kg</p>
                    </div>
                  </div>

                  {acceptedQuote && (
                    <div className="flex items-center gap-6 shrink-0">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agreed Price</p>
                        <p className="text-xl font-black text-green-600">₹{acceptedQuote.offeredPrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</p>
                        <p className="font-black text-slate-900 dark:text-white text-sm">{pickup?.vendorCompany?.name ?? acceptedQuote.vendorCompany.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Timeline */}
                <div className="p-6">
                  <div className="space-y-0">
                    {PICKUP_STEPS.map((step, i) => {
                      const isCompleted = i < currentStepIdx;
                      const isCurrent = i === currentStepIdx;
                      const isPending = i > currentStepIdx;

                      return (
                        <div key={step.key} className="flex gap-4">
                          {/* Icon + Line */}
                          <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-purple-600 ring-4 ring-purple-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                              <span className={`material-symbols-outlined text-sm ${isCompleted || isCurrent ? 'text-white' : 'text-slate-400'}`} style={isCompleted || isCurrent ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                {isCompleted ? 'check' : step.icon}
                              </span>
                            </div>
                            {i < PICKUP_STEPS.length - 1 && (
                              <div className={`w-0.5 h-8 mt-1 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 pb-6">
                            <div className="flex items-center gap-2">
                              <p className={`font-black text-sm ${isCurrent ? 'text-purple-600 dark:text-purple-400' : isPending ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {step.label}
                              </p>
                              {isCurrent && (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase tracking-widest rounded-full">Current</span>
                              )}
                            </div>
                            <p className={`text-[11px] mt-0.5 ${isPending ? 'text-slate-300 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>{step.desc}</p>

                            {isCurrent && step.key === 'scheduled' && pickup?.scheduledDate && (
                              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                                <span className="material-symbols-outlined text-purple-600 text-sm">event</span>
                                <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                  {new Date(pickup.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            )}

                            {isCurrent && pickup?.notes && (
                              <p className="mt-2 text-[11px] text-slate-500 italic">Note: {pickup.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {product.status === 'COMPLETED' && (
                  <div className="mx-5 mb-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                    <div>
                      <p className="font-black text-green-800 dark:text-green-300 text-sm">Pickup Completed!</p>
                      <p className="text-[11px] text-green-700 dark:text-green-400">Your e-waste has been successfully collected. Payment will be processed shortly.</p>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
