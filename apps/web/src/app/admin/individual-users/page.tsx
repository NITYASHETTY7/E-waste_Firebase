"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminIndividualUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "inactive">("all");

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [pendingAction, setPendingAction] = useState<"reject" | "hold" | null>(null);
  const [pendingReason, setPendingReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users?role=USER");
      setUsers(res.data);
    } catch {
      showToast("Failed to load users.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleApprove = async () => {
    if (!selectedUser || actionLoading) return;
    setActionLoading(true);
    try {
      await api.patch(`/users/${selectedUser.id}/approve`);
      showToast("User approved successfully.");
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to approve user.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedUser || !pendingAction || actionLoading) return;
    setActionLoading(true);
    try {
      await api.patch(`/users/${selectedUser.id}/${pendingAction}`, {
        reason: pendingReason.trim() || undefined,
      });
      showToast(pendingAction === "hold" ? "User placed on hold." : "User rejected.");
      setSelectedUser(null);
      setPendingAction(null);
      setPendingReason("");
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.message || `Failed to ${pendingAction} user.`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const getUserStatus = (u: any) => {
    if (u.isActive) return "active";
    if (!u.emailVerified || !u.phoneVerified) return "unverified";
    return "pending";
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    pending: users.filter(u => !u.isActive && u.emailVerified && u.phoneVerified).length,
    unverified: users.filter(u => !u.emailVerified || !u.phoneVerified).length,
  };

  const filtered = users
    .filter(u => {
      if (statusFilter === "all") return true;
      const s = getUserStatus(u);
      if (statusFilter === "pending") return s === "pending";
      if (statusFilter === "active") return s === "active";
      if (statusFilter === "inactive") return s === "unverified";
      return true;
    })
    .filter(u =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.toLowerCase().includes(search.toLowerCase())
    );

  const statusBadge = (u: any) => {
    const s = getUserStatus(u);
    if (s === "active") return <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</span>;
    if (s === "pending") return <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pending Approval</span>;
    return <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Not Verified</span>;
  };

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

      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Individual Users</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Review and approve individual user accounts that sell e-waste directly.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.total, icon: "person", color: "text-blue-600 bg-blue-50" },
          { label: "Active", value: stats.active, icon: "check_circle", color: "text-emerald-600 bg-emerald-50" },
          { label: "Pending Approval", value: stats.pending, icon: "pending_actions", color: "text-amber-600 bg-amber-50" },
          { label: "Not Verified", value: stats.unverified, icon: "mark_email_unread", color: "text-slate-500 bg-slate-100" },
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
          <input type="text" placeholder="Search by name, email or phone..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#1E8E3E]/20 focus:border-[#1E8E3E] transition-all" />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full sm:w-fit overflow-x-auto">
          {(["all", "pending", "active", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${statusFilter === f ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
              {f === "inactive" ? "Unverified" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center p-20">
          <div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden border border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 dark:bg-slate-800">
                {["User", "Contact", "Registered", "Verification", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-white/70 font-bold text-[10px] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center font-black text-sm text-purple-700 dark:text-purple-400 shrink-0">
                        {u.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">#{u.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{u.email}</p>
                    <p className="text-xs text-slate-400">{u.phone || "No phone"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`flex items-center gap-1 text-[10px] font-bold ${u.emailVerified ? "text-emerald-600" : "text-slate-400"}`}>
                        <span className="material-symbols-outlined text-xs">{u.emailVerified ? "mark_email_read" : "mark_email_unread"}</span>
                        Email {u.emailVerified ? "verified" : "pending"}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold ${u.phoneVerified ? "text-emerald-600" : "text-slate-400"}`}>
                        <span className="material-symbols-outlined text-xs">{u.phoneVerified ? "smartphone" : "phone_disabled"}</span>
                        Phone {u.phoneVerified ? "verified" : "pending"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(u)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setSelectedUser(u); setPendingAction(null); setPendingReason(""); }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        getUserStatus(u) === "active"
                          ? "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                      }`}>
                      <span className="material-symbols-outlined text-sm">
                        {getUserStatus(u) === "active" ? "manage_accounts" : "rate_review"}
                      </span>
                      {getUserStatus(u) === "active" ? "Manage" : "Review"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400 italic">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setSelectedUser(null); setPendingAction(null); setPendingReason(""); }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center font-headline font-black text-xl text-purple-700 dark:text-purple-400">
                  {selectedUser.name?.charAt(0) || "?"}
                </div>
                <div>
                  <h3 className="text-lg font-headline font-extrabold text-slate-900 dark:text-white">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-400">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedUser(null); setPendingAction(null); setPendingReason(""); }}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Phone", selectedUser.phone || "—"],
                  ["Registered", new Date(selectedUser.createdAt).toLocaleDateString("en-IN")],
                  ["Email Verified", selectedUser.emailVerified ? "Yes" : "No"],
                  ["Phone Verified", selectedUser.phoneVerified ? "Yes" : "No"],
                ].map(([label, val]) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{val}</p>
                  </div>
                ))}
              </div>

              {pendingAction && (
                <div className="space-y-3 pt-2">
                  <p className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${pendingAction === "hold" ? "text-amber-700" : "text-red-700"}`}>
                    <span className={`material-symbols-outlined text-base ${pendingAction === "hold" ? "text-amber-500" : "text-red-500"}`}>
                      {pendingAction === "hold" ? "pause_circle" : "block"}
                    </span>
                    {pendingAction === "hold" ? "Place User On Hold" : "Reject User Account"}
                  </p>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-300 resize-none min-h-[80px]"
                    placeholder="Reason (optional)..."
                    value={pendingReason}
                    onChange={e => setPendingReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setPendingAction(null); setPendingReason(""); }}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700">
                      Cancel
                    </button>
                    <button onClick={handleConfirmAction} disabled={actionLoading}
                      className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 ${pendingAction === "hold" ? "bg-amber-500 hover:bg-amber-600" : "bg-red-600 hover:bg-red-700"}`}>
                      {actionLoading ? "Processing..." : `Confirm ${pendingAction === "hold" ? "Hold" : "Reject"}`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!pendingAction && (
              <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 rounded-b-2xl">
                {getUserStatus(selectedUser) !== "active" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-amber-500">pending_actions</span>
                      Awaiting Your Decision
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={handleApprove} disabled={actionLoading}
                        className="py-3 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-100 disabled:opacity-60">
                        <span className="material-symbols-outlined text-base">check_circle</span> Approve
                      </button>
                      <button onClick={() => { setPendingAction("hold"); setPendingReason(""); }} disabled={actionLoading}
                        className="py-3 rounded-xl bg-amber-50 text-amber-700 font-black text-sm hover:bg-amber-100 border border-amber-200 flex items-center justify-center gap-2 disabled:opacity-60">
                        <span className="material-symbols-outlined text-base">pause_circle</span> Hold
                      </button>
                      <button onClick={() => { setPendingAction("reject"); setPendingReason(""); }} disabled={actionLoading}
                        className="py-3 rounded-xl bg-red-50 text-red-600 font-black text-sm hover:bg-red-600 hover:text-white border border-red-200 flex items-center justify-center gap-2 disabled:opacity-60">
                        <span className="material-symbols-outlined text-base">block</span> Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Status: <span className="text-emerald-600">Active</span>
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => { setPendingAction("hold"); setPendingReason(""); }}
                        className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs hover:bg-amber-100 border border-amber-200 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">pause_circle</span> Hold
                      </button>
                      <button onClick={() => { setPendingAction("reject"); setPendingReason(""); }}
                        className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-600 hover:text-white border border-red-200 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">block</span> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
