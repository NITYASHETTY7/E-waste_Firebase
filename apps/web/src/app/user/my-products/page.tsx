"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import api from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING_ADMIN_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ADMIN_APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  QUOTE_RECEIVED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  QUOTE_ACCEPTED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  PICKUP_REQUESTED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PICKUP_IN_PROGRESS: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_ADMIN_REVIEW: "Pending Review",
  ADMIN_APPROVED: "Open for Quotes",
  QUOTE_RECEIVED: "Quotes Received",
  QUOTE_ACCEPTED: "Quote Accepted",
  PICKUP_REQUESTED: "Pickup Requested",
  PICKUP_IN_PROGRESS: "Pickup In Progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

const STATUS_STEPS = [
  { key: "PENDING_ADMIN_REVIEW", label: "Submitted", icon: "upload_file" },
  { key: "ADMIN_APPROVED", label: "Admin Approved", icon: "admin_panel_settings" },
  { key: "QUOTE_RECEIVED", label: "Quotes Received", icon: "request_quote" },
  { key: "QUOTE_ACCEPTED", label: "Quote Accepted", icon: "handshake" },
  { key: "PICKUP_REQUESTED", label: "Pickup Scheduled", icon: "local_shipping" },
  { key: "COMPLETED", label: "Completed", icon: "task_alt" },
];

const STEP_ORDER = STATUS_STEPS.map(s => s.key);

interface Product {
  id: string; name: string; weightKg: number; condition: string;
  askingPrice: number; status: string; adminRemarks?: string;
  photoUrls: string[]; createdAt: string;
  quotes: { id: string; offeredPrice: number; status: string; vendorCompany: { name: string } }[];
}

function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const currentStep = STEP_ORDER.indexOf(product.status);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      {/* Card Header */}
      <div className="p-5 flex items-start gap-4">
        {product.photoUrls?.[0] ? (
          <img src={product.photoUrls[0]} alt={product.name} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-purple-600 text-2xl">devices</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">{product.name}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {product.weightKg}kg · {product.condition} · Ask ₹{product.askingPrice.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">{new Date(product.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
            <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${STATUS_COLOR[product.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {STATUS_LABEL[product.status] ?? product.status}
            </span>
          </div>

          {product.status === 'REJECTED' && product.adminRemarks && (
            <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
              <p className="text-[10px] text-red-700 dark:text-red-400"><strong>Reason:</strong> {product.adminRemarks}</p>
            </div>
          )}

          {product.quotes?.length > 0 && (
            <p className="mt-2 text-[11px] font-bold text-purple-600 dark:text-purple-400">
              {product.quotes.length} vendor quote{product.quotes.length > 1 ? 's' : ''} received
            </p>
          )}
        </div>
      </div>

      {/* Progress Stepper */}
      {product.status !== 'REJECTED' && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-0">
            {STATUS_STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${i <= currentStep ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  <span className={`material-symbols-outlined text-xs ${i <= currentStep ? 'text-white' : 'text-slate-400'}`}>{i <= currentStep ? 'check' : 'radio_button_unchecked'}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${i < currentStep ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {STATUS_STEPS.map(s => (
              <p key={s.key} className="text-[8px] font-bold text-slate-400 uppercase text-center" style={{ flex: 1 }}></p>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 flex items-center gap-3">
        {product.quotes?.length > 0 && (
          <Link href="/user/quotes" className="flex items-center gap-1.5 text-[11px] font-black text-purple-600 hover:text-purple-700 uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">request_quote</span> View Quotes
          </Link>
        )}
        {['PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'].includes(product.status) && (
          <Link href="/user/track" className="flex items-center gap-1.5 text-[11px] font-black text-orange-600 hover:text-orange-700 uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">local_shipping</span> Track Pickup
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export default function MyProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user-products/mine').then(r => setProducts(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Products</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Track all your submitted e-waste listings</p>
        </div>
        <Link href="/user/upload"
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg">
          <span className="material-symbols-outlined text-base">add</span> New Submission
        </Link>
      </motion.div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-4">inventory_2</span>
          <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">No products yet</h3>
          <p className="text-slate-400 text-sm mb-6">Submit your first e-waste product to get started</p>
          <Link href="/user/upload" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all">
            <span className="material-symbols-outlined text-base">upload_file</span> Submit a Product
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
