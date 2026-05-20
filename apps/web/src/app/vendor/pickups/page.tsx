"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function VendorPickups() {
  const { currentUser } = useApp();
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);

  const [uploadingDocId, setUploadingId] = useState<{pickupId: string, docType: string} | null>(null);

  const fetchPickups = async () => {
    try {
      setLoading(true);
      const res = await api.get("/pickups");
      // Filter for current vendor
      const myPickups = res.data.filter((p: any) => p.auction?.winnerId === currentUser?.companyId);
      setPickups(myPickups);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to load pickups.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.companyId) {
      fetchPickups();
    }
  }, [currentUser?.companyId]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDocUpload = async (pickupId: string, endpoint: string, typeParam: string | null, file: File) => {
    try {
      setUploadingId({ pickupId, docType: typeParam || endpoint });
      const fd = new FormData();
      fd.append("file", file);
      
      const url = typeParam ? `/pickups/${pickupId}/${endpoint}?type=${typeParam}` : `/pickups/${pickupId}/${endpoint}`;
      
      await api.post(url, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      showToast("Document uploaded successfully.");
      fetchPickups();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to upload document.", "error");
    } finally {
      setUploadingId(null);
    }
  };

  const triggerUpload = (pickupId: string, endpoint: string, typeParam: string | null) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        handleDocUpload(pickupId, endpoint, typeParam, file);
      }
    };
    input.click();
  };

  const DOC_TYPES = [
    { key: "FORM_6", label: "Form 6", endpoint: "upload-form6", typeParam: null, required: true },
    { key: "WEIGHT_SLIP_EMPTY", label: "Empty Weight Slip", endpoint: "upload-weight-slip", typeParam: "empty", required: true },
    { key: "WEIGHT_SLIP_LOADED", label: "Loaded Weight Slip", endpoint: "upload-weight-slip", typeParam: "loaded", required: true },
    { key: "RECYCLING_CERTIFICATE", label: "Recycling Certificate", endpoint: "upload-compliance", typeParam: "recycling", required: true },
    { key: "DISPOSAL_CERTIFICATE", label: "Disposal Certificate", endpoint: "upload-compliance", typeParam: "disposal", required: false },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 relative px-4 sm:px-6 lg:px-8">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-xl z-50 text-white font-bold text-sm ${toast.type === "success" ? "bg-[#1E8E3E]" : "bg-red-600"}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Logistics & Compliance</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Manage assigned pickups and upload compliance documents.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pickups.length === 0 ? (
        <div className="card p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-200 block mb-4">local_shipping</span>
          <h3 className="text-xl font-headline font-bold text-[color:var(--color-on-surface)] mb-2">No Pickups Assigned</h3>
          <p className="text-[color:var(--color-on-surface-variant)]">Win bids and confirm payments to unlock pickups.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pickups.map(pickup => {
            const auction = pickup.auction;
            const client = auction?.client;
            
            const uploadedTypes = pickup.pickupDocs?.map((d: any) => d.type) || [];
            const requiredCount = DOC_TYPES.filter(d => d.required).length;
            const completedRequired = DOC_TYPES.filter(d => d.required && uploadedTypes.includes(d.key)).length;
            const isAllRequiredUploaded = completedRequired === requiredCount;

            let statusColor = "bg-amber-100 text-amber-800";
            if (pickup.status === "DOCUMENTS_UPLOADED") statusColor = "bg-blue-100 text-blue-800";
            if (pickup.status === "COMPLETED") statusColor = "bg-emerald-100 text-emerald-800";

            return (
              <div key={pickup.id} className="card p-0 overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">REQ: {auction?.id.substring(0,8)}</span>
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${statusColor}`}>{pickup.status.replace(/_/g, " ")}</span>
                    </div>
                    <h3 className="font-headline font-bold text-[color:var(--color-on-surface)] text-lg leading-tight">{auction?.title}</h3>
                    <p className="text-sm text-[color:var(--color-on-surface-variant)] mt-0.5">{client?.name}</p>
                    
                    {pickup.scheduledDate && (
                      <p className="text-xs text-slate-500 mt-2 font-medium">
                        <span className="material-symbols-outlined text-sm align-middle mr-1">event</span>
                        Scheduled: {new Date(pickup.scheduledDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {pickup.status === "COMPLETED" && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50">
                      <span className="material-symbols-outlined">verified</span>
                      <span className="text-sm font-bold">Compliance Verified</span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Document Checklist</h4>
                    <span className="text-xs font-bold text-slate-400">{completedRequired} / {requiredCount} Required Uploaded</span>
                  </div>

                  <div className="space-y-3">
                    {DOC_TYPES.map(doc => {
                      const isUploaded = uploadedTypes.includes(doc.key);
                      const uploadedDoc = pickup.pickupDocs?.find((d: any) => d.type === doc.key);
                      const isUploading = uploadingDocId?.pickupId === pickup.id && uploadingDocId?.docType === (doc.typeParam || doc.endpoint);

                      return (
                        <div key={doc.key} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-xl transition-colors ${isUploaded ? "bg-emerald-50/30 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/50" : "bg-[color:var(--color-surface)] border-slate-200 dark:border-slate-700"}`}>
                          <div>
                            <p className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                              {doc.label}
                              {doc.required && <span className="text-red-500 text-[10px]">*</span>}
                            </p>
                            {isUploaded && uploadedDoc && (
                              <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px] sm:max-w-[300px]">
                                {uploadedDoc.fileName}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-3">
                            {isUploaded ? (
                              <>
                                <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold bg-emerald-100 px-2 py-1 rounded-lg dark:bg-emerald-900/30">
                                  <span className="material-symbols-outlined text-sm">check_circle</span> Uploaded
                                </span>
                                {pickup.status !== "COMPLETED" && (
                                  <button onClick={() => triggerUpload(pickup.id, doc.endpoint, doc.typeParam)} className="text-xs text-slate-500 hover:text-primary transition-colors underline">
                                    Re-upload
                                  </button>
                                )}
                              </>
                            ) : pickup.status === "COMPLETED" ? (
                              <span className="text-slate-400 text-xs italic">Not required</span>
                            ) : (
                              <button
                                onClick={() => triggerUpload(pickup.id, doc.endpoint, doc.typeParam)}
                                disabled={isUploading}
                                className="btn-outline px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg flex items-center gap-2 disabled:opacity-50"
                              >
                                {isUploading ? (
                                  <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Uploading</>
                                ) : (
                                  <><span className="material-symbols-outlined text-sm">upload</span> Upload</>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {pickup.status === "PENDING" && isAllRequiredUploaded && (
                    <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-sm border border-blue-100 flex items-center gap-2 dark:bg-blue-900/20 dark:border-blue-800/50">
                      <span className="material-symbols-outlined text-blue-500">info</span>
                      All required documents uploaded. The admin will verify them shortly.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}