"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  GATE_PASS_ISSUED: { label: "Gate Pass Sent", color: "bg-blue-100 text-blue-700" },
  VENDOR_ACKNOWLEDGED: { label: "Vendor Confirmed", color: "bg-cyan-100 text-cyan-700" },
  IN_TRANSIT: { label: "In Transit", color: "bg-orange-100 text-orange-700" },
  SCHEDULED: { label: "Scheduled", color: "bg-indigo-100 text-indigo-700" },
  DOCUMENTS_UPLOADED: { label: "Docs Uploaded", color: "bg-purple-100 text-purple-700" },
  RECONCILIATION_DONE: { label: "Reconciled", color: "bg-teal-100 text-teal-700" },
  INVOICE_GENERATED: { label: "Invoice Ready", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completed ✓", color: "bg-green-100 text-green-700" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };
  return <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.color}`}>{s.label}</span>;
}

const STEPS = [
  { key: "PENDING", label: "Documents Ready", icon: "description" },
  { key: "GATE_PASS_ISSUED", label: "Gate Pass Sent", icon: "send" },
  { key: "VENDOR_ACKNOWLEDGED", label: "Vendor Confirmed", icon: "verified" },
  { key: "DOCUMENTS_UPLOADED", label: "Compliance Docs", icon: "fact_check" },
  { key: "COMPLETED", label: "Completed", icon: "task_alt" },
];

const STEP_RANK: Record<string, number> = {
  PENDING: 0, GATE_PASS_ISSUED: 1, VENDOR_ACKNOWLEDGED: 2, IN_TRANSIT: 2,
  SCHEDULED: 2, DOCUMENTS_UPLOADED: 3, RECONCILIATION_DONE: 3, INVOICE_GENERATED: 3, COMPLETED: 4,
};

export default function ClientHandoverPage() {
  const { currentUser } = useApp();
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState<{ pickupId: string; pickup: any } | null>(null);
  const [form, setForm] = useState({ gatePassNumber: "", vehicleNumber: "", driverName: "", scheduledDate: "", pickupNotes: "" });
  const [gatePassFile, setGatePassFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingGatePass, setUploadingGatePass] = useState<string | null>(null);
  const [verifyingCompliance, setVerifyingCompliance] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPickups = useCallback(async () => {
    if (!currentUser?.companyId) return;
    try {
      const res = await api.get("/pickups");
      const all: any[] = res.data ?? [];
      const mine = all.filter(p => p.auction?.client?.id === currentUser.companyId);
      setPickups(mine);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [currentUser?.companyId]);

  useEffect(() => { fetchPickups(); }, [fetchPickups]);

  const openGatePassModal = (pickup: any) => {
    setForm({
      gatePassNumber: pickup.gatePassNumber || `GP-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
      vehicleNumber: pickup.vehicleNumber || pickup.vendorVehicleNumber || "",
      driverName: pickup.driverName || pickup.vendorDriverName || "",
      scheduledDate: pickup.scheduledDate
        ? new Date(pickup.scheduledDate).toISOString().split("T")[0]
        : pickup.vendorPreferredDate
        ? new Date(pickup.vendorPreferredDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      pickupNotes: pickup.pickupNotes || "",
    });
    setCreateModal({ pickupId: pickup.id, pickup });
  };

  const handleIssueGatePass = async () => {
    if (!createModal) return;
    if (!form.gatePassNumber.trim() || !form.scheduledDate) {
      showToast("Gate pass number and pickup date are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/pickups/${createModal.pickupId}/gate-pass`, form);
      // Upload gate pass document if provided
      if (gatePassFile) {
        const fd = new FormData();
        fd.append("file", gatePassFile);
        await api.post(`/pickups/${createModal.pickupId}/upload-gate-pass`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setCreateModal(null);
      setGatePassFile(null);
      showToast("Gate pass issued — vendor will be notified");
      fetchPickups();
    } catch { showToast("Failed to issue gate pass", "error"); }
    finally { setSubmitting(false); }
  };

  const handleUploadGatePassDoc = async (pickupId: string, file: File) => {
    setUploadingGatePass(pickupId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/pickups/${pickupId}/upload-gate-pass`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast("Gate pass document uploaded — vendor notified");
      fetchPickups();
    } catch { showToast("Upload failed", "error"); }
    finally { setUploadingGatePass(null); }
  };

  const handleVerifyCompliance = async (pickupId: string) => {
    setVerifyingCompliance(pickupId);
    try {
      await api.patch(`/pickups/${pickupId}/client-verify-compliance`);
      showToast("Compliance documents verified");
      fetchPickups();
    } catch { showToast("Verification failed", "error"); }
    finally { setVerifyingCompliance(null); }
  };

  const printGatePass = (pickup: any, clientName: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Gate Pass ${pickup.gatePassNumber}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{font-size:20px;color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px 12px;font-size:13px;border:1px solid #e5e7eb}td:first-child{font-weight:bold;background:#f8fafc;width:40%}.sig{margin-top:60px;display:flex;justify-content:space-between}.sig-box{border-top:1px solid #111;width:180px;text-align:center;padding-top:8px;font-size:11px}</style>
</head><body>
<h1>GATE PASS / MATERIAL HANDOVER DOCUMENT</h1>
<p style="color:#6b7280;font-size:12px">Issued by: ${clientName} &nbsp;|&nbsp; Date: ${new Date().toLocaleDateString("en-IN")}</p>
<table>
  <tr><td>Gate Pass No.</td><td>${pickup.gatePassNumber}</td></tr>
  <tr><td>Auction Ref</td><td>${pickup.auctionId}</td></tr>
  <tr><td>Material</td><td>${pickup.auction?.title}</td></tr>
  <tr><td>Assigned Vendor</td><td>${pickup.auction?.winner?.name ?? "—"}</td></tr>
  <tr><td>Pickup Date</td><td>${pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</td></tr>
  <tr><td>Vehicle Number</td><td>${pickup.vehicleNumber ?? "—"}</td></tr>
  <tr><td>Driver Name</td><td>${pickup.driverName ?? "—"}</td></tr>
  ${pickup.pickupNotes ? `<tr><td>Notes</td><td>${pickup.pickupNotes}</td></tr>` : ""}
</table>
<div class="sig">
  <div class="sig-box">Client Authorized Signatory</div>
  <div class="sig-box">Vendor Representative</div>
  <div class="sig-box">Security / Gate Officer</div>
</div>
<p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:40px">WeConnect E-Waste Aggregator Platform</p>
</body></html>`);
    w.document.close();
    w.print();
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Gate Pass & Handover</h1>
        <p className="text-sm text-slate-500 mt-1">Issue gate passes and coordinate material pickup for won auctions.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin block mb-2">progress_activity</span>
        </div>
      ) : pickups.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">inventory</span>
          <p className="font-bold">No handover records yet.</p>
          <p className="text-sm">Handover records appear after auction winner is approved and documents are generated.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {pickups.map(pickup => {
            const status = pickup.status as string;
            const stepRank = STEP_RANK[status] ?? 0;
            const hasGatePass = !!pickup.gatePassNumber;
            const complianceDocs: any[] = (pickup.pickupDocs ?? []).filter((d: any) =>
              ["FORM_6", "RECYCLING_CERTIFICATE", "DISPOSAL_CERTIFICATE", "EWASTE_RECYCLING_CERTIFICATE",
               "DATA_DESTRUCTION_CERTIFICATE", "EWAY_BILL", "DELIVERY_CHALLAN"].includes(d.type)
            );

            return (
              <div key={pickup.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{pickup.auction?.title}</p>
                    <p className="text-xs text-slate-500">Winner: {pickup.auction?.winner?.name ?? "—"} · {pickup.auction?.category}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                {/* Progress */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-0">
                    {STEPS.map((step, i) => (
                      <div key={step.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${i <= stepRank ? "bg-green-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                            <span className="material-symbols-outlined text-sm">{i < stepRank ? "check" : step.icon}</span>
                          </div>
                          <span className="text-[9px] font-bold mt-1 text-slate-400 text-center w-16">{step.label}</span>
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < stepRank ? "bg-green-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gate pass details */}
                {hasGatePass ? (
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Gate Pass", value: pickup.gatePassNumber },
                        { label: "Pickup Date", value: pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
                        { label: "Vehicle", value: pickup.vehicleNumber ?? "—" },
                        { label: "Driver", value: pickup.driverName ?? "—" },
                      ].map(f => (
                        <div key={f.label} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                          <p className="text-[9px] font-black text-slate-400 uppercase">{f.label}</p>
                          <p className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{f.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Gate pass document */}
                    <div className="mt-3 flex items-center gap-3">
                      {pickup.gatePassDocS3Key ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-xl text-xs">
                          <span className="material-symbols-outlined text-emerald-600 text-sm">description</span>
                          <span className="text-emerald-700 font-bold">{pickup.gatePassDocFileName ?? "Gate Pass Document"}</span>
                          <span className="text-emerald-500 text-[10px]">Uploaded ✓</span>
                        </div>
                      ) : (
                        <>
                          <input
                            id={`gp-doc-${pickup.id}`} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadGatePassDoc(pickup.id, f); e.target.value = ""; }}
                          />
                          <button
                            onClick={() => document.getElementById(`gp-doc-${pickup.id}`)?.click()}
                            disabled={uploadingGatePass === pickup.id}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">{uploadingGatePass === pickup.id ? "progress_activity" : "upload_file"}</span>
                            {uploadingGatePass === pickup.id ? "Uploading…" : "Upload Gate Pass Document"}
                          </button>
                          <span className="text-[10px] text-amber-600">Document not yet uploaded</span>
                        </>
                      )}
                    </div>
                    {pickup.vendorAcknowledgedAt && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm">
                        <span className="material-symbols-outlined text-base">verified</span>
                        Vendor acknowledged on {new Date(pickup.vendorAcknowledgedAt).toLocaleDateString("en-IN")}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Compliance docs from vendor */}
                {complianceDocs.length > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Compliance Documents from Vendor</p>
                      {pickup.clientVerifiedAt ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <span className="material-symbols-outlined text-sm">verified</span>
                          Verified by you on {new Date(pickup.clientVerifiedAt).toLocaleDateString("en-IN")}
                        </span>
                      ) : status === "DOCUMENTS_UPLOADED" && (
                        <button
                          onClick={() => handleVerifyCompliance(pickup.id)}
                          disabled={verifyingCompliance === pickup.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">{verifyingCompliance === pickup.id ? "progress_activity" : "verified_user"}</span>
                          {verifyingCompliance === pickup.id ? "Verifying…" : "Verify Compliance Docs"}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {complianceDocs.map((doc: any, i: number) => (
                        <a key={i} href={doc.signedUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                          <span className="material-symbols-outlined text-emerald-600 text-sm">description</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-emerald-700 truncate">{doc.fileName}</p>
                            <p className="text-[9px] text-emerald-600">{doc.type.replace(/_/g, " ")}</p>
                          </div>
                          <span className="material-symbols-outlined text-emerald-500 text-sm">download</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reconciliation & invoice info */}
                {(status === "RECONCILIATION_DONE" || status === "INVOICE_GENERATED" || status === "COMPLETED") && (
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-teal-50 dark:bg-teal-900/10">
                    <p className="text-[10px] font-black text-teal-600 uppercase mb-2">Final Reconciliation</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><p className="text-[9px] text-teal-500 uppercase font-bold">Final Weight</p><p className="font-bold">{pickup.finalWeight ?? "—"} kg</p></div>
                      <div><p className="text-[9px] text-teal-500 uppercase font-bold">Final Amount</p><p className="font-bold">₹{(pickup.finalAmount ?? 0).toLocaleString("en-IN")}</p></div>
                      <div><p className="text-[9px] text-teal-500 uppercase font-bold">Invoice</p><p className="font-bold">{pickup.invoiceNumber ?? "Pending"}</p></div>
                    </div>
                  </div>
                )}

                {/* Auction Documents (Work Order, Purchase Order, Agreement, Invoice) */}
                {(pickup.auctionDocs ?? []).length > 0 && (
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Auction Documents</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(pickup.auctionDocs as any[]).map((doc: any) => (
                        doc.signedUrl && (
                          <a key={doc.id} href={doc.signedUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition-colors">
                            <span className="material-symbols-outlined text-indigo-600 text-sm">description</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate">{doc.fileName}</p>
                              <p className="text-[9px] text-indigo-500">{doc.type.replace(/_/g, " ")}</p>
                            </div>
                            <span className="material-symbols-outlined text-indigo-400 text-sm">download</span>
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {status === "COMPLETED" && (
                  <div className="px-6 py-4 bg-green-50 dark:bg-green-900/10">
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="material-symbols-outlined">task_alt</span>
                      <p className="text-sm font-black">Project Complete — Material successfully recycled.</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 px-6 pb-5 pt-3">
                  {!hasGatePass ? (
                    <button onClick={() => openGatePassModal(pickup)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                      <span className="material-symbols-outlined text-base">send</span>
                      Issue Gate Pass
                    </button>
                  ) : (
                    <button onClick={() => openGatePassModal(pickup)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                      <span className="material-symbols-outlined text-base">edit</span>
                      Edit Gate Pass
                    </button>
                  )}
                  {hasGatePass && (
                    <button onClick={() => printGatePass(pickup, currentUser.name)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                      <span className="material-symbols-outlined text-base">print</span>
                      Print Gate Pass
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gate Pass Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-black text-slate-900 dark:text-white">Issue Gate Pass</h2>
              <button onClick={() => setCreateModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 rounded-xl px-3 py-2">
                <strong>Auction:</strong> {createModal.pickup.auction?.title}  ·  <strong>Vendor:</strong> {createModal.pickup.auction?.winner?.name}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Gate Pass Number *</label>
                  <input type="text" value={form.gatePassNumber}
                    onChange={e => setForm(p => ({ ...p, gatePassNumber: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pickup Date *</label>
                  <input type="date" value={form.scheduledDate}
                    onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle Number</label>
                  <input type="text" placeholder="e.g. KA-01-AB-1234" value={form.vehicleNumber}
                    onChange={e => setForm(p => ({ ...p, vehicleNumber: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Driver Name</label>
                  <input type="text" placeholder="Full name" value={form.driverName}
                    onChange={e => setForm(p => ({ ...p, driverName: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Special Instructions</label>
                <textarea rows={2} value={form.pickupNotes}
                  onChange={e => setForm(p => ({ ...p, pickupNotes: e.target.value }))}
                  placeholder="Any special instructions for the vendor..."
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Gate Pass Document <span className="text-slate-400 font-normal">(PDF or image — vendor will download this)</span></label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 transition-colors ${gatePassFile ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-200 dark:border-slate-700"}`}
                  onClick={() => document.getElementById("modal-gate-pass-file")?.click()}
                >
                  <input id="modal-gate-pass-file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => setGatePassFile(e.target.files?.[0] ?? null)} />
                  {gatePassFile ? (
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{gatePassFile.name}</p>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-2xl text-slate-300 block mb-1">upload_file</span>
                      <p className="text-xs text-slate-500">Click to attach gate pass PDF / scanned copy</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setCreateModal(null); setGatePassFile(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={handleIssueGatePass} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">send</span>
                {submitting ? "Issuing…" : "Issue Gate Pass"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
