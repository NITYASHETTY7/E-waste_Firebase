"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

interface Quote {
  id: string;
  offeredPrice: number;
  remarks?: string;
  status: string;
  createdAt: string;
  vendorCompany: { id: string; name: string };
}

interface Product {
  id: string;
  name: string;
  weightKg: number;
  askingPrice: number;
  status: string;
  photoUrls: string[];
  quotes: Quote[];
}

export default function VendorQuotesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    api.get('/user-products/mine').then(r => {
      setProducts(r.data.filter((p: Product) => p.quotes?.length > 0));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAccept = async (productId: string, quoteId: string) => {
    setAccepting(quoteId);
    setError(""); setSuccess("");
    try {
      await api.patch(`/user-products/${productId}/accept-quote/${quoteId}`);
      setSuccess("Quote accepted! The vendor has been notified and will contact you to schedule pickup.");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to accept quote. Please try again.");
    } finally { setAccepting(null); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Vendor Quotes</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Review offers from vendors and accept the best one</p>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-green-600 text-lg mt-0.5">check_circle</span>
            <p className="text-green-700 dark:text-green-400 text-sm font-bold">{success}</p>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500 text-sm">error</span>
            <p className="text-red-700 dark:text-red-400 text-xs font-bold">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-6">{[1,2].map(i => <div key={i} className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-4">request_quote</span>
          <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">No quotes yet</h3>
          <p className="text-slate-400 text-sm">Once your products are approved, vendors will start submitting quotes here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {products.map(product => {
            const pendingQuotes = product.quotes.filter(q => q.status === 'pending');
            const acceptedQuote = product.quotes.find(q => q.status === 'accepted');
            const isSettled = ['QUOTE_ACCEPTED', 'PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS', 'COMPLETED'].includes(product.status);

            return (
              <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {/* Product Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                  {product.photoUrls?.[0] ? (
                    <img src={product.photoUrls[0]} alt={product.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <span className="material-symbols-outlined text-purple-600 text-xl">devices</span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">{product.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {product.weightKg}kg · Your asking price: <span className="font-bold text-slate-700 dark:text-slate-200">₹{product.askingPrice.toLocaleString()}</span>
                    </p>
                  </div>
                  {isSettled && acceptedQuote && (
                    <div className="ml-auto px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
                      <p className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest">Accepted</p>
                      <p className="font-black text-green-800 dark:text-green-300 text-sm">₹{acceptedQuote.offeredPrice.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Quotes */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {product.quotes.map((q, i) => (
                    <div key={q.id} className={`p-5 flex items-center gap-4 ${q.status === 'rejected' ? 'opacity-50' : ''}`}>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-slate-500 text-lg">store</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 dark:text-white text-sm">{q.vendorCompany.name}</p>
                        {q.remarks && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">"{q.remarks}"</p>}
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(q.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-slate-900 dark:text-white">₹{q.offeredPrice.toLocaleString()}</p>
                        <p className={`text-[10px] font-bold ${q.offeredPrice >= product.askingPrice ? 'text-green-600' : 'text-orange-500'}`}>
                          {q.offeredPrice >= product.askingPrice ? '↑ Above ask' : `↓ ₹${(product.askingPrice - q.offeredPrice).toLocaleString()} below ask`}
                        </p>
                      </div>
                      {!isSettled && q.status === 'pending' && (
                        <button
                          onClick={() => handleAccept(product.id, q.id)}
                          disabled={accepting === q.id}
                          className="shrink-0 flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-200/50 dark:shadow-purple-900/50">
                          {accepting === q.id ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <><span className="material-symbols-outlined text-sm">handshake</span> Accept & Request Pickup</>}
                        </button>
                      )}
                      {q.status === 'accepted' && (
                        <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl font-black text-xs uppercase tracking-widest">
                          <span className="material-symbols-outlined text-sm">check_circle</span> Accepted
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!isSettled && pendingQuotes.length > 0 && (
                  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      Tip: Accepting a quote will notify the vendor with your contact details to arrange pickup.
                    </p>
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
