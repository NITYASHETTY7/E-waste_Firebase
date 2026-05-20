"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate } from "@/utils/format";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function VendorProfile() {
  const { currentUser, bids, listings, updateUserProfile, changePassword, deleteAccount } = useApp();
  const router = useRouter();
  const profile = currentUser?.onboardingProfile;
  const docs = currentUser?.documents || [];
  
  const [tab, setTab] = useState<"profile" | "documents" | "stats" | "settings">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [kycDocs, setKycDocs] = useState<any[]>([]);
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [urlLoading, setUrlLoading] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || ''
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  useEffect(() => {
    if (tab === "documents" && currentUser?.companyId && kycDocs.length === 0) {
      setLoadingKyc(true);
      api.get(`/companies/${currentUser.companyId}`)
        .then(res => setKycDocs(res.data?.kycDocuments || []))
        .catch(() => {})
        .finally(() => setLoadingKyc(false));
    }
  }, [tab, currentUser?.companyId]);

  const openDoc = async (doc: any) => {
    if (doc.signedUrl) { window.open(doc.signedUrl, "_blank"); return; }
    setUrlLoading(doc.id);
    try {
      const res = await api.get("/companies/signed-url", { params: { s3Key: doc.s3Key, s3Bucket: doc.s3Bucket } });
      window.open(res.data.url, "_blank");
    } catch { alert("Could not open document."); }
    finally { setUrlLoading(null); }
  };

  const myBids = bids.filter(b => b.vendorId === currentUser?.id);
  const wonBids = myBids.filter(b => b.status === "accepted");
  const totalPurchase = wonBids.reduce((s, b) => s + b.amount, 0);
  const winRate = myBids.length > 0 ? Math.round((wonBids.length / myBids.length) * 100) : 0;

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({ name: editData.name, email: editData.email, phone: editData.phone });
    setIsEditing(false);
    showFeedback('success', 'Profile updated successfully.');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      showFeedback('error', 'Passwords do not match.');
      return;
    }
    changePassword(passwords.new);
    setPasswords({ current: '', new: '', confirm: '' });
    showFeedback('success', 'Password changed successfully.');
  };

  const handleDeleteAccount = () => {
    deleteAccount();
    router.push('/');
  };

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight dark:text-white">Recycler <span className="text-blue-600">Profile</span></h2>
        <p className="text-slate-500 font-medium mt-1">Manage certification, business credentials, and account security.</p>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border shadow-sm ${
              feedback.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
            }`}
          >
            <span className="material-symbols-outlined">{feedback.type === 'success' ? 'check_circle' : 'error'}</span>
            <p className="text-sm font-bold">{feedback.msg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
        {/* Sidebar Nav */}
        <div className="space-y-2">
          {[
            { id: "profile", label: "Business Credentials", icon: "badge" },
            { id: "documents", label: "Certifications", icon: "verified" },
            { id: "stats", label: "Performance Audit", icon: "analytics" },
            { id: "settings", label: "Account Settings", icon: "settings" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                tab === t.id ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
          {tab === "profile" && (
            <div className="p-8 space-y-8 animate-fade-in">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-3xl bg-blue-900 flex items-center justify-center text-white font-black text-3xl shadow-lg">
                    {(currentUser?.name || "V")[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{currentUser?.name}</h3>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Authorized Recycling Partner</p>
                  </div>
                </div>
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-slate-100 text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all dark:bg-slate-800 dark:text-white">
                    Edit Details
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1">Entity Name</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={editData.name}
                        onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1">Contact Email</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={editData.email}
                        onChange={e => setEditData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold dark:bg-slate-800 dark:text-slate-400">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: "CPCB Authorization", value: profile?.cpcbNo || "CPCB-BW-2024-0892", icon: "verified_user" },
                    { label: "Capacity", value: profile?.processingCapacity || "50 MT/month", icon: "factory" },
                    { label: "Company Reg", value: profile?.companyRegistrationNo || "REG-9921-X", icon: "app_registration" },
                    { label: "City", value: profile?.city ? `${profile.city}, ${profile.state}` : "Mumbai", icon: "location_on" },
                  ].map((item) => (
                    <div key={item.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-blue-400 text-lg">{item.icon}</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.label}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                  <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Business Address</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{profile?.address || "MIDC Industrial Area, Andheri East, Mumbai - 400093"}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div className="p-8 space-y-6 animate-fade-in">
              <h4 className="text-xl font-black text-slate-900 dark:text-white">Regulatory Documents</h4>
              {loadingKyc ? (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin block mb-2">progress_activity</span>
                  <p className="text-slate-400 text-sm">Loading documents from S3...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {kycDocs.length > 0 ? kycDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-blue-200 transition-all dark:bg-slate-950 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
                          <span className="material-symbols-outlined text-blue-500">verified</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{doc.fileName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{doc.type?.replace(/_/g, " ")} · {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openDoc(doc)}
                        disabled={urlLoading === doc.id}
                        className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all flex items-center justify-center dark:bg-slate-900 dark:border-slate-700 disabled:opacity-50"
                      >
                        {urlLoading === doc.id
                          ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                          : <span className="material-symbols-outlined text-sm">open_in_new</span>
                        }
                      </button>
                    </div>
                  )) : (
                    <div className="py-20 text-center space-y-2">
                      <span className="material-symbols-outlined text-4xl text-slate-200">folder_open</span>
                      <p className="text-slate-400 font-bold text-sm italic">No documents uploaded yet.</p>
                      <p className="text-slate-400 text-xs">Documents uploaded during onboarding appear here.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "stats" && (
            <div className="p-8 space-y-8 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Bids Placed", value: myBids.length, icon: "gavel", color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Bids Won", value: wonBids.length, icon: "emoji_events", color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Success Rate", value: `${winRate}%`, icon: "monitoring", color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Total Purchase", value: `₹${(totalPurchase / 1000).toFixed(1)}k`, icon: "payments", color: "text-purple-600", bg: "bg-purple-50" },
                ].map(s => (
                  <div key={s.label} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center gap-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center shrink-0`}>
                      <span className={`material-symbols-outlined text-xl ${s.color}`}>{s.icon}</span>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-900 tracking-tight dark:text-white">{s.value}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-600 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-20 -mt-20 blur-[100px] opacity-20 dark:bg-slate-900" />
                <div className="relative z-10">
                  <h4 className="text-xl font-black mb-2">Performance Audit Report</h4>
                  <p className="text-blue-100 text-sm mb-6">Analyze your bidding efficiency and acquisition costs for the current quarter.</p>
                  <button className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hover:bg-blue-50 dark:bg-slate-900">
                    Download Audit Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="p-8 space-y-10 animate-fade-in">
              <section className="space-y-4">
                <h4 className="text-lg font-black text-slate-900 dark:text-white">Security Credentials</h4>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1">New Password</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      value={passwords.new}
                      onChange={e => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1">Confirm New Password</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      value={passwords.confirm}
                      onChange={e => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                    />
                  </div>
                  <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                    Update Password
                  </button>
                </form>
              </section>

              <hr className="border-slate-100 dark:border-slate-800" />

              <section className="space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                  <span className="material-symbols-outlined">warning</span>
                  <h4 className="text-lg font-black">Danger Zone</h4>
                </div>
                <p className="text-slate-500 text-sm">Once you delete your account, there is no going back. All active bids will be withdrawn.</p>
                
                {showDeleteConfirm ? (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-4">
                    <p className="text-red-700 text-xs font-bold">Are you absolutely sure you want to delete your Recycler account?</p>
                    <div className="flex gap-3">
                      <button onClick={handleDeleteAccount} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold">Yes, Delete Forever</button>
                      <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold dark:text-slate-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowDeleteConfirm(true)} className="px-6 py-3 border-2 border-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all">
                    Delete Account
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
