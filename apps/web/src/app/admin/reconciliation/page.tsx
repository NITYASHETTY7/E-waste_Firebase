"use client";

import { useApp } from "@/context/AppContext";

export default function AdminReconciliationPage() {
  const { listings, verifyReconciliation } = useApp();

  const reconListings = listings.filter(l => l.reconciliationStatus && l.reconciliationStatus !== 'pending');

  const stats = {
    total: reconListings.length,
    submitted: reconListings.filter(l => l.reconciliationStatus === 'submitted').length,
    verified: reconListings.filter(l => l.reconciliationStatus === 'verified').length,
  };

  const getStatusBadge = (status?: string) => {
    const map: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-700',
      verified: 'bg-green-100 text-green-700',
    };
    return map[status || ''] || 'bg-slate-100 text-slate-500';
  };

  const deviation = (expected?: number, actual?: number) => {
    if (!expected || !actual) return null;
    const pct = ((actual - expected) / expected * 100);
    return pct;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Reconciliation Management</h1>
        <p className="text-sm text-slate-500 mt-1">Review and verify final reconciliation data submitted by vendors after material pickup.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Reconciliations', value: stats.total, icon: 'balance', color: 'text-slate-600' },
          { label: 'Pending Review', value: stats.submitted, icon: 'hourglass_top', color: 'text-blue-600' },
          { label: 'Verified', value: stats.verified, icon: 'verified', color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              <span className={`material-symbols-outlined text-2xl ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-slate-500 font-bold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {reconListings.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">balance</span>
          <p className="font-bold">No reconciliations submitted yet.</p>
          <p className="text-sm">Vendors submit reconciliation after completing material pickup.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {reconListings.map(listing => {
            const weightDev = deviation(listing.weight, listing.reconciliationFinalWeight);
            const valueDev = deviation(listing.price, listing.reconciliationFinalValue);

            return (
              <div key={listing.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{listing.title}</p>
                    <p className="text-xs text-slate-500">
                      {listing.id} · Client: {listing.userName} · Vendor: {listing.winnerVendorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${getStatusBadge(listing.reconciliationStatus)}`}>
                      {listing.reconciliationStatus === 'verified' ? 'Verified' : 'Pending Review'}
                    </span>
                    {listing.reconciliationSubmittedAt && (
                      <span className="text-xs text-slate-400">
                        Submitted: {new Date(listing.reconciliationSubmittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-2 text-xs font-black text-slate-500 uppercase">Parameter</th>
                          <th className="pb-2 text-xs font-black text-slate-500 uppercase">Expected (Bid)</th>
                          <th className="pb-2 text-xs font-black text-slate-500 uppercase">Actual (Submitted)</th>
                          <th className="pb-2 text-xs font-black text-slate-500 uppercase">Deviation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-3 font-bold text-slate-700 dark:text-slate-300">Weight</td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">{listing.weight} kg</td>
                          <td className="py-3 font-bold text-slate-900 dark:text-white">{listing.reconciliationFinalWeight} kg</td>
                          <td className="py-3">
                            {weightDev !== null && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                Math.abs(weightDev) < 5 ? 'bg-green-100 text-green-700' :
                                Math.abs(weightDev) < 15 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {weightDev > 0 ? '+' : ''}{weightDev.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 font-bold text-slate-700 dark:text-slate-300">Quantity</td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">—</td>
                          <td className="py-3 font-bold text-slate-900 dark:text-white">{listing.reconciliationFinalQuantity} units</td>
                          <td className="py-3"><span className="text-slate-400 text-xs">—</span></td>
                        </tr>
                        <tr>
                          <td className="py-3 font-bold text-slate-700 dark:text-slate-300">Commercial Value</td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">₹{(listing.price || 0).toLocaleString('en-IN')}</td>
                          <td className="py-3 font-bold text-slate-900 dark:text-white">₹{(listing.reconciliationFinalValue || 0).toLocaleString('en-IN')}</td>
                          <td className="py-3">
                            {valueDev !== null && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                Math.abs(valueDev) < 5 ? 'bg-green-100 text-green-700' :
                                Math.abs(valueDev) < 15 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {valueDev > 0 ? '+' : ''}{valueDev.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {listing.reconciliationNotes && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Vendor Notes: </span>{listing.reconciliationNotes}
                    </div>
                  )}

                  {listing.reconciliationStatus === 'verified' && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-300">
                      <span className="material-symbols-outlined text-base align-middle mr-1">verified</span>
                      Reconciliation verified. Deal is closed.
                    </div>
                  )}
                </div>

                {/* Actions */}
                {listing.reconciliationStatus === 'submitted' && (
                  <div className="flex gap-3 px-6 pb-5">
                    <button onClick={() => verifyReconciliation(listing.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">verified</span>
                      Verify & Close Deal
                    </button>
                    <button className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">flag</span>
                      Flag Discrepancy
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
