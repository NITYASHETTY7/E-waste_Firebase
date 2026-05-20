"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

const CONDITION_COLOR: Record<string, string> = {
  working: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  partially_working: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  not_working: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  scrap: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface Product {
  id: string;
  name: string;
  weightKg: number;
  condition: string;
  askingPrice: number;
  description?: string;
  photoUrls: string[];
  user: { id: string; name: string };
  alreadyQuoted: boolean;
  myQuote?: { id: string; offeredPrice: number; status: string } | null;
}

function QuoteModal({ product, onClose, onSuccess }: { product: Product; onClose: () => void; onSuccess: () => void }) {
  const [price, setPrice] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.post(`/user-products/${product.id}/quote`, {
        offeredPrice: parseFloat(price),
        remarks: remarks || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit quote");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-900 dark:text-white">Submit Quote</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl mb-5">
          <p className="font-bold text-sm text-slate-900 dark:text-white">{product.name}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{product.weightKg}kg · User asking: <strong>₹{product.askingPrice.toLocaleString()}</strong></p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
            <p className="text-xs text-red-700 dark:text-red-400 font-bold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Your Offered Price (₹) *</label>
            <input required type="number" min="1" step="1" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="Enter your offer amount"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Remarks (optional)</label>
            <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)}
              placeholder="Any notes for the user..."
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all resize-none dark:bg-slate-950 dark:text-white dark:border-slate-700" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <><span className="material-symbols-outlined text-sm">send</span> Submit Quote</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function IndividualProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const load = () => {
    api.get('/user-products/vendor/open').then(r => setProducts(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleQuoteSuccess = () => {
    setSelectedProduct(null);
    setSuccessMsg("Quote submitted successfully! The user will be notified.");
    setTimeout(() => setSuccessMsg(""), 5000);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Individual Products
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Individual users looking to sell their e-waste. Submit quotes for products you can pick up.</p>
      </motion.div>

      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-center gap-3">
            <span className="material-symbols-outlined text-green-600">check_circle</span>
            <p className="text-green-700 dark:text-green-400 text-sm font-bold">{successMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-80 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-4">person_pin</span>
          <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">No individual listings yet</h3>
          <p className="text-slate-400 text-sm">Products submitted by individual users will appear here once approved by admin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              {/* Photo */}
              {product.photoUrls?.length > 0 ? (
                <div className="relative h-44 overflow-hidden cursor-pointer" onClick={() => setLightboxImg(product.photoUrls[0])}>
                  <img src={product.photoUrls[0]} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  {product.photoUrls.length > 1 && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] font-bold rounded-lg">
                      +{product.photoUrls.length - 1} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-44 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-slate-400">devices</span>
                </div>
              )}

              {/* Details */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{product.name}</h3>
                  <span className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider capitalize ${CONDITION_COLOR[product.condition] ?? 'bg-slate-100 text-slate-600'}`}>
                    {product.condition.replace('_', ' ')}
                  </span>
                </div>

                {product.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{product.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Weight</p>
                    <p className="font-black text-slate-900 dark:text-white text-sm">{product.weightKg} kg</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Asking Price</p>
                    <p className="font-black text-slate-900 dark:text-white text-sm">₹{product.askingPrice.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-auto">
                  {product.alreadyQuoted && product.myQuote ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Your Quote</p>
                        <p className="font-black text-blue-800 dark:text-blue-200 text-base">₹{product.myQuote.offeredPrice.toLocaleString()}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${product.myQuote.status === 'accepted' ? 'bg-green-100 text-green-700' : product.myQuote.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {product.myQuote.status}
                      </span>
                    </div>
                  ) : (
                    <button onClick={() => setSelectedProduct(product)}
                      className="w-full py-3.5 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50">
                      <span className="material-symbols-outlined text-sm">request_quote</span> Submit Quote
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Quote Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <QuoteModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onSuccess={handleQuoteSuccess}
          />
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxImg(null)}>
            <img src={lightboxImg} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
