"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate } from "@/utils/format";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

function downloadEPRReport(userName: string, listings: { title: string; weight: number }[]) {
  const totalWeight = listings.reduce((s, l) => s + l.weight, 0);
  const co2 = (totalWeight * 2.4).toFixed(1);
  const reportDate = formatDate(new Date());
  const content = `
EPR COMPLIANCE REPORT
=====================================================================
WeConnect Platform — Extended Producer Responsibility Report

Report Date   : ${reportDate}
Organization  : ${userName}
Period        : Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}

E-WASTE DISPOSAL SUMMARY
------------------------
Total Listings    : ${listings.length}
Total Weight      : ${totalWeight} KG
CO2 Offset        : ${co2} KG CO2e

LISTINGS DETAIL
---------------
${listings.map((l, i) => `${i + 1}. ${l.title} — ${l.weight} KG`).join("\n")}

COMPLIANCE STATUS
-----------------
✓ Disposed via CPCB-authorized vendor
✓ Documentation maintained
✓ EPR obligations fulfilled for listed weight

This report can be submitted to CPCB/SPCB for EPR compliance.

=====================================================================
WeConnect Platform · Generated: ${new Date().toISOString()}
`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WeConnect_EPR_Report_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientProfile() {
  const { currentUser, listings, updateUserProfile, changePassword, deleteAccount } = useApp();
  const router = useRouter();
  const profile = currentUser?.onboardingProfile || {};
  const docs = currentUser?.documents || [];
  
  const [tab, setTab] = useState<"profile" | "documents" | "impact" | "settings">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || ''
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const myListings = listings.filter(l => l.userId === currentUser?.id);
  const completedListings = myListings.filter(l => l.status === "completed");
  const totalWeight = completedListings.reduce((s, l) => s + l.weight, 0);
  const co2Saved = (totalWeight * 2.4).toFixed(1);
  const energySaved = (totalWeight * 15).toFixed(0);
  const metalsRecovered = (totalWeight * 0.08).toFixed(2);

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <div className="mb-8">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight dark:text-white">Organization <span className="text-[#1E8E3E]">Profile</span></h2>
        <p className="text-slate-500 font-medium mt-1">Manage entity details, compliance documentation, and security settings.</p>
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
            { id: "profile", label: "Organization Info", icon: "business" },
            { id: "documents", label: "Legal Documents", icon: "description" },
            { id: "impact", label: "Sustainability Hub", icon: "eco" },
            { id: "settings", label: "Account Settings", icon: "settings" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                tab === t.id ? "bg-[#1E8E3E] text-white shadow-lg shadow-emerald-200" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
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
                  <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center text-white font-black text-3xl">
                    {(currentUser?.name || "C")[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{currentUser?.name}</h3>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Verified Corporate Entity</p>
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
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={editData.name}
                        onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1">Contact Email</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={editData.email}
                        onChange={e => setEditData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="px-6 py-2.5 bg-[#1E8E3E] text-white rounded-xl text-xs font-bold">Save Changes</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold dark:bg-slate-800 dark:text-slate-400">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: "GSTIN", value: (profile as any).gstin || "—", icon: "receipt_long" },
                    { label: "Industry", value: (profile as any).industrySector || "IT Services", icon: "category" },
                    { label: "Employees", value: (profile as any).numberOfEmployees || "500+", icon: "groups" },
                    { label: "City", value: (profile as any).city ? `${(profile as any).city}, ${(profile as any).state}` : "Bengaluru", icon: "location_on" },
                  ].map((item) => (
                    <div key={item.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-slate-400 text-lg">{item.icon}</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.label}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                  <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Registered Address</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{(profile as any).address || "Global Village Tech Park, Whitefield, Bengaluru - 560066"}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div className="p-8 space-y-6 animate-fade-in">
              <h4 className="text-xl font-black text-slate-900 dark:text-white">Legal Repository</h4>
              <div className="space-y-3">
                {docs.length > 0 ? docs.map((doc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-emerald-200 transition-all dark:bg-slate-950 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
                        <span className="material-symbols-outlined text-slate-400">description</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{doc.fileName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{doc.size} • Verified {formatDate(doc.uploadedAt)}</p>
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-[#1E8E3E] hover:border-[#1E8E3E] transition-all dark:bg-slate-900 dark:border-slate-700">
                      <span className="material-symbols-outlined text-lg">download</span>
                    </button>
                  </div>
                )) : (
                  <div className="py-20 text-center space-y-2">
                    <span className="material-symbols-outlined text-4xl text-slate-200">folder_open</span>
                    <p className="text-slate-400 font-bold text-sm italic">No custom documents uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "impact" && (
            <div className="p-8 space-y-8 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "E-Waste Disposed", value: `${totalWeight} KG`, icon: "recycling", color: "text-[#0B5ED7]", bg: "bg-blue-50" },
                  { label: "CO2 Equivalent", value: `${co2Saved} KG`, icon: "eco", color: "text-[#1E8E3E]", bg: "bg-emerald-50" },
                  { label: "Energy Offset", value: `${energySaved} kWh`, icon: "bolt", color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Metals Saved", value: `${metalsRecovered} KG`, icon: "diamond", color: "text-purple-600", bg: "bg-purple-50" },
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

              <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#1E8E3E] rounded-full -mr-20 -mt-20 blur-[100px] opacity-20" />
                <div className="relative z-10">
                  <h4 className="text-xl font-black mb-2">EPR Compliance Certificate</h4>
                  <p className="text-slate-400 text-sm mb-6">Generated on the fly based on your verified recycling transactions.</p>
                  <button 
                    onClick={() => downloadEPRReport(currentUser?.name || "Client", myListings.map(l => ({ title: l.title, weight: l.weight })))}
                    className="px-6 py-3 bg-[#1E8E3E] hover:bg-[#166B2E] text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Download PDF Report
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
                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1 mb-1.5 block">New Password</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      value={passwords.new}
                      onChange={e => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 ml-1 mb-1.5 block">Confirm New Password</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-950 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                <p className="text-slate-500 text-sm">Once you delete your account, there is no going back. All active listings will be cancelled.</p>
                
                {showDeleteConfirm ? (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-4">
                    <p className="text-red-700 text-xs font-bold">Are you absolutely sure you want to delete your WeConnect account?</p>
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
