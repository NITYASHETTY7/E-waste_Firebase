"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { motion } from "framer-motion";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

export default function AdminLoginPage() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const router = useRouter();
  const { login } = useApp();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login("admin", loginEmail, loginPassword);
      router.push("/admin/dashboard");
    } catch {
      setError("Invalid administrative credentials or unauthorized access.");
    } finally {
      setLoading(false);
    }
  };

  const quickDemo = () => {
    setLoginEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@weconnect.com");
    setLoginPassword("password");
  };

  return (
    <>
      {showForgot && (
        <ForgotPasswordModal accentColor="#0B5ED7" onClose={() => setShowForgot(false)} />
      )}
      <div className="min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden bg-[#F5F7FA] dark:bg-slate-950">
      {/* Brand Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#0B5ED7]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#1E8E3E]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10 px-4">
        {/* Security Badge */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-4 flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm dark:bg-slate-900 dark:border-slate-700"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center dark:bg-slate-800">
              <span className="material-symbols-outlined text-slate-500 text-base">shield_lock</span>
            </div>
            <div className="flex flex-col">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none">Administrative Control</p>
              <button onClick={quickDemo} className="text-[9px] font-black text-[#0B5ED7] uppercase tracking-widest hover:underline text-left mt-0.5">Quick Demo Login</button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full">
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em]">Live</span>
          </div>
        </motion.div>

        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden relative dark:bg-slate-900 dark:border-slate-700">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#0B5ED7]/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Branding */}
          <div className="flex justify-center mb-8 cursor-pointer" onClick={() => router.push('/')}>
            <img src="/logo%203.png" alt="We Connect" className="h-8 object-contain" />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-black text-slate-900 mb-1 tracking-tight dark:text-white">Access Portal</h2>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em]">Enterprise Login</p>
          </div>

          {error && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-red-500 text-sm">error</span>
              <p className="text-red-700 text-xs font-bold">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6" suppressHydrationWarning>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block">Admin Identifier</label>
              <input type="text" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder={process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@weconnect.com"}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-[#0B5ED7] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white focus:ring-4 focus:ring-[#0B5ED7]/5 outline-none transition-all font-medium dark:bg-slate-950 dark:text-white dark:border-slate-700" 
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Pin Code</label>
                <button type="button" onClick={() => setShowForgot(true)} className="text-[10px] font-black text-[#0B5ED7] uppercase tracking-widest hover:underline">Reset</button>
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-[#0B5ED7] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white focus:ring-4 focus:ring-[#0B5ED7]/5 outline-none transition-all font-mono dark:bg-slate-950 dark:text-white dark:border-slate-700" 
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors">
                  <span className="material-symbols-outlined text-xl">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-5 bg-[#0B5ED7] text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl mt-8 hover:bg-[#084295] shadow-xl hover:shadow-[#0B5ED7]/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
              {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">admin_panel_settings</span> Secure Admin Login</>}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.4em]">Proprietary System — Unauthorized trace will occur</p>
          </div>
        </div>
      </div>
    </div>
  </>
  );
}



