"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

const COMPLIANCE_DOC_TYPES = [
  { type: "FORM_6", label: "Form 6 / Manifest", icon: "article" },
  { type: "RECYCLING_CERTIFICATE", label: "Recycling Certificate", icon: "recycling" },
  { type: "DISPOSAL_CERTIFICATE", label: "Disposal Certificate", icon: "delete_forever" },
  { type: "EWASTE_RECYCLING_CERTIFICATE", label: "E-Waste Recycling Certificate", icon: "eco" },
  { type: "DATA_DESTRUCTION_CERTIFICATE", label: "Data Destruction Certificate", icon: "security" },
  { type: "EWAY_BILL", label: "E-Way Bill", icon: "local_shipping" },
  { type: "DELIVERY_CHALLAN", label: "Delivery Challan", icon: "receipt" },
  { type: "WEIGHT_SLIP_EMPTY", label: "Weight Slip (Empty)", icon: "scale" },
  { type: "WEIGHT_SLIP_LOADED", label: "Weight Slip (Loaded)", icon: "scale" },
  { type: "MATERIAL_ACKNOWLEDGEMENT", label: "Material Acknowledgement", icon: "assignment_turned_in" },
  { type: "ASSET_HANDOVER_FORM", label: "Asset Handover Form", icon: "handshake" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  GATE_PASS_ISSUED: { label: "Gate Pass Issued", color: "bg-blue-100 text-blue-700" },
  VENDOR_ACKNOWLEDGED: { label: "Acknowledged", color: "bg-cyan-100 text-cyan-700" },
  IN_TRANSIT: { label: "In Transit", color: "bg-orange-100 text-orange-700" },
  SCHEDULED: { label: "Scheduled", color: "bg-indigo-100 text-indigo-700" },
  DOCUMENTS_UPLOADED: { label: "Docs Uploaded", color: "bg-purple-100 text-purple-700" },
  RECONCILIATION_DONE: { label: "Reconciled", color: "bg-teal-100 text-teal-700" },
  INVOICE_GENERATED: { label: "Invoice Ready", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700" },
};

function GatePassDocDownload({ pickup }: { pickup: any }) {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/companies/signed-url?s3Key=${encodeURIComponent(pickup.gatePassDocS3Key)}&s3Bucket=${encodeURIComponent(pickup.gatePassDocBucket)}`
      );
      const url = res.data?.url || res.data?.signedUrl || res.data;
      if (typeof url === "string") window.open(url, "_blank");
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };
  return (
    <button onClick={download} disabled={loading}
      className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
      <span className="material-symbols-outlined text-sm">{loading ? "progress_activity" : "download"}</span>
      {loading ? "Preparing…" : `Download Gate Pass Document — ${pickup.gatePassDocFileName ?? "gate_pass.pdf"}`}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };
  return <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.color}`}>{s.label}</span>;
}

function printGatePass(pickup: any, vendorName: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Gate Pass ${pickup.gatePassNumber}</title>
<style>
  body{font-family:Arial,sans-serif;padding:40px;color:#111}
  h1{font-size:20px;color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:12px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  td{padding:8px 12px;font-size:13px;border:1px solid #e5e7eb}
  td:first-child{font-weight:bold;background:#f8fafc;width:40%}
  .sig{margin-top:60px;display:flex;justify-content:space-between}
  .sig-box{border-top:1px solid #111;width:180px;text-align:center;padding-top:8px;font-size:11px}
</style></head><body>
<h1>GATE PASS / HANDOVER DOCUMENT</h1>
<table>
  <tr><td>Gate Pass No.</td><td>${pickup.gatePassNumber}</td></tr>
  <tr><td>Pickup Date</td><td>${pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</td></tr>
  <tr><td>Vendor</td><td>${vendorName}</td></tr>
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
}

export default function VendorHandoverPage() {
  const { currentUser } = useApp();
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPickups = useCallback(async () => {
    if (!currentUser?.companyId) return;
    try {
      const res = await api.get("/pickups");
      const all: any[] = res.data ?? [];
      const mine = all.filter(p => p.auction?.winner?.id === currentUser.companyId);
      setPickups(mine);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [currentUser?.companyId]);

  useEffect(() => { fetchPickups(); }, [fetchPickups]);

  const acknowledge = async (pickupId: string) => {
    setBusy(pickupId + "_ack");
    try {
      await api.patch(`/pickups/${pickupId}/vendor-acknowledge`);
      showToast("Pickup acknowledged successfully");
      fetchPickups();
    } catch { showToast("Failed to acknowledge", "error"); }
    finally { setBusy(null); }
  };

  const uploadDoc = async (pickupId: string, file: File, docType: string) => {
    setUploading(pickupId + "_" + docType);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/pickups/${pickupId}/upload-doc?type=${docType}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast(`${docType.replace(/_/g, " ")} uploaded successfully`);
      fetchPickups();
    } catch { showToast("Upload failed", "error"); }
    finally { setUploading(null); }
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
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Handover & Compliance</h1>
        <p className="text-sm text-slate-500 mt-1">Gate pass, pickup coordination, and compliance document submission.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin block mb-2">progress_activity</span>
        </div>
      ) : pickups.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">inventory</span>
          <p className="font-bold">No pickups yet.</p>
          <p className="text-sm">Pickup details will appear here once you win an auction and a gate pass is issued.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pickups.map(pickup => {
            const status = pickup.status as string;
            const hasGatePass = !!pickup.gatePassNumber;
            const docs: any[] = pickup.pickupDocs ?? [];
            const uploadedTypes = new Set(docs.map((d: any) => d.type));
            const isExpanded = expandedId === pickup.id;

            return (
              <div key={pickup.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                {/* Header (Interactive Trigger) */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : pickup.id)}
                  className="flex items-center justify-between px-6 py-5 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-headline font-bold text-lg text-slate-900 dark:text-white truncate">{pickup.auction?.title}</p>
                    <p className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                      <span>{pickup.auction?.category}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">ID: {pickup.auctionId.substring(0, 8)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={status} />
                    <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 animate-fade-in">
                    {/* Gate Pass Section */}
                    {hasGatePass ? (
                      <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-3">Gate Pass Details</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: "Gate Pass No.", value: pickup.gatePassNumber },
                            { label: "Pickup Date", value: pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
                            { label: "Vehicle (Client)", value: pickup.vehicleNumber ?? "—" },
                            { label: "Driver (Client)", value: pickup.driverName ?? "—" },
                          ].map(f => (
                            <div key={f.label} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-blue-100 dark:border-blue-900/20">
                              <p className="text-[9px] font-black text-blue-500 uppercase">{f.label}</p>
                              <p className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{f.value}</p>
                            </div>
                          ))}
                        </div>
                        {pickup.pickupNotes && (
                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 italic">{pickup.pickupNotes}</p>
                        )}

                        {/* Gate pass document from client */}
                        <div className="mt-3">
                          {pickup.gatePassDocS3Key ? (
                            <GatePassDocDownload pickup={pickup} />
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-xl text-xs">
                              <span className="material-symbols-outlined text-amber-500 text-sm">hourglass_empty</span>
                              <span className="text-amber-700 font-bold">Gate pass document not yet uploaded by client</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button onClick={() => printGatePass(pickup, currentUser.name)}
                            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-sm">print</span>Print Gate Pass
                          </button>
                          {status === "GATE_PASS_ISSUED" && !pickup.vendorAcknowledgedAt && (
                            <button onClick={() => acknowledge(pickup.id)} disabled={busy === pickup.id + "_ack"}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50">
                              <span className="material-symbols-outlined text-sm">{busy === pickup.id + "_ack" ? "progress_activity" : "check_circle"}</span>
                              {busy === pickup.id + "_ack" ? "…" : "Acknowledge Gate Pass"}
                            </button>
                          )}
                          {pickup.vendorAcknowledgedAt && (
                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">verified</span>Acknowledged
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-sm text-slate-500 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">hourglass_empty</span>
                        Waiting for client to issue gate pass. You will receive an email once it's ready.
                      </div>
                    )}

                    {/* Compliance Document Upload */}
                    <div className="px-6 py-5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Compliance & Handover Documents</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {COMPLIANCE_DOC_TYPES.map(docDef => {
                          const isUploaded = uploadedTypes.has(docDef.type);
                          const uploadedDoc = docs.find((d: any) => d.type === docDef.type);
                          const busyKey = pickup.id + "_" + docDef.type;
                          return (
                            <div key={docDef.type} className={`flex items-center gap-3 p-3 rounded-xl border ${isUploaded ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800" : "bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700"}`}>
                              <span className={`material-symbols-outlined text-base ${isUploaded ? "text-green-600" : "text-slate-400"}`}>{isUploaded ? "check_circle" : docDef.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${isUploaded ? "text-green-700 dark:text-green-400" : "text-slate-700 dark:text-slate-300"}`}>{docDef.label}</p>
                                {isUploaded ? (
                                  <p className="text-[10px] text-green-600 truncate">{uploadedDoc?.fileName} · <span className="font-bold">Uploaded ✓</span></p>
                                ) : null}
                              </div>
                              {isUploaded ? (
                                <a href={uploadedDoc?.signedUrl} target="_blank" rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors" title="View uploaded file">
                                  <span className="material-symbols-outlined text-sm">visibility</span>
                                </a>
                              ) : (
                                <>
                                  <input
                                    type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                                    ref={el => { fileRefs.current[busyKey] = el; }}
                                    className="hidden"
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) uploadDoc(pickup.id, file, docDef.type);
                                      e.target.value = "";
                                    }}
                                  />
                                  <button onClick={() => fileRefs.current[busyKey]?.click()}
                                    disabled={uploading === busyKey}
                                    className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50">
                                    <span className="material-symbols-outlined text-sm">{uploading === busyKey ? "progress_activity" : "upload"}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {docs.length > 0 && (
                        <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                          <span className="material-symbols-outlined text-emerald-600 text-base mt-0.5">cloud_done</span>
                          <div>
                            <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                              {docs.length} document{docs.length !== 1 ? "s" : ""} submitted
                            </p>
                            <p className="text-[10px] text-emerald-600 mt-0.5">
                              Visible to client and admin for review. Upload remaining documents if any are still pending.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Auction Documents (Work Order, Purchase Order, Agreement, Invoice) */}
                    {(pickup.auctionDocs ?? []).length > 0 && (
                      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
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

                    {/* Reconciliation info */}
                    {(status === "RECONCILIATION_DONE" || status === "INVOICE_GENERATED" || status === "COMPLETED") && (
                      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-teal-50 dark:bg-teal-900/10">
                        <p className="text-[10px] font-black text-teal-600 uppercase mb-2">Reconciliation</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div><p className="text-[9px] text-teal-500 uppercase font-bold">Final Weight</p><p className="font-bold text-sm">{pickup.finalWeight ?? "—"} kg</p></div>
                          <div><p className="text-[9px] text-teal-500 uppercase font-bold">Final Amount</p><p className="font-bold text-sm">₹{(pickup.finalAmount ?? 0).toLocaleString("en-IN")}</p></div>
                          <div><p className="text-[9px] text-teal-500 uppercase font-bold">Invoice No.</p><p className="font-bold text-sm">{pickup.invoiceNumber ?? "Pending"}</p></div>
                        </div>
                        {pickup.reconciliationNotes && <p className="mt-2 text-sm text-teal-700">{pickup.reconciliationNotes}</p>}
                      </div>
                    )}

                    {status === "COMPLETED" && (
                      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-green-50 dark:bg-green-900/10">
                        <div className="flex items-center gap-2 text-green-700">
                          <span className="material-symbols-outlined">task_alt</span>
                          <p className="text-sm font-black">Project Completed — Thank you for completing this e-waste recycling job!</p>
                        </div>
                      </div>
                    )}
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
