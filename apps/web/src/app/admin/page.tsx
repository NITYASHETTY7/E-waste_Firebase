"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { motion } from "framer-motion";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useApp();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const success = await login("admin@weconnect.com", password);
      if (success) {
        router.push("/admin/dashboard");
      } else {
        setError("Invalid administrative credentials");
      }
    } catch (err) {
      setError("System authentication failure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 selection:bg-emerald-500/30">
        {/* Background Ambient Effect */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full" />
        </div>

        <div className="w-full max-w-[420px] relative">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800 p-8 rounded-[2rem] shadow-2xl shadow-black/50"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <span className="material-symbols-outlined text-3xl text-emerald-500 font-light">admin_panel_settings</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase italic">Admin Terminal</h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] mt-1.5">Authorized Access Only</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Token / Password</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg group-focus-within:text-emerald-500 transition-colors">lock</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-700 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-mono"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-500/10 border border-red-500/20 py-3 px-4 rounded-xl flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                  <p className="text-[11px] font-bold text-red-400">{error}</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                ) : (
                  <>
                    Establish Session
                    <span className="material-symbols-outlined text-sm">login</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-800/50 flex items-center justify-between">
              <button 
                onClick={() => setShowForgot(true)}
                className="text-[10px] font-black text-slate-500 hover:text-emerald-400 uppercase tracking-widest transition-colors"
              >
                Request Recovery
              </button>
              <a href="/" className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Public Gateway
              </a>
            </div>
          </motion.div>

          {/* System Footer */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/50 border border-slate-800">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.4em]">Proprietary System — Unauthorized trace will occur</p>
            </div>
          </div>
        </div>
      </div>

      {showForgot && (
        <ForgotPasswordModal 
          onClose={() => setShowForgot(false)}
        />
      )}
    </>
  );
}
