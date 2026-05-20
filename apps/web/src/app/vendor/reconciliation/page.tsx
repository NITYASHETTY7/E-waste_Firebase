"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function VendorReconciliationPage() {
  const { currentUser, listings, submitReconciliation } = useApp();
  const [modal, setModal] = useState<string | null>(null);
  const [form, setForm] = useState({ finalWeight: '', finalQuantity: '', finalValue: '', notes: '', file: null as File | null });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  if (!currentUser) return null;

  // Show listings where vendor has acknowledged handover OR where reconciliation already exists
  const myListings = listings.filter(
    l => (l.winnerVendorId === currentUser.companyId || l.winnerVendorId === currentUser.id || l.winnerVendorName === currentUser.name) &&
    (l.handoverStatus === 'acknowledged' || l.reconciliationStatus)
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const openModal = (listingId: string, listing: any) => {
    setForm({
      finalWeight: listing.reconciliationFinalWeight?.toString() || listing.weight?.toString() || '',
      finalQuantity: listing.reconciliationFinalQuantity?.toString() || '',
      finalValue: listing.reconciliationFinalValue?.toString() || listing.price?.toString() || '',
      notes: listing.reconciliationNotes || '',
      file: null,
    });
    setModal(listingId);
  };

  const handleSubmit = async () => {
    if (!modal) return;
    const weight = parseFloat(form.finalWeight);
    const qty = parseFloat(form.finalQuantity);
    const value = parseFloat(form.finalValue);
    if (!weight || !qty || !value || isNaN(weight) || isNaN(qty) || isNaN(value)) {
      showToast('Please fill in all required fields with valid numbers.');
      return;
    }
    setSubmitting(true);
    await submitReconciliation(modal, weight, qty, value, form.notes, form.file || undefined);
    setSubmitting(false);
    setModal(null);
    showToast('Reconciliation submitted. Awaiting admin verification.');
  };

  const getStatusBadge = (status?: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: 'bg-yellow-100 text-yellow-700', label: 'Pending Submission' },
      submitted: { cls: 'bg-blue-100 text-blue-700', label: 'Under Review' },
      verified: { cls: 'bg-green-100 text-green-700', label: 'Verified' },
    };
    return map[status || 'pending'] || map.pending;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-bold">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Final Reconciliation</h1>
        <p className="text-sm text-slate-500 mt-1">Upload the final reconciliation data after completing the site pickup.</p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-blue-600 mt-0.5">info</span>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-bold">What is reconciliation?</p>
          <p>After physically collecting the e-waste, upload the actual final weight, quantity count, and commercial value as measured at site. This will be verified by the WeConnect admin to close the deal.</p>
        </div>
      </div>

      {myListings.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">balance</span>
          <p className="font-bold">No reconciliations yet.</p>
          <p className="text-sm">Acknowledge handover documents first, then submit reconciliation after pickup.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {myListings.map(listing => {
            const badge = getStatusBadge(listing.reconciliationStatus);
            const canSubmit = !listing.reconciliationStatus || listing.reconciliationStatus === 'pending';

            return (
              <div key={listing.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{listing.title}</p>
                    <p className="text-xs text-slate-500">{listing.id} · {listing.category} · Expected: {listing.weight} kg</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.cls}`}>{badge.label}</span>
                </div>

                <div className="px-6 py-4">
                  {/* Expected vs Actual comparison */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Expected (Bid)</p>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Weight</span>
                          <span className="font-bold text-slate-900 dark:text-white">{listing.weight} kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Bid Value</span>
                          <span className="font-bold text-slate-900 dark:text-white">₹{(listing.price || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                        {listing.reconciliationStatus ? 'Actual (Submitted)' : 'Actual (Pending)'}
                      </p>
                      <div className={`rounded-xl p-3 space-y-1.5 ${listing.reconciliationStatus ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                        {listing.reconciliationFinalWeight ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Final Weight</span>
                              <span className="font-bold text-green-700 dark:text-green-400">{listing.reconciliationFinalWeight} kg</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Final Qty</span>
                              <span className="font-bold text-green-700 dark:text-green-400">{listing.reconciliationFinalQuantity} units</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Final Value</span>
                              <span className="font-bold text-green-700 dark:text-green-400">₹{(listing.reconciliationFinalValue || 0).toLocaleString('en-IN')}</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-yellow-700 dark:text-yellow-400">Not yet submitted</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {listing.reconciliationNotes && (
                    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-bold">Notes: </span>{listing.reconciliationNotes}
                    </div>
                  )}

                  {listing.reconciliationStatus === 'verified' && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-300">
                      <span className="material-symbols-outlined text-base align-middle mr-1">verified</span>
                      Reconciliation verified by admin. Deal is now complete.
                    </div>
                  )}

                  {listing.reconciliationStatus === 'submitted' && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                      <span className="material-symbols-outlined text-base align-middle mr-1">hourglass_top</span>
                      Submitted on {listing.reconciliationSubmittedAt ? new Date(listing.reconciliationSubmittedAt).toLocaleDateString('en-IN') : '—'}. Awaiting admin verification.
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-5">
                  {canSubmit && (
                    <button onClick={() => openModal(listing.id, listing)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      {listing.reconciliationFinalWeight ? 'Update Reconciliation' : 'Submit Reconciliation'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-black text-slate-900 dark:text-white">Submit Reconciliation Data</h2>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">Enter the actual values as measured on site after material collection.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Final Weight (kg) *</label>
                  <input type="number" placeholder="e.g. 3250" value={form.finalWeight}
                    onChange={e => setForm(p => ({ ...p, finalWeight: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Final Quantity (units) *</label>
                  <input type="number" placeholder="e.g. 60" value={form.finalQuantity}
                    onChange={e => setForm(p => ({ ...p, finalQuantity: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Final Commercial Value (₹) *</label>
                <input type="number" placeholder="e.g. 280000" value={form.finalValue}
                  onChange={e => setForm(p => ({ ...p, finalValue: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Upload Reconciliation Sheet (Excel/PDF)</label>
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
                  <input type="file" accept=".xlsx,.xls,.csv,.pdf"
                    onChange={e => setForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                    className="hidden" id="recon-file" />
                  <label htmlFor="recon-file" className="cursor-pointer">
                    <span className="material-symbols-outlined text-3xl text-slate-400 block mb-1">upload_file</span>
                    {form.file ? (
                      <p className="text-sm font-bold text-green-600">{form.file.name}</p>
                    ) : (
                      <p className="text-sm text-slate-400">Click to upload Excel / PDF</p>
                    )}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks / Discrepancy Notes</label>
                <textarea rows={3} placeholder="Note any discrepancies from original bid quantities..." value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">send</span>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
