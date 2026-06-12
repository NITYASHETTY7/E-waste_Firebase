"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

function exportClientsCSV(clients: any[]) {
  const clean = (val: any) => {
    if (val === undefined || val === null) return "";
    return String(val).replace(/,/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
  };

  const header = ["Client ID", "Company Name", "GST Number", "PAN Number", "City", "State", "Status", "Total Revenue (INR)", "Active Auctions"];
  const rows = clients.map(c => [
    c.id,
    clean(c.name),
    clean(c.gstNumber || "—"),
    clean(c.panNumber || "—"),
    clean(c.city || "—"),
    clean(c.state || "—"),
    c.status,
    0, // Revenue placeholder
    0, // Auctions placeholder
  ]);

  const csv = [header, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `weconnect_clients_report_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminUsers() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "APPROVED" | "PENDING" | "REJECTED" | "BLOCKED">("all");

  // Detail modal state
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<1 | 2 | 3>(1);

  // Inline approval action state
  const [pendingAction, setPendingAction] = useState<"hold" | "reject" | null>(null);
  const [pendingReason, setPendingReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/companies?type=CLIENT");
      setClients(res.data);
    } catch (err: any) {
      showToast("Failed to load clients.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openDetail = async (client: any) => {
    setSelectedClient(client);
    setDetailTab(1);
    setDetailData(null);
    setPendingAction(null);
    setPendingReason("");
    setLoadingDetail(true);
    try {
      const res = await api.get(`/companies/${client.id}`);
      setDetailData(res.data);
    } catch {
      showToast("Failed to load client details.", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedClient(null);
    setDetailData(null);
    setPendingAction(null);
    setPendingReason("");
  };

  const handleApprove = async () => {
    if (!selectedClient || actionLoading) return;
    setActionLoading(true);
    try {
      await api.patch(`/companies/admin/${selectedClient.id}/approve`);
      showToast("Client approved. Email & SMS sent.");
      closeDetail();
      fetchClients();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to approve client.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedClient || !pendingAction || actionLoading) return;
    setActionLoading(true);
    try {
      await api.patch(`/companies/admin/${selectedClient.id}/${pendingAction}`, {
        reason: pendingReason.trim() || undefined,
      });
      showToast(
        pendingAction === "hold"
          ? "Client placed on hold. Email & SMS sent."
          : "Client rejected. Email & SMS sent."
      );
      closeDetail();
      fetchClients();
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to ${pendingAction} client.`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === "APPROVED").length,
    pending: clients.filter(c => c.status === "PENDING").length,
    rejected: clients.filter(c => c.status === "REJECTED").length,
    onHold: clients.filter(c => c.status === "BLOCKED").length,
  };

  const filtered = clients
    .filter(c => statusFilter === "all" || c.status === statusFilter)
    .filter(c =>
      (c.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (c.users?.[0]?.email || "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pb-20">
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
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Client Management</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Review client applications, verify documents, and manage account status.</p>
        </div>
        <button onClick={() => exportClientsCSV(clients)}
          className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl font-bold hover:opacity-80 transition-opacity text-sm border border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-lg">download</span>
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Clients", value: stats.total, icon: "domain", color: "text-blue-600 bg-blue-50" },
          { label: "Active", value: stats.active, icon: "check_circle", color: "text-emerald-600 bg-emerald-50" },
          { label: "Pending Review", value: stats.pending, icon: "pending_actions", color: "text-amber-600 bg-amber-50" },
          { label: "Rejected / On Hold", value: stats.rejected + stats.onHold, icon: "block", color: "text-red-600 bg-red-50" },
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
          <input type="text" placeholder="Search clients by name or email..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1E8E3E]/20 focus:border-[#1E8E3E] transition-all" />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full sm:w-fit overflow-x-auto">
          {(["all", "APPROVED", "PENDING", "REJECTED", "BLOCKED"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${statusFilter === f ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {f === "BLOCKED" ? "ON HOLD" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Client Table */}
      {loading ? (
        <div className="flex justify-center p-20">
          <div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden border border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 dark:bg-slate-800">
                {["Client", "Contact", "GST / PAN", "Location", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-white/70 font-bold text-[10px] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(client => (
                <tr key={client.id} className="hover:bg-emerald-950/30 transition-all group cursor-pointer" onClick={() => openDetail(client)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-black text-sm text-blue-700 dark:text-blue-400 shrink-0 group-hover:bg-white group-hover:text-blue-700">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-50">{client.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-emerald-400/60">#{client.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-200">{client.users?.[0]?.email || "—"}</p>
                    <p className="text-xs text-slate-400 group-hover:text-slate-500">{client.users?.[0]?.phone || "No phone"}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <p className="text-slate-700 dark:text-slate-300 group-hover:text-emerald-50">{client.gstNumber || "—"}</p>
                    <p className="text-slate-400 group-hover:text-slate-500">{client.panNumber || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 group-hover:text-slate-400">
                    {client.city ? `${client.city}, ${client.state || ""}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase ${
                      client.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                      client.status === "REJECTED" ? "bg-red-100 text-red-700" :
                      client.status === "BLOCKED" ? "bg-orange-100 text-orange-700" :
                      "bg-amber-100 text-amber-700"
                    } group-hover:bg-white/20 group-hover:text-white`}>
                      {client.status === "BLOCKED" ? "ON HOLD" : client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openDetail(client)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400 italic">
                    {loading ? "Loading..." : "No clients found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-headline font-black text-xl text-blue-700 dark:text-blue-400">
                  {selectedClient.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-headline font-extrabold text-slate-900 dark:text-white leading-tight">
                    {detailData?.name || selectedClient.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                      selectedClient.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                      selectedClient.status === "REJECTED" ? "bg-red-100 text-red-700" :
                      selectedClient.status === "BLOCKED" ? "bg-orange-100 text-orange-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {selectedClient.status === "BLOCKED" ? "ON HOLD" : selectedClient.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">#{selectedClient.id.substring(0, 8)}</span>
                  </div>
                </div>
              </div>
              <button onClick={closeDetail} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0">
              {([
                { id: 1, label: "Profile", icon: "badge" },
                { id: 2, label: "Documents", icon: "folder_open" },
                { id: 3, label: "Bank Details", icon: "account_balance" },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                  className={`flex items-center gap-1.5 px-6 py-3 text-sm font-bold border-b-2 transition-all ${detailTab === tab.id ? "border-blue-500 text-blue-700 dark:text-blue-400" : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                  <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6">
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
                  <p className="text-slate-500 text-sm">Loading client details...</p>
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
                          <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black">{detailData.kycDocuments.length} submitted</span>
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

              {/* Inline reason input */}
              {pendingAction && (
                <div className="space-y-3">
                  <p className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${pendingAction === "hold" ? "text-amber-700" : "text-red-700"}`}>
                    <span className={`material-symbols-outlined text-base ${pendingAction === "hold" ? "text-amber-500" : "text-red-500"}`}>
                      {pendingAction === "hold" ? "pause_circle" : "block"}
                    </span>
                    {pendingAction === "hold" ? "Place Client On Hold" : "Reject Client Application"}
                  </p>
                  <p className="text-xs text-slate-500">Client will be notified via email and SMS.</p>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-300 resize-none min-h-[80px]"
                    placeholder="Reason (optional) — e.g. GST documents missing..."
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

              {!pendingAction && selectedClient.status === "PENDING" && (
                <div className="space-y-2">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-500">pending_actions</span>
                    Pending Review — Take a Decision
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={handleApprove} disabled={actionLoading}
                      className="py-3 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-100 disabled:opacity-60">
                      <span className="material-symbols-outlined text-base">check_circle</span> Approve
                    </button>
                    <button onClick={() => { setPendingAction("hold"); setPendingReason(""); }} disabled={actionLoading}
                      className="py-3 rounded-xl bg-amber-50 text-amber-700 font-black text-sm hover:bg-amber-100 transition-all border border-amber-200 flex items-center justify-center gap-2 disabled:opacity-60">
                      <span className="material-symbols-outlined text-base">pause_circle</span> Hold
                    </button>
                    <button onClick={() => { setPendingAction("reject"); setPendingReason(""); }} disabled={actionLoading}
                      className="py-3 rounded-xl bg-red-50 text-red-600 font-black text-sm hover:bg-red-600 hover:text-white transition-all border border-red-200 flex items-center justify-center gap-2 disabled:opacity-60">
                      <span className="material-symbols-outlined text-base">block</span> Reject
                    </button>
                  </div>
                </div>
              )}

              {!pendingAction && selectedClient.status !== "PENDING" && (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Current Status:{" "}
                    <span className={
                      selectedClient.status === "APPROVED" ? "text-emerald-600" :
                      selectedClient.status === "BLOCKED" ? "text-orange-600" :
                      "text-red-600"
                    }>
                      {selectedClient.status === "BLOCKED" ? "ON HOLD" : selectedClient.status}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    {selectedClient.status !== "APPROVED" && (
                      <button onClick={handleApprove} disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200 flex items-center gap-1.5 disabled:opacity-60">
                        <span className="material-symbols-outlined text-sm">check_circle</span> Approve
                      </button>
                    )}
                    {selectedClient.status !== "BLOCKED" && (
                      <button onClick={() => { setPendingAction("hold"); setPendingReason(""); }} disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs hover:bg-amber-100 transition-all border border-amber-200 flex items-center gap-1.5 disabled:opacity-60">
                        <span className="material-symbols-outlined text-sm">pause_circle</span> Hold
                      </button>
                    )}
                    {selectedClient.status !== "REJECTED" && (
                      <button onClick={() => { setPendingAction("reject"); setPendingReason(""); }} disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-600 hover:text-white transition-all border border-red-200 flex items-center gap-1.5 disabled:opacity-60">
                        <span className="material-symbols-outlined text-sm">block</span> Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
