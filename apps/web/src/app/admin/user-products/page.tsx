"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING_ADMIN_REVIEW: "bg-amber-100 text-amber-700",
  ADMIN_APPROVED: "bg-blue-100 text-blue-700",
  QUOTE_RECEIVED: "bg-purple-100 text-purple-700",
  QUOTE_ACCEPTED: "bg-indigo-100 text-indigo-700",
  PICKUP_REQUESTED: "bg-orange-100 text-orange-700",
  PICKUP_IN_PROGRESS: "bg-sky-100 text-sky-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_ADMIN_REVIEW: "Pending Review",
  ADMIN_APPROVED: "Approved",
  QUOTE_RECEIVED: "Quotes In",
  QUOTE_ACCEPTED: "Quote Accepted",
  PICKUP_REQUESTED: "Pickup Requested",
  PICKUP_IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

interface Product {
  id: string; name: string; weightKg: number; condition: string;
  askingPrice: number; status: string; adminRemarks?: string;
  photoUrls: string[]; invoiceUrl?: string; description?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; phone?: string };
  quotes: any[];
}

function ReviewModal({ product, onClose, onSuccess }: { product: Product; onClose: () => void; onSuccess: () => void }) {
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !remarks.trim()) { setError("Please provide a reason for rejection"); return; }
    setError(""); setLoading(true);
    try {
      await api.patch(`/user-products/${product.id}/review`, { action, remarks: remarks || undefined });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Action failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-900 dark:text-white">Review Product</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Photos */}
        {product.photoUrls?.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {product.photoUrls.map((url, i) => (
              <img key={i} src={url} alt="" className="h-24 w-24 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
            ))}
          </div>
        )}

        {/* Product Info */}
        <div className="space-y-2 mb-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Product</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{product.name}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Condition</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5 capitalize">{product.condition.replace('_', ' ')}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weight</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{product.weightKg} kg</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Asking Price</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">₹{product.askingPrice.toLocaleString()}</p>
            </div>
          </div>

          {product.description && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{product.description}</p>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">User</p>
            <p className="font-bold text-slate-900 dark:text-white text-sm">{product.user.name}</p>
            <p className="text-[11px] text-slate-500">{product.user.email} · {product.user.phone ?? 'No phone'}</p>
          </div>

          {product.invoiceUrl && (
            <a href={product.invoiceUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition-all">
              <span className="material-symbols-outlined text-blue-600">description</span>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400">View Purchase Invoice</p>
              <span className="material-symbols-outlined text-blue-500 text-sm ml-auto">open_in_new</span>
            </a>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <p className="text-xs text-red-700 dark:text-red-400 font-bold">{error}</p>
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Remarks (required for rejection)</label>
          <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add any notes for the user..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-blue-500 outline-none transition-all resize-none text-sm dark:bg-slate-950 dark:text-white dark:border-slate-700" />
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={() => handleAction('reject')} disabled={loading}
            className="flex-1 py-4 border-2 border-red-300 text-red-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50">
            Reject
          </button>
          <button onClick={() => handleAction('approve')} disabled={loading}
            className="flex-1 py-4 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <><span className="material-symbols-outlined text-sm">check_circle</span> Approve</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminUserProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Product | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/user-products/admin/all').then(r => setProducts(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? products : products.filter(p => p.status === filter);
  const pending = products.filter(p => p.status === 'PENDING_ADMIN_REVIEW').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Individual User Products
            {pending > 0 && <span className="ml-3 px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full font-black">{pending} pending</span>}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Review and approve individual user e-waste submissions</p>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['all', 'PENDING_ADMIN_REVIEW', 'ADMIN_APPROVED', 'QUOTE_RECEIVED', 'COMPLETED', 'REJECTED'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
            {f === 'all' ? 'All' : STATUS_LABEL[f] ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-3">inventory_2</span>
          <p className="text-slate-500 dark:text-slate-400 font-bold">No products found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(product => (
              <div key={product.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                {product.photoUrls?.[0] ? (
                  <img src={product.photoUrls[0]} alt={product.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-400 text-xl">devices</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 dark:text-white text-sm">{product.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{product.weightKg}kg · {product.condition.replace('_', ' ')} · ₹{product.askingPrice.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{product.user.name} · {product.user.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${STATUS_COLOR[product.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABEL[product.status] ?? product.status}
                  </span>
                  <p className="text-[10px] text-slate-400">{new Date(product.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                  {product.status === 'PENDING_ADMIN_REVIEW' ? (
                    <button onClick={() => setSelected(product)}
                      className="px-4 py-2 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-amber-600 transition-all">
                      Review
                    </button>
                  ) : (
                    <button onClick={() => setSelected(product)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                      View
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <ReviewModal
            product={selected}
            onClose={() => setSelected(null)}
            onSuccess={() => { setSelected(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
