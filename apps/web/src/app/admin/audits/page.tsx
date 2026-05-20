"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminAudits() {
  const [activeTab, setActiveTab] = useState<"vendor-docs" | "site-audits">("vendor-docs");

  // ── Vendor Audit Docs ───────────────────────────────────────────────────────
  const [vendorDocs, setVendorDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docStatusFilter, setDocStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const fetchVendorDocs = async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await api.get("/requirements/audit-docs/all");
      setVendorDocs(res.data || []);
    } catch (err: any) {
      setDocsError(err?.response?.data?.message || err?.message || "Failed to load vendor audit docs");
    } finally {
      setDocsLoading(false);
    }
  };

  // ── Site Visit Audits ───────────────────────────────────────────────────────
  const [audits, setAudits] = useState<any[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [auditsError, setAuditsError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState<"ALL" | "INVITED" | "ACCEPTED" | "COMPLETED">("ALL");

  const fetchSiteAudits = async () => {
    setAuditsLoading(true);
    setAuditsError(null);
    try {
      const res = await api.get("/audits/invitations");
      setAudits(res.data);
    } catch (err: any) {
      setAuditsError("Failed to load site audits.");
    } finally {
      setAuditsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorDocs();
    fetchSiteAudits();
  }, []);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Group vendor docs by requirement
  const filteredDocs = vendorDocs.filter(d => docStatusFilter === "all" || d.status === docStatusFilter);
  const groupedByReq: Record<string, { reqId: string; reqTitle: string; reqCategory: string; docs: any[] }> = {};
  for (const doc of filteredDocs) {
    const reqId = doc.requirementId;
    if (!groupedByReq[reqId]) {
      groupedByReq[reqId] = {
        reqId,
        reqTitle: doc.requirement?.title || reqId,
        reqCategory: doc.requirement?.category || "",
        docs: [],
      };
    }
    groupedByReq[reqId].docs.push(doc);
  }

  const pendingCount = vendorDocs.filter(d => d.status === "pending").length;
  const approvedCount = vendorDocs.filter(d => d.status === "approved").length;
  const rejectedCount = vendorDocs.filter(d => d.status === "rejected").length;

  // Group site audits by requirement
  const filteredAudits = audits.filter(a => siteFilter === "ALL" || a.status === siteFilter);
  const groupedAudits = filteredAudits.reduce((acc: any, audit: any) => {
    const reqId = audit.requirementId;
    if (!acc[reqId]) acc[reqId] = { requirement: audit.requirement, audits: [] };
    acc[reqId].audits.push(audit);
    return acc;
  }, {});

  const siteAuditStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-emerald-100 text-emerald-700";
      case "ACCEPTED": return "bg-blue-100 text-blue-700";
      case "REJECTED": return "bg-red-100 text-red-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative pb-20 px-4 sm:px-6 lg:px-8">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-xl z-50 text-white font-bold text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Audit Management</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Review vendor audit documents and site visit reports.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("vendor-docs")}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "vendor-docs" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
        >
          <span className="material-symbols-outlined text-base">description</span>
          Vendor Audit Documents
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("site-audits")}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "site-audits" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
        >
          <span className="material-symbols-outlined text-base">location_on</span>
          Site Visit Audits
        </button>
      </div>

      {/* ── Vendor Audit Documents Tab ── */}
      {activeTab === "vendor-docs" && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Pending Review", value: pendingCount, color: "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: "pending", filter: "pending" as const },
              { label: "Approved", value: approvedCount, color: "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800", icon: "check_circle", filter: "approved" as const },
              { label: "Rejected", value: rejectedCount, color: "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800", icon: "cancel", filter: "rejected" as const },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => setDocStatusFilter(docStatusFilter === s.filter ? "all" : s.filter)}
                className={`rounded-2xl border p-5 flex items-center gap-4 ${s.color} transition-all ${docStatusFilter === s.filter ? "ring-2 ring-current" : ""}`}
              >
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                <div className="text-left">
                  <p className="text-3xl font-black">{s.value}</p>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-70">{s.label}</p>
                </div>
              </button>
            ))}
          </div>

          {docsError && (
            <div className="px-5 py-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
              <span className="material-symbols-outlined text-red-500">error</span>
              <p className="text-sm text-red-700 dark:text-red-400 font-bold">{docsError}</p>
              <button onClick={fetchVendorDocs} className="ml-auto text-xs font-bold underline text-red-700 dark:text-red-400">Retry</button>
            </div>
          )}

          {docsLoading ? (
            <div className="flex justify-center p-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : Object.keys(groupedByReq).length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">folder_open</span>
              <p className="text-slate-500 font-bold">No vendor audit documents yet.</p>
              <p className="text-slate-400 text-sm mt-1">Documents appear here once vendors upload audit reports for their assigned listings.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.values(groupedByReq).map((group) => (
                <div key={group.reqId} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {/* Auction header */}
                  <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.reqCategory}</span>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-lg mt-0.5">{group.reqTitle}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-bold">{group.docs.length} submission{group.docs.length !== 1 ? "s" : ""}</span>
                      <Link
                        href={`/admin/listings/${group.reqId}/audit-docs`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Review
                      </Link>
                    </div>
                  </div>

                  {/* Vendor rows */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.docs.map((doc: any) => (
                      <div key={doc.id} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{doc.vendor?.name || "Vendor"}</p>
                            <p className="text-xs text-slate-400">{doc.vendor?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-slate-400">
                            {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                            doc.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : doc.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Site Visit Audits Tab ── */}
      {activeTab === "site-audits" && (
        <div className="space-y-5">
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-px">
            {(["ALL", "INVITED", "ACCEPTED", "COMPLETED"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSiteFilter(f)}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${siteFilter === f ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>

          {auditsError && (
            <div className="px-5 py-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
              <span className="material-symbols-outlined text-red-500">error</span>
              <p className="text-sm text-red-700 dark:text-red-400 font-bold">{auditsError}</p>
              <button onClick={fetchSiteAudits} className="ml-auto text-xs font-bold underline text-red-700 dark:text-red-400">Retry</button>
            </div>
          )}

          {auditsLoading ? (
            <div className="flex justify-center p-20">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : audits.length === 0 ? (
            <div className="card p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">fact_check</span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Site Audits Found</h3>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.values(groupedAudits).map((group: any) => (
                <div key={group.requirement?.id} className="card p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">REQ: {group.requirement?.id?.substring(0, 8)}</span>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mt-0.5">{group.requirement?.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">Client: <span className="font-bold">{group.requirement?.client?.name}</span></p>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.audits.map((audit: any) => {
                      const isMismatch = audit.report && audit.report.productMatch === false;
                      return (
                        <div key={audit.id} className={`p-5 flex flex-col md:flex-row items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${isMismatch ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-bold text-base text-slate-900 dark:text-white">{audit.vendor?.name}</p>
                              <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wide ${siteAuditStatusColor(audit.status)}`}>
                                {audit.status}
                              </span>
                            </div>
                            {audit.status === "COMPLETED" && audit.report && (
                              <div className={`mt-3 p-4 rounded-xl border ${isMismatch ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800"}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`material-symbols-outlined ${isMismatch ? "text-red-500" : "text-emerald-500"}`}>
                                    {isMismatch ? "warning" : "check_circle"}
                                  </span>
                                  <p className={`text-sm font-bold ${isMismatch ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                                    Product Match: {isMismatch ? "NO (MISMATCH)" : "YES"}
                                  </p>
                                </div>
                                {audit.report.remarks && (
                                  <p className="text-sm text-slate-700 dark:text-slate-300 italic mt-1">"{audit.report.remarks}"</p>
                                )}
                                <p className="text-xs text-slate-400 mt-2">Completed: {new Date(audit.report.completedAt).toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
