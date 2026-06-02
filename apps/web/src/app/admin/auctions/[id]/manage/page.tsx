"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

const fmtINR = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const PHASE_STEPS = [
  { key: "docs", icon: "description", label: "Phase 6: PO & Documents" },
  { key: "payment", icon: "payments", label: "Phase 6: Payment Security" },
  { key: "gatepass", icon: "local_shipping", label: "Phase 7: Gate Pass & Pickup" },
  { key: "compliance", icon: "fact_check", label: "Phase 9: Compliance Docs" },
  { key: "reconciliation", icon: "balance", label: "Phase 8: Reconciliation" },
  { key: "invoice", icon: "receipt_long", label: "Phase 10: Invoice & Closure" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    GATE_PASS_ISSUED: "bg-blue-100 text-blue-700",
    VENDOR_ACKNOWLEDGED: "bg-cyan-100 text-cyan-700",
    IN_TRANSIT: "bg-orange-100 text-orange-700",
    SCHEDULED: "bg-indigo-100 text-indigo-700",
    DOCUMENTS_UPLOADED: "bg-purple-100 text-purple-700",
    RECONCILIATION_DONE: "bg-teal-100 text-teal-700",
    INVOICE_GENERATED: "bg-emerald-100 text-emerald-700",
    COMPLETED: "bg-green-100 text-green-700",
    SUBMITTED: "bg-blue-100 text-blue-700",
    CONFIRMED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60">
        <span className="material-symbols-outlined text-purple-600 text-base">{icon}</span>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DocRow({ doc, onDownload }: { doc: any; onDownload: (key: string, bucket: string, name: string) => void }) {
  const typeColors: Record<string, string> = {
    PURCHASE_ORDER: "bg-green-100 text-green-700",
    WORK_ORDER: "bg-blue-100 text-blue-700",
    AGREEMENT: "bg-purple-100 text-purple-700",
    INVOICE: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-slate-400 text-base">description</span>
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{doc.fileName}</p>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${typeColors[doc.type] ?? "bg-slate-100 text-slate-600"}`}>
            {doc.type.replace(/_/g, " ")}
          </span>
        </div>
      </div>
      <button onClick={() => onDownload(doc.s3Key, doc.s3Bucket, doc.fileName)}
        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
        <span className="material-symbols-outlined text-sm">download</span>Download
      </button>
    </div>
  );
}

export default function AdminManageAuction() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [pickup, setPickup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [reconcileForm, setReconcileForm] = useState({ finalWeight: "", finalAmount: "", notes: "" });
  const [showReconcile, setShowReconcile] = useState(false);
  const [ratingForm, setRatingForm] = useState({ score: 5, comment: "" });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [auctionRes, pickupRes] = await Promise.all([
        api.get(`/auctions/${auctionId}/post-auction`),
        api.get(`/pickups/by-auction/${auctionId}`).catch(() => ({ data: null })),
      ]);
      setData(auctionRes.data);
      setPickup(pickupRes.data);
    } catch {
      showToast("Failed to load auction data", "error");
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadDoc = async (s3Key: string, bucket: string, fileName: string) => {
    try {
      const res = await api.get(`/companies/signed-url?s3Key=${encodeURIComponent(s3Key)}&s3Bucket=${encodeURIComponent(bucket)}`);
      const url = res.data?.url || res.data?.signedUrl || res.data;
      if (typeof url === "string") {
        window.open(url, "_blank");
      } else {
        showToast("Could not get download link", "error");
      }
    } catch {
      showToast("Download failed — try again", "error");
    }
  };

  const action = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      await fn();
      await fetchData();
      showToast(`${label} completed successfully`);
    } catch (e: any) {
      showToast(e?.response?.data?.message || `${label} failed`, "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return (
    <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
      <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
      <p className="text-sm font-bold">Loading auction data…</p>
    </div>
  );

  if (!data) return (
    <div className="p-20 text-center text-slate-400">
      <span className="material-symbols-outlined text-4xl block mb-2">error_outline</span>
      <p className="font-bold">Auction not found</p>
      <button onClick={() => router.push("/admin/auctions")} className="mt-3 text-xs text-purple-600 underline">Back</button>
    </div>
  );

  const winningBid = data.bids?.[0];
  const winningAmount = winningBid?.amount ?? data.basePrice ?? 0;
  const vendorName = data.winner?.name ?? "—";
  const clientName = data.client?.name ?? "—";
  const hasPickup = !!pickup;
  const pickupStatus = pickup?.status ?? "PENDING";
  const paymentStatus = data.payment?.status ?? "PENDING";
  const auctionDocs: any[] = data.auctionDocs ?? [];
  const pickupDocs: any[] = pickup?.pickupDocs ?? [];
  const ratings: any[] = data.ratings ?? [];

  const hasPO = auctionDocs.some((d: any) => d.type === "PURCHASE_ORDER");
  const hasAgreement = auctionDocs.some((d: any) => d.type === "AGREEMENT");
  const hasGatePass = !!pickup?.gatePassNumber;
  const hasReconciliation = pickupStatus === "RECONCILIATION_DONE" || pickupStatus === "INVOICE_GENERATED" || pickupStatus === "COMPLETED";
  const hasInvoice = !!pickup?.invoiceNumber;
  const complianceDocs = pickupDocs.filter((d: any) =>
    ["FORM_6", "RECYCLING_CERTIFICATE", "DISPOSAL_CERTIFICATE", "EWASTE_RECYCLING_CERTIFICATE",
     "DATA_DESTRUCTION_CERTIFICATE", "EWAY_BILL", "E_WASTE_MANIFEST"].includes(d.type)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold text-white transition-all ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b-2 border-purple-500 shadow-sm">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/admin/auctions")}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </button>
          <div className="flex-1">
            <p className="font-black text-slate-900 dark:text-white text-sm">{data.title}</p>
            <p className="text-[10px] text-slate-500">Post-Auction Management · {data.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase">Winning Amount</p>
              <p className="font-mono font-black text-base text-emerald-600">{fmtINR(winningAmount)}</p>
            </div>
            <StatusBadge status={pickupStatus} />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-5 space-y-5">
        {!data.winnerId && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <span className="material-symbols-outlined text-amber-600 text-3xl">warning</span>
            <div className="flex-1">
              <p className="text-amber-900 dark:text-amber-200 font-black text-sm uppercase tracking-widest">Winner Selection Pending</p>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-1 font-bold">A winner must be approved before you can generate documents or proceed with the post-auction flow.</p>
            </div>
            <button 
              onClick={() => router.push(`/admin/auctions/${auctionId}/live`)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-amber-200 dark:shadow-none"
            >
              Go to Selection Page
            </button>
          </div>
        )}

        {/* Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Client", value: clientName, icon: "business", color: "text-blue-700" },
            { label: "Winner (Vendor)", value: vendorName, icon: "store", color: "text-emerald-700" },
            { label: "Winning Bid", value: fmtINR(winningAmount), icon: "gavel", color: "text-purple-700" },
            { label: "Payment", value: paymentStatus.replace(/_/g, " "), icon: "payments", color: paymentStatus === "CONFIRMED" ? "text-emerald-700" : "text-amber-700" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-slate-400 text-base">{s.icon}</span>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              </div>
              <p className={`font-bold text-sm truncate ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Phase 6a: Documents */}
        <Section title="Phase 6 — Purchase Order, Work Order & Agreement" icon="description">
          <div className="space-y-3">
            {auctionDocs.length > 0 ? (
              <div>{auctionDocs.map((doc: any, i: number) => (
                <DocRow key={i} doc={doc} onDownload={downloadDoc} />
              ))}</div>
            ) : (
              <p className="text-sm text-slate-500">No documents generated yet.</p>
            )}
            {(!hasPO || !hasAgreement) && (
              <button
                onClick={() => action("Generate Documents", () => api.post(`/auctions/${auctionId}/generate-docs`))}
                disabled={busy === "Generate Documents" || !data.winnerId}
                className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 transition-all"
              >
                <span className="material-symbols-outlined text-sm">{busy === "Generate Documents" ? "progress_activity" : "auto_awesome"}</span>
                {busy === "Generate Documents" ? "Generating…" : "Generate PO, Work Order & Agreement"}
              </button>
            )}
          </div>
        </Section>

        {/* Phase 6b: Payment */}
        <Section title="Phase 6 — Payment Security" icon="payments">
          {data.payment ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Material Value", value: fmtINR(data.payment.clientAmount) },
                  { label: "Platform Fee (5%)", value: fmtINR(data.payment.commissionAmount) },
                  { label: "Total Payable", value: fmtINR(data.payment.totalAmount) },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase">{s.label}</p>
                    <p className="font-mono font-bold text-base mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={paymentStatus} />
                {data.payment.utrNumber && <span className="text-xs text-slate-500 font-mono">UTR: {data.payment.utrNumber}</span>}
              </div>
              {paymentStatus === "SUBMITTED" && (
                <button
                  onClick={() => action("Verify Payment", () => api.patch(`/payments/auction/${auctionId}/confirm`))}
                  disabled={!!busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">{busy === "Verify Payment" ? "progress_activity" : "verified"}</span>
                  {busy === "Verify Payment" ? "Verifying…" : "Verify & Confirm Payment"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Payment record will be created after generating documents.</p>
          )}
        </Section>

        {/* Phase 7: Gate Pass & Pickup */}
        <Section title="Phase 7 — Pickup & Material Handover" icon="local_shipping">
          <div className="space-y-3">
            {hasPickup ? (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={pickupStatus} />
                  {pickup.gatePassNumber && <span className="text-xs font-mono bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded-lg">Gate Pass: {pickup.gatePassNumber}</span>}
                  {pickup.scheduledDate && <span className="text-xs text-slate-500">Pickup: {fmtDate(pickup.scheduledDate)}</span>}
                </div>

                {(pickup.vehicleNumber || pickup.vendorVehicleNumber) && (
                  <div className="space-y-2">
                    {pickup.vehicleNumber && (
                      <>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Client Gate Pass — Logistics</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Vehicle (Client)</p>
                            <p className="font-bold text-sm mt-0.5">{pickup.vehicleNumber}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Driver (Client)</p>
                            <p className="font-bold text-sm mt-0.5">{pickup.driverName ?? "—"}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Vendor Acknowledged</p>
                            <p className="font-bold text-sm mt-0.5">{pickup.vendorAcknowledgedAt ? fmtDate(pickup.vendorAcknowledgedAt) : "Pending"}</p>
                          </div>
                        </div>
                      </>
                    )}
                    {pickup.vendorVehicleNumber && (
                      <>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-2">Vendor — Planned Logistics</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                            <p className="text-[9px] font-black text-blue-400 uppercase">Vehicle (Vendor)</p>
                            <p className="font-bold text-sm mt-0.5">{pickup.vendorVehicleNumber}</p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                            <p className="text-[9px] font-black text-blue-400 uppercase">Driver (Vendor)</p>
                            <p className="font-bold text-sm mt-0.5">{pickup.vendorDriverName ?? "—"}</p>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                            <p className="text-[9px] font-black text-blue-400 uppercase">Preferred Date (Vendor)</p>
                            <p className="font-bold text-sm mt-0.5">{pickup.vendorPreferredDate ? fmtDate(pickup.vendorPreferredDate) : "—"}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Handover docs uploaded by vendor */}
                {pickupDocs.filter((d: any) => ["DELIVERY_CHALLAN", "ASSET_HANDOVER_FORM", "WEIGHT_SLIP_EMPTY", "WEIGHT_SLIP_LOADED", "MATERIAL_ACKNOWLEDGEMENT"].includes(d.type)).length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Handover Documents</p>
                    {pickupDocs.filter((d: any) => ["DELIVERY_CHALLAN", "ASSET_HANDOVER_FORM", "WEIGHT_SLIP_EMPTY", "WEIGHT_SLIP_LOADED", "MATERIAL_ACKNOWLEDGEMENT"].includes(d.type)).map((doc: any, i: number) => (
                      <DocRow key={i} doc={doc} onDownload={(k, b, n) => window.open(doc.signedUrl, "_blank")} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">Pickup record will be created after generating documents.</p>
            )}
          </div>
        </Section>

        {/* Phase 9: Compliance Documents */}
        <Section title="Phase 9 — Compliance & Documentation" icon="fact_check">
          <div className="space-y-3">
            {complianceDocs.length > 0 ? (
              <>
                {pickup?.clientVerifiedAt && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Client verified on {fmtDate(pickup.clientVerifiedAt)}
                  </div>
                )}
                <div>{complianceDocs.map((doc: any, i: number) => (
                  <DocRow key={i} doc={doc} onDownload={(k, b, n) => window.open(doc.signedUrl, "_blank")} />
                ))}</div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-4xl block mb-2">upload_file</span>
                <p className="text-sm font-bold">Waiting for vendor to upload compliance documents</p>
                <p className="text-xs">Recycling cert, disposal cert, Form 6, e-way bill, etc.</p>
              </div>
            )}
          </div>
        </Section>

        {/* Phase 8: Reconciliation */}
        <Section title="Phase 8 — Final Reconciliation" icon="balance">
          {hasReconciliation ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Final Weight", value: `${pickup.finalWeight ?? "—"} kg` },
                  { label: "Final Amount", value: fmtINR(pickup.finalAmount ?? 0) },
                  { label: "Status", value: pickupStatus.replace(/_/g, " ") },
                ].map(s => (
                  <div key={s.label} className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3">
                    <p className="text-[9px] font-black text-teal-600 uppercase">{s.label}</p>
                    <p className="font-bold text-sm mt-0.5 text-teal-800 dark:text-teal-200">{s.value}</p>
                  </div>
                ))}
              </div>
              {pickup.reconciliationNotes && (
                <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">{pickup.reconciliationNotes}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Record final verified weight and amount after material pickup.</p>
              {hasPickup && !showReconcile && (
                <button onClick={() => setShowReconcile(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-widest transition-all">
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  Enter Reconciliation
                </button>
              )}
              {showReconcile && (
                <div className="space-y-3 p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Final Weight (kg) *</label>
                      <input type="number" value={reconcileForm.finalWeight}
                        onChange={e => setReconcileForm(p => ({ ...p, finalWeight: e.target.value }))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Final Amount (₹) *</label>
                      <input type="number" value={reconcileForm.finalAmount}
                        onChange={e => setReconcileForm(p => ({ ...p, finalAmount: e.target.value }))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks</label>
                    <textarea rows={2} value={reconcileForm.notes}
                      onChange={e => setReconcileForm(p => ({ ...p, notes: e.target.value }))}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-teal-500 outline-none resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowReconcile(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                    <button
                      onClick={() => {
                        if (!reconcileForm.finalWeight || !reconcileForm.finalAmount) { showToast("Please enter weight and amount", "error"); return; }
                        action("Reconcile", () => api.post(`/pickups/${pickup.id}/reconcile`, {
                          finalWeight: parseFloat(reconcileForm.finalWeight),
                          finalAmount: parseFloat(reconcileForm.finalAmount),
                          reconciliationNotes: reconcileForm.notes,
                        })).then(() => setShowReconcile(false));
                      }}
                      disabled={!!busy}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm disabled:opacity-50 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">{busy === "Reconcile" ? "progress_activity" : "save"}</span>
                      {busy === "Reconcile" ? "Saving…" : "Save Reconciliation"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Phase 10: Invoice & Closure */}
        <Section title="Phase 10 — Invoice, Payment Release & Completion" icon="receipt_long">
          <div className="space-y-4">
            {/* Invoice */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Invoice</p>
              {hasInvoice ? (
                <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-xl">
                  <span className="material-symbols-outlined text-amber-600">receipt_long</span>
                  <div>
                    <p className="text-sm font-bold text-amber-800">Invoice: {pickup.invoiceNumber}</p>
                    <p className="text-[10px] text-amber-600">{fmtDate(pickup.invoiceGeneratedAt)}</p>
                  </div>
                </div>
              ) : hasReconciliation && (
                <button
                  onClick={() => action("Generate Invoice", () => api.post(`/pickups/${pickup.id}/generate-invoice`))}
                  disabled={!!busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">{busy === "Generate Invoice" ? "progress_activity" : "receipt_long"}</span>
                  {busy === "Generate Invoice" ? "Generating…" : "Generate Invoice"}
                </button>
              )}
            </div>

            {/* Payment Release */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Payment Release</p>
              {pickupStatus === "COMPLETED" ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700">
                  <span className="material-symbols-outlined">check_circle</span>
                  <p className="text-sm font-bold">Payment Released — Project Completed</p>
                </div>
              ) : (hasInvoice && paymentStatus === "CONFIRMED") && (
                <button
                  onClick={() => action("Release Payment", () => api.patch(`/admin/pickups/${pickup?.id}/release-payment`))}
                  disabled={!!busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest disabled:opacity-50 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">{busy === "Release Payment" ? "progress_activity" : "check_circle"}</span>
                  {busy === "Release Payment" ? "Processing…" : "Release Final Payment & Complete"}
                </button>
              )}
            </div>

            {/* Ratings */}
            {pickupStatus === "COMPLETED" && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Feedback & Ratings Collected</p>
                {ratings.length > 0 ? (
                  <div className="space-y-2">
                    {ratings.map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} className={`text-sm ${s <= r.score ? "text-amber-400" : "text-slate-300"}`}>★</span>
                          ))}
                        </div>
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-bold uppercase">{r.type.replace(/_/g, " → ")}</span>
                        {r.comment && <p className="text-xs text-slate-500 flex-1">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No ratings submitted yet.</p>
                )}
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
