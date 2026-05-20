"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import api from "@/lib/api";

const CONDITIONS = [
  { value: "working", label: "Working", icon: "check_circle", desc: "Fully functional" },
  { value: "partially_working", label: "Partially Working", icon: "warning", desc: "Some issues but usable" },
  { value: "not_working", label: "Not Working", icon: "cancel", desc: "Broken / non-functional" },
  { value: "scrap", label: "Scrap / Parts", icon: "recycling", desc: "For parts or recycling" },
];

export default function UploadProductPage() {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const invoiceRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [condition, setCondition] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [invoice, setInvoice] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhotos = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - photos.length);
    setPhotos(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setPhotoPreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!condition) { setError("Please select the product condition"); return; }
    if (photos.length === 0) { setError("Please upload at least one photo"); return; }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("weightKg", weight);
      form.append("condition", condition);
      form.append("askingPrice", askingPrice);
      if (description) form.append("description", description);
      photos.forEach(p => form.append("photos", p));
      if (invoice) form.append("invoice", invoice);

      await api.post('/user-products', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      router.push("/user/my-products?submitted=1");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Submission failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Submit a Product</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Fill in the details below. Our admin will review and open it for vendor quotes.</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 dark:bg-red-900/20 dark:border-red-800">
            <span className="material-symbols-outlined text-red-500 text-sm">error</span>
            <p className="text-red-700 dark:text-red-400 text-xs font-bold">{error}</p>
          </div>
        )}

        {/* Basic Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Product Information</h2>

          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Product Name *</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dell Laptop, iPhone 12, CRT Monitor"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/5 outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Weight (kg) *</label>
              <input required type="number" min="0.1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 2.5"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/5 outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Your Asking Price (₹) *</label>
              <input required type="number" min="0" step="1" value={askingPrice} onChange={e => setAskingPrice(e.target.value)} placeholder="e.g. 5000"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/5 outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Description (optional)</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the product — model, age, any defects..."
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/5 outline-none transition-all resize-none dark:bg-slate-950 dark:text-white dark:border-slate-700" />
          </div>
        </motion.div>

        {/* Condition */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Condition *</h2>
          <div className="grid grid-cols-2 gap-3">
            {CONDITIONS.map(c => (
              <button key={c.value} type="button" onClick={() => setCondition(c.value)}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${condition === c.value ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'}`}>
                <span className={`material-symbols-outlined text-xl ${condition === c.value ? 'text-purple-600' : 'text-slate-400'}`}>{c.icon}</span>
                <div>
                  <p className={`text-sm font-black ${condition === c.value ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>{c.label}</p>
                  <p className="text-[10px] text-slate-400">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Photos */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Product Photos * <span className="normal-case font-normal text-slate-400">(up to 5)</span></h2>

          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotos(e.target.files)} />

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-3">
            {photoPreviews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button type="button" onClick={() => photoRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-1 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all">
                <span className="material-symbols-outlined text-2xl text-slate-400">add_photo_alternate</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Add</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400">Clear photos increase your chances of getting better quotes.</p>
        </motion.div>

        {/* Purchase Invoice */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Purchase Invoice / Proof of Ownership</h2>
          <p className="text-[11px] text-slate-400 mb-4">Upload the original purchase bill to verify ownership. PDF, JPG or PNG up to 10MB.</p>

          <input ref={invoiceRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => setInvoice(e.target.files?.[0] ?? null)} />

          {invoice ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl">
              <span className="material-symbols-outlined text-green-600">description</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{invoice.name}</p>
                <p className="text-[10px] text-slate-500">{(invoice.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button type="button" onClick={() => setInvoice(null)} className="text-red-500 hover:text-red-600">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => invoiceRef.current?.click()}
              className="w-full p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center gap-2 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all">
              <span className="material-symbols-outlined text-3xl text-slate-400">upload_file</span>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Click to upload invoice</p>
              <p className="text-[10px] text-slate-400">PDF, JPG, PNG · max 10MB</p>
            </button>
          )}
        </motion.div>

        {/* Submit */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="flex gap-4">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-2 flex-1 py-5 bg-purple-600 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-purple-700 hover:shadow-2xl hover:shadow-purple-700/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
            {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">upload_file</span> Submit Product</>}
          </button>
        </motion.div>
      </form>
    </div>
  );
}
