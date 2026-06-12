"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

function exportVendorsCSV(vendors: any[]) {
  const clean = (val: any) => {
    if (val === undefined || val === null) return "";
    return String(val).replace(/,/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
  };

  const header = ["Vendor ID", "Company Name", "GST Number", "PAN Number", "City", "State", "Status", "Rating", "Total Penalties (INR)"];
  const rows = vendors.map(v => [
    v.id,
    clean(v.name),
    clean(v.gstNumber || "—"),
    clean(v.panNumber || "—"),
    clean(v.city || "—"),
    clean(v.state || "—"),
    v.status,
    v.rating?.toFixed(1) || "0.0",
    v.penaltyAmount || 0,
  ]);

  const csv = [header, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `weconnect_vendors_report_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminVendors() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "APPROVED" | "PENDING" | "REJECTED" | "BLOCKED">("all");

  // Detail modal state
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<1 | 2 | 3>(1);

  // Inline approval action state (for hold/reject reason)
  const [pendingAction, setPendingAction] = useState<"hold" | "reject" | null>(null);
  const [pendingReason, setPendingReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Separate modals for approved vendor risk controls
  const [lockModal, setLockModal] = useState<{ isOpen: boolean; vendorId: string | null }>({ isOpen: false, vendorId: null });
  const [penaltyModal, setPenaltyModal] = useState<{ isOpen: boolean; vendorId: string | null }>({ isOpen: false, vendorId: null });
  const [lockReason, setLockReason] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");
  const [applyingPenalty, setApplyingPenalty] = useState(false);
  const [lockingVendor, setLockingVendor] = useState(false);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await api.get("/companies?type=VENDOR");
      setVendors(res.data);
    } catch (err: any) {
      showToast("Failed to load vendors.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openDetail = async (vendor: any) => {
    setSelectedVendor(vendor);
    setDetailTab(1);
    setDetailData(null);
    setPendingAction(null);
    setPendingReason("");
    setLoadingDetail(true);
    try {
      const res = await api.get(`/companies/${vendor.id}`);
      setDetailData(res.data);
    } catch {
      showToast("Failed to load vendor details.", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedVendor(null);
    setDetailData(null);
    setPendingAction(null);
    setPendingReason("");
  };

  const handleApprove = async () => {
    if (!selectedVendor || actionLoading) return;
    setActionLoading(true);
    try {
      await api.patch(`/companies/admin/${selectedVendor.id}/approve`);
      showToast("Vendor approved. Email & SMS sent.");
      closeDetail();
      fetchVendors();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to approve vendor.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedVendor || !pendingAction || actionLoading) return;
    setActionLoading(true);
    try {
      await api.patch(`/companies/admin/${selectedVendor.id}/${pendingAction}`, { reason: pendingReason.trim() || undefined });
      showToast(
        pendingAction === "hold"
          ? "Vendor placed on hold. Email & SMS sent."
          : "Vendor rejected. Email & SMS sent."
      );
      closeDetail();
      fetchVendors();
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to ${pendingAction} vendor.`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async (id: string) => {
    try {
      await api.patch(`/companies/admin/${id}/unlock`);
      showToast("Vendor unlocked.");
      fetchVendors();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to unlock.", "error");
    }
  };

  const isLockingRef = useRef(false);
  const handleLock = async () => {
    if (!lockModal.vendorId || !lockReason.trim() || isLockingRef.current) return;
    isLockingRef.current = true;
    setLockingVendor(true);
    try {
      await api.patch(`/companies/admin/${lockModal.vendorId}/lock`, { reason: lockReason });
      showToast("Vendor locked.");
      setLockModal({ isOpen: false, vendorId: null });
      setLockReason("");
      fetchVendors();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to lock.", "error");
    } finally {
      setLockingVendor(false);
      isLockingRef.current = false;
    }
  };

  const isApplyingPenaltyRef = useRef(false);
  const handlePenalty = async () => {
    if (!penaltyModal.vendorId || !penaltyAmount || !penaltyReason.trim() || isApplyingPenaltyRef.current) return;
    isApplyingPenaltyRef.current = true;
    setApplyingPenalty(true);
    try {
      await api.post(`/companies/admin/${penaltyModal.vendorId}/penalty`, { amount: Number(penaltyAmount), reason: penaltyReason });
      showToast("Penalty applied.");
      setPenaltyModal({ isOpen: false, vendorId: null });
      setPenaltyAmount("");
      setPenaltyReason("");
      fetchVendors();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to apply penalty.", "error");
    } finally {
      setApplyingPenalty(false);
      isApplyingPenaltyRef.current = false;
    }
  };

  const stats = {
    total: vendors.length,
    active: vendors.filter(v => v.status === "APPROVED" && !v.isLocked).length,
    pending: vendors.filter(v => v.status === "PENDING").length,
    onHold: vendors.filter(v => v.status === "BLOCKED").length,
    locked: vendors.filter(v => v.isLocked).length,
  };

  const filtered = vendors
    .filter(v => statusFilter === "all" || v.status === statusFilter)
    .filter(v => (v.name?.toLowerCase() || "").includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative pb-20 px-4 sm:px-6 lg:px-8">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-xl z-[60] text-white font-bold text-sm ${toast.type === "success" ? "bg-[#1E8E3E]" : "bg-red-600"}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Vendor Management</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Review vendor applications, monitor performance, and manage risk controls.</p>
        </div>
        <button onClick={() => exportVendorsCSV(vendors)}
          className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl font-bold hover:opacity-80 transition-opacity text-sm border border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-lg">download</span>
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Vendors", value: stats.total, icon: "corporate_fare", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20" },
          { label: "Active", value: stats.active, icon: "verified", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20" },
          { label: "Pending Review", value: stats.pending, icon: "pending_actions", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20" },
          { label: "Locked", value: stats.locked, icon: "lock", color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20" },
        ].map(s => (
          <div key={s.label} className="card p-5 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <span className="material-symbols-outlined text-lg">{s.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-black text-[color:var(--color-on-surface)]">{s.value}</p>
                <p className="text-xs text-[color:var(--color-on-surface-variant)] font-medium">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input type="text" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#1E8E3E]/20 focus:border-[#1E8E3E] transition-all" />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full sm:w-fit">
          {(["all", "APPROVED", "PENDING", "BLOCKED", "REJECTED"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${statusFilter === f ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {f === "BLOCKED" ? "ON HOLD" : f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400 italic">No vendors found.</div>
          )}
          {filtered.map(vendor => (
            <div key={vendor.id} className="card p-0 overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row hover:bg-emerald-950/30 transition-all group">
              <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 group-hover:bg-transparent">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-headline font-black text-xl shrink-0 group-hover:bg-white group-hover:text-emerald-700">
                    {vendor.name.charAt(0)}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase ${
                      vendor.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : 
                      vendor.status === "REJECTED" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : 
                      vendor.status === "BLOCKED" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : 
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    } group-hover:bg-white/20 group-hover:text-white`}>
                      {vendor.status === "BLOCKED" ? "ON HOLD" : vendor.status}
                    </span>
                    {vendor.isLocked && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase bg-red-600 text-white flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-[10px]">lock</span> LOCKED
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight mb-1 group-hover:text-emerald-50">{vendor.name}</h3>
                  <p className="text-xs text-slate-500 mb-3 group-hover:text-emerald-400/60">ID: {vendor.id.substring(0, 8)}</p>
                  <div className="space-y-1.5 mt-4">
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 group-hover:text-slate-300">
                      <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-emerald-400">mail</span>
                      {vendor.users?.[0]?.email || "No email"}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 group-hover:text-slate-300">
                      <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-emerald-400">location_on</span>
                      {vendor.city || "No city"}, {vendor.state || "No state"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between group-hover:bg-transparent">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rating</p>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-50">{vendor.rating?.toFixed(1) || "New"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">GST No.</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white font-mono group-hover:text-emerald-50">{vendor.gstNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">PAN No.</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-white font-mono group-hover:text-emerald-50">{vendor.panNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Penalties</p>
                    <p className="font-bold text-sm text-red-600 group-hover:text-red-400">₹{(vendor.penaltyAmount || 0).toLocaleString()}</p>
                  </div>
                </div>

                {vendor.isLocked && vendor.lockReason && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl mb-4 dark:bg-red-900/10 dark:border-red-900/50">
                    <p className="text-xs font-bold text-red-800 flex items-center gap-1 mb-1 dark:text-red-400">
                      <span className="material-symbols-outlined text-sm">warning</span> Lock Reason
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">{vendor.lockReason}</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                  <button onClick={() => openDetail(vendor)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    View Details
                  </button>

                  {vendor.status === "APPROVED" && (
                    <>
                      <button onClick={() => setPenaltyModal({ isOpen: true, vendorId: vendor.id })}
                        className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold hover:bg-orange-100 transition-all dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400">
                        <span className="material-symbols-outlined text-sm">gavel</span>
                        Apply Penalty
                      </button>
                      {vendor.isLocked ? (
                        <button onClick={() => handleUnlock(vendor.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                          <span className="material-symbols-outlined text-sm">lock_open</span> Unlock
                        </button>
                      ) : (
                        <button onClick={() => setLockModal({ isOpen: true, vendorId: vendor.id })}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-all dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                          <span className="material-symbols-outlined text-sm">lock</span> Lock
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-headline font-black text-xl text-emerald-700">
                  {selectedVendor.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-headline font-extrabold text-slate-900 dark:text-white leading-tight">
                    {detailData?.name || selectedVendor.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                      selectedVendor.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : 
                      selectedVendor.status === "REJECTED" ? "bg-red-100 text-red-700" : 
                      selectedVendor.status === "BLOCKED" ? "bg-orange-100 text-orange-700" : 
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {selectedVendor.status === "BLOCKED" ? "ON HOLD" : selectedVendor.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">#{selectedVendor.id.substring(0, 8)}</span>
                  </div>
                </div>
              </div>
              <button onClick={closeDetail} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0">
              {([{ id: 1, label: "Profile", icon: "badge" }, { id: 2, label: "Documents", icon: "folder_open" }, { id: 3, label: "Bank Details", icon: "account_balance" }] as const).map(tab => (
                <button key={tab.id} onClick={() => setDetailTab(tab.id as 1 | 2 | 3)}
                  className={`flex items-center gap-1.5 px-6 py-3 text-sm font-bold border-b-2 transition-all ${detailTab === tab.id ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                  <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6">
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
                  <p className="text-slate-500 text-sm">Loading vendor details...</p>
                </div>
              ) : (
                <>
                  {/* Tab 1: Profile */}
                  {detailTab === 1 && (
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">person</span> Contact Person
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            ["Name", detailData?.users?.[0]?.name],
                            ["Email", detailData?.users?.[0]?.email],
                            ["Phone", detailData?.users?.[0]?.phone],
                          ].map(([label, val]) => (
                            <div key={label} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{val || <span className="text-slate-300 italic font-normal">Not provided</span>}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">corporate_fare</span> Company Details
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            ["Company Name", detailData?.name],
                            ["GST Number", detailData?.gstNumber],
                            ["PAN Number", detailData?.panNumber],
                            ["City", detailData?.city],
                            ["State", detailData?.state],
                            ["Pincode", detailData?.pincode],
                            ["Full Address", detailData?.address],
                          ].map(([label, val]) => (
                            <div key={label} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{val || <span className="text-slate-300 italic font-normal">—</span>}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Documents */}
                  {detailTab === 2 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">folder_open</span>
                        KYC Documents
                        {detailData?.kycDocuments?.length > 0 && (
                          <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black">{detailData.kycDocuments.length} submitted</span>
                        )}
                      </p>
                      {!detailData?.kycDocuments?.length ? (
                        <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-xl border-2 border-dashed border-red-200 dark:border-red-900 text-center">
                          <span className="material-symbols-outlined text-3xl text-red-300 mb-2 block">folder_off</span>
                          <p className="text-sm text-red-500 font-bold">No documents uploaded yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {detailData.kycDocuments.map((doc: any, i: number) => (
                            <div key={doc.id || i} className="flex items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-slate-200 transition-colors">
                              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-lg">description</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{doc.type?.replace(/_/g, " ")}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{doc.fileName} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                              </div>
                              {doc.signedUrl ? (
                                <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all border border-blue-100">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span> Open
                                </a>
                              ) : (
                                <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 text-xs font-bold">Unavailable</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Bank Details */}
                  {detailTab === 3 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">account_balance</span> Bank Account Details
                      </p>
                      {detailData?.bankAccountNumber ? (
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            ["Account Holder", detailData?.bankAccountHolder],
                            ["Bank Name", detailData?.bankName],
                            ["Account Number", detailData?.bankAccountNumber],
                            ["IFSC Code", detailData?.bankIfscCode],
                            ["Account Type", detailData?.bankAccountType],
                          ].map(([label, val]) => (
                            <div key={label} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{val || "—"}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                          <span className="material-symbols-outlined text-2xl text-slate-300 mb-1 block">account_balance</span>
                          <p className="text-xs text-slate-400 font-bold">Bank details not provided</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer — Decision Actions */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 rounded-b-2xl shrink-0">
              {(selectedVendor.status === "PENDING" || selectedVendor.status === "BLOCKED") && !pendingAction && (
                <div className="space-y-2">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-500">pending_actions</span>
                    {selectedVendor.status === "PENDING" ? "Pending Review — Take a Decision" : "On Hold — Review Application"}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={handleApprove} disabled={actionLoading}
                      className="py-3 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-100 disabled:opacity-60">
                      <span className="material-symbols-outlined text-base">check_circle</span> Approve
                    </button>
                    {selectedVendor.status !== "BLOCKED" && (
                      <button onClick={() => { setPendingAction("hold"); setPendingReason(""); }} disabled={actionLoading}
                        className="py-3 rounded-xl bg-amber-50 text-amber-700 font-black text-sm hover:bg-amber-100 transition-all border border-amber-200 flex items-center justify-center gap-2 disabled:opacity-60">
                        <span className="material-symbols-outlined text-base">pause_circle</span> Hold
                      </button>
                    )}
                    <button onClick={() => { setPendingAction("reject"); setPendingReason(""); }} disabled={actionLoading}
                      className="py-3 rounded-xl bg-red-50 text-red-600 font-black text-sm hover:bg-red-600 hover:text-white transition-all border border-red-200 flex items-center justify-center gap-2 disabled:opacity-60">
                      <span className="material-symbols-outlined text-base">block</span> Reject
                    </button>
                  </div>
                </div>
              )}

              {(selectedVendor.status === "PENDING" || selectedVendor.status === "BLOCKED") && pendingAction && (
                <div className="space-y-3">
                  <p className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${pendingAction === "hold" ? "text-amber-700" : "text-red-700"}`}>
                    <span className={`material-symbols-outlined text-base ${pendingAction === "hold" ? "text-amber-500" : "text-red-500"}`}>
                      {pendingAction === "hold" ? "pause_circle" : "block"}
                    </span>
                    {pendingAction === "hold" ? "Place Vendor On Hold" : "Reject Vendor Application"}
                  </p>
                  <p className="text-xs text-slate-500">Vendor will be notified via email and SMS.</p>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-300 resize-none min-h-[80px]"
                    placeholder="Reason (optional) — e.g. Additional documents required..."
                    value={pendingReason}
                    onChange={e => setPendingReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setPendingAction(null); setPendingReason(""); }}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800">
                      Cancel
                    </button>
                    <button onClick={handleConfirmAction} disabled={actionLoading}
                      className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-all ${pendingAction === "hold" ? "bg-amber-500 hover:bg-amber-600" : "bg-red-600 hover:bg-red-700"}`}>
                      {actionLoading ? "Processing..." : `Confirm ${pendingAction === "hold" ? "Hold" : "Reject"}`}
                    </button>
                  </div>
                </div>
              )}

              {selectedVendor.status !== "PENDING" && selectedVendor.status !== "BLOCKED" && (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Status: <span className={selectedVendor.status === "APPROVED" ? "text-emerald-600" : "text-red-600"}>{selectedVendor.status}</span>
                  </p>
                  <button onClick={closeDetail}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lock Modal ─────────────────────────────────────────── */}
      {lockModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-headline font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600">lock</span> Lock Vendor Account
            </h3>
            <p className="text-sm text-slate-500">Locking will immediately prevent participation in auctions.</p>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Reason *</label>
              <textarea className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-red-300 resize-none min-h-[100px]"
                placeholder="Detail the compliance violation or issue..."
                value={lockReason} onChange={e => setLockReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setLockModal({ isOpen: false, vendorId: null }); setLockReason(""); }} disabled={lockingVendor}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleLock} disabled={!lockReason.trim() || lockingVendor}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                {lockingVendor ? "Locking..." : "Confirm Lock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Penalty Modal ─────────────────────────────────────────── */}
      {penaltyModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-headline font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">gavel</span> Apply Penalty
            </h3>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Amount (₹) *</label>
              <input type="number" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300"
                placeholder="e.g. 5000" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Reason *</label>
              <textarea className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300 resize-none min-h-[80px]"
                placeholder="Reason for penalty..." value={penaltyReason} onChange={e => setPenaltyReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setPenaltyModal({ isOpen: false, vendorId: null }); setPenaltyAmount(""); setPenaltyReason(""); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50" disabled={applyingPenalty}>Cancel</button>
              <button onClick={handlePenalty} disabled={!penaltyAmount || !penaltyReason.trim() || applyingPenalty}
                className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50">
                {applyingPenalty ? "Applying..." : "Apply Penalty"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
