"use client";

import { useApp } from "@/context/AppContext";
import { motion } from "framer-motion";

export default function UserProfilePage() {
  const { currentUser } = useApp();

  const fields = [
    { label: "Full Name", value: currentUser?.name },
    { label: "Email", value: currentUser?.email },
    { label: "Phone", value: (currentUser as any)?.phone ?? "—" },
    { label: "Role", value: "Individual User" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Profile</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Your account information</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <span className="text-2xl font-black text-purple-600">{currentUser?.name?.[0]?.toUpperCase() ?? "U"}</span>
          </div>
          <div>
            <p className="font-black text-xl text-slate-900 dark:text-white">{currentUser?.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{currentUser?.email}</p>
            <span className="mt-1 inline-block px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-widest rounded-full">Individual User</span>
          </div>
        </div>

        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.label} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{f.label}</p>
              <p className="font-bold text-slate-900 dark:text-white text-sm">{f.value ?? "—"}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
