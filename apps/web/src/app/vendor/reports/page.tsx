"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { formatDate } from "@/utils/format";

const fmtINR = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const PROGRESS_LABELS: Record<string, string> = {
  PENDING: "Awaiting Payment",
  SUBMITTED: "Proof Submitted",
  CONFIRMED: "Payment Confirmed",
  GATE_PASS_ISSUED: "Gate Pass Issued",
  VENDOR_ACKNOWLEDGED: "Gate Pass Acknowledged",
  IN_TRANSIT: "In Transit",
  SCHEDULED: "Pickup Scheduled",
  DOCUMENTS_UPLOADED: "Compliance Uploaded",
  RECONCILIATION_DONE: "Reconciled",
  INVOICE_GENERATED: "Invoice Generated",
  COMPLETED: "Completed",
};

const PROGRESS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
  GATE_PASS_ISSUED: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30",
  VENDOR_ACKNOWLEDGED: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30",
  IN_TRANSIT: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
  SCHEDULED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30",
  DOCUMENTS_UPLOADED: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30",
  RECONCILIATION_DONE: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30",
  INVOICE_GENERATED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30",
  COMPLETED: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30",
};

export default function VendorReports() {
  const { bids, currentUser } = useApp();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const myBids = bids.filter(b => b.vendorId === currentUser?.id);

  const fetchAuctions = useCallback(async () => {
    if (!currentUser?.companyId) return;
    try {
      setLoading(true);
      const res = await api.get("/auctions?status=COMPLETED");
      const won = (res.data ?? []).filter((a: any) => a.winnerId === currentUser.companyId);
      const enriched = await Promise.all(won.map(async (a: any) => {
        try {
          const [postRes, payRes, pickupRes] = await Promise.allSettled([
            api.get(`/auctions/${a.id}/post-auction`),
            api.get(`/payments/auction/${a.id}`),
            api.get(`/pickups/by-auction/${a.id}`),
          ]);
          return {
            ...(postRes.status === "fulfilled" ? postRes.value.data : a),
            payment: payRes.status === "fulfilled" ? payRes.value.data : a.payment,
            pickup: pickupRes.status === "fulfilled" ? pickupRes.value.data : null,
          };
        } catch {
          return a;
        }
      }));
      setAuctions(enriched);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [currentUser?.companyId]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // Logic: Calculate Winning Rate
  const winRate = myBids.length > 0 ? Math.round((auctions.length / myBids.length) * 100) : 0;

  // Logic: Calculate outflow and weight purchased
  const totalKg = auctions.reduce((s, a) => s + (a.pickup?.finalWeight ?? a.weight ?? 0), 0);
  const totalPaymentOutflow = auctions.reduce((s, a) => {
    const winningAmount = a.payment?.clientAmount ?? a.bids?.[0]?.amount ?? a.basePrice ?? 0;
    const commission = a.payment?.commissionAmount ?? Math.round(winningAmount * 0.05);
    return s + (a.pickup?.finalAmount ?? (winningAmount + commission));
  }, 0);

  // Logic: Material Purchased Category Breakdown
  const categoryMap: Record<string, number> = {};
  auctions.forEach(a => {
    const category = a.category || "General";
    const weight = a.pickup?.finalWeight ?? a.weight ?? 0;
    categoryMap[category] = (categoryMap[category] || 0) + weight;
  });

  const materialData = Object.entries(categoryMap).map(([label, kg], i) => ({
    label, kg,
    color: ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"][i % 5]
  }));

  const maxKg = Math.max(...materialData.map(d => d.kg), 1);

  // Client-side CSV generator utility
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPerformanceReport = () => {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Winning Rate", `${winRate}%`],
      ["Total Auctions Participated", String(myBids.length)],
      ["Total Auctions Won", String(auctions.length)],
      ["Total Material Purchased (KG)", String(totalKg)],
      ["Total Payment Outflow (INR)", `INR ${totalPaymentOutflow}`],
    ];
    downloadCSV("vendor_performance_report.csv", headers, rows);
  };

  const downloadMaterialBreakdown = () => {
    const headers = ["Category", "Total Material Purchased (KG)", "Percentage of Total"];
    const rows = materialData.map(d => [
      d.label,
      String(d.kg),
      `${totalKg > 0 ? Math.round((d.kg / totalKg) * 100) : 0}%`
    ]);
    downloadCSV("material_breakdown_report.csv", headers, rows);
  };

  const downloadPaymentLedger = () => {
    const headers = [
      "Auction Title",
      "Auction ID",
      "Date Won",
      "Client",
      "Material Value (INR)",
      "Platform Fee (INR)",
      "Total Amount (INR)",
      "Payment Status",
      "UTR Reference",
      "Pickup Status",
      "Gate Pass Number",
      "Final Reconciled Weight (KG)",
      "Final Reconciled Amount (INR)"
    ];
    const rows = auctions.map(a => {
      const payment = a.payment;
      const pickup = a.pickup;
      const topBid = a.bids?.[0];
      const winningAmount = payment?.clientAmount ?? topBid?.amount ?? a.basePrice ?? 0;
      const commission = payment?.commissionAmount ?? Math.round(winningAmount * 0.05);
      const total = winningAmount + commission;
      return [
        a.title || "Unknown Auction",
        a.id,
        a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-IN") : "—",
        a.client?.name || "—",
        String(winningAmount),
        String(commission),
        String(total),
        payment?.status || "PENDING",
        payment?.utrNumber || "—",
        pickup?.status || "PENDING",
        pickup?.gatePassNumber || "—",
        pickup?.finalWeight ? String(pickup.finalWeight) : "—",
        pickup?.finalAmount ? String(pickup.finalAmount) : "—",
      ];
    });
    downloadCSV("acquisitions_and_payments_ledger.csv", headers, rows);
  };

  const downloadAuditPack = () => {
    const w = window.open("", "_blank");
    if (!w) return;

    let rowsHtml = auctions.map((a, i) => {
      const payment = a.payment;
      const pickup = a.pickup;
      const winningAmount = payment?.clientAmount ?? a.bids?.[0]?.amount ?? a.basePrice ?? 0;
      return `
        <tr>
          <td>${i + 1}</td>
          <td><b>${a.title}</b><br><small style="color: #6b7280">${a.id}</small></td>
          <td>${a.category}</td>
          <td>${a.client?.name || "—"}</td>
          <td>₹${winningAmount.toLocaleString("en-IN")}</td>
          <td>${payment?.status || "PENDING"}</td>
          <td>${pickup?.gatePassNumber || "—"}</td>
          <td>${PROGRESS_LABELS[pickup?.status] ?? pickup?.status ?? "Awaiting Payment"}</td>
          <td>${pickup?.finalWeight ? `${pickup.finalWeight} kg` : "—"}</td>
        </tr>
      `;
    }).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>Vendor Performance Audit Pack</title>
<style>
  body{font-family:Arial,sans-serif;padding:30px;color:#111}
  h1{font-size:22px;color:#059669;margin-bottom:5px}
  p{font-size:12px;color:#6b7280;margin-top:0;margin-bottom:20px}
  .stats{display:flex;gap:15px;margin-bottom:25px}
  .stat-box{border:1px solid #e5e7eb;padding:12px 20px;border-radius:8px;flex:1}
  .stat-label{font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:bold}
  .stat-val{font-size:18px;font-weight:bold;color:#059669;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th{background:#f0fdf4;padding:8px 10px;font-size:10px;text-transform:uppercase;border:1px solid #d1fae5;text-align:left;color:#065f46}
  td{padding:10px;border:1px solid #e5e7eb;font-size:11px}
</style></head><body>
  <h1>VENDOR PERFORMANCE AUDIT PACK</h1>
  <p>Generated on ${new Date().toLocaleDateString("en-IN")} for ${currentUser?.name || "Vendor"}</p>
  <div class="stats">
    <div class="stat-box"><div class="stat-label">Winning Rate</div><div class="stat-val">${winRate}%</div></div>
    <div class="stat-box"><div class="stat-label">Total Material</div><div class="stat-val">${totalKg.toLocaleString()} KG</div></div>
    <div class="stat-box"><div class="stat-label">Total Outflow</div><div class="stat-val">₹${totalPaymentOutflow.toLocaleString("en-IN")}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Auction Item</th>
        <th>Category</th>
        <th>Client</th>
        <th>Winning Amount</th>
        <th>Payment Status</th>
        <th>Gate Pass No.</th>
        <th>Pickup Status</th>
        <th>Final Weight</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-slate-900 dark:text-white">Vendor Performance Audit</h2>
          <p className="text-slate-500 mt-1">Real-time winning rates, acquisition history, and transaction summaries.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAuctions} disabled={loading}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50">
            <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>refresh</span>
            Refresh
          </button>
          <button onClick={downloadAuditPack} disabled={auctions.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined text-sm">print</span>
            Print Audit Pack
          </button>
          <button onClick={downloadPerformanceReport}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
            <span className="material-symbols-outlined text-sm">download</span>
            CSV Summary
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin block mb-2">progress_activity</span>
          <p className="text-xs">Loading performance data...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Winning Rate Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between h-48 border-t-4 border-t-emerald-500">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Winning Rate</p>
                <h3 className="text-4xl font-headline font-bold text-slate-900 dark:text-white">{winRate}%</h3>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden dark:bg-slate-800">
                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${winRate}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">{auctions.length} Wins / {myBids.length} Participated</p>
            </div>

            {/* Material Purchased Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between h-48 border-t-4 border-t-blue-500">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Material Purchased</p>
                <h3 className="text-4xl font-headline font-bold text-slate-900 dark:text-white">{totalKg.toLocaleString()} <span className="text-lg font-bold text-slate-400">KG</span></h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Across {auctions.length} completed auctions</p>
            </div>

            {/* Payment History Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between h-48 border-t-4 border-t-amber-500">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Payment Outflow</p>
                <h3 className="text-4xl font-headline font-bold text-slate-900 dark:text-white">{fmtINR(totalPaymentOutflow)}</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Includes platform commissions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Material Categories Detail */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <h4 className="font-headline font-bold text-slate-900 dark:text-white">Material Breakdown by Category</h4>
                <button onClick={downloadMaterialBreakdown} disabled={materialData.length === 0}
                  className="text-[10px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50">
                  <span className="material-symbols-outlined text-xs">download</span>Export CSV
                </button>
              </div>
              {materialData.length > 0 ? (
                <div className="space-y-6">
                  {materialData.map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-slate-600 dark:text-slate-400">{m.label}</span>
                        <span className="text-slate-900 dark:text-white">{m.kg.toLocaleString()} KG</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                        <div className={`h-full ${m.color} rounded-full`} style={{ width: `${(m.kg / maxKg) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 dark:bg-slate-950 dark:border-slate-700">
                  <p className="text-slate-400 text-sm font-bold">No acquisition data available yet.</p>
                </div>
              )}
            </div>

            {/* Detailed Acquisitions & Payments Ledger */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <h4 className="font-headline font-bold text-slate-900 dark:text-white">Acquisitions Ledger</h4>
                <button onClick={downloadPaymentLedger} disabled={auctions.length === 0}
                  className="text-[10px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50">
                  <span className="material-symbols-outlined text-xs">download</span>Export CSV
                </button>
              </div>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {auctions.length > 0 ? (
                  auctions.map(a => {
                    const payment = a.payment;
                    const pickup = a.pickup;
                    const winningAmount = payment?.clientAmount ?? a.bids?.[0]?.amount ?? a.basePrice ?? 0;
                    const commission = payment?.commissionAmount ?? Math.round(winningAmount * 0.05);
                    const total = winningAmount + commission;
                    const activeProgressKey = pickup?.status || payment?.status || "PENDING";
                    const progressLabel = PROGRESS_LABELS[activeProgressKey] || "Processing";
                    const progressColor = PROGRESS_COLORS[activeProgressKey] || "bg-slate-100 text-slate-700";

                    return (
                      <div key={a.id} className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-slate-800 text-sm dark:text-slate-200">{a.title}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                              {a.createdAt ? formatDate(a.createdAt) : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600 dark:text-emerald-500">{fmtINR(total)}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">Qty: {pickup?.finalWeight ?? a.weight ?? 0} kg</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center border-t border-slate-200/50 dark:border-slate-700/50 pt-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${progressColor}`}>
                            {progressLabel}
                          </span>
                          {payment?.utrNumber && (
                            <span className="text-[9px] font-mono text-slate-400">UTR: {payment.utrNumber.substring(0, 10)}...</span>
                          )}
                          {pickup?.gatePassNumber && (
                            <span className="text-[9px] font-mono text-slate-400">GP: {pickup.gatePassNumber}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl dark:border-slate-800">
                    <p className="text-slate-300 text-sm font-bold italic">No payment or acquisition history recorded.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
