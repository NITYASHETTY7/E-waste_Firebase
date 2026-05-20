"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

type AuthTab = "login" | "register";

function ClientLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useApp();

  const initialTab = (searchParams.get("tab") as AuthTab) || "login";
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // OTP verification step
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [devEmailOtp, setDevEmailOtp] = useState("");
  const [devPhoneOtp, setDevPhoneOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "login" || t === "register") {
      setActiveTab(t);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      const user = await login("client", loginEmail, loginPassword);
      if (user.role !== 'client' && user.role !== 'consumer') {
        setError(`You are registered as a ${user.role.toUpperCase()}. Please sign in from the correct portal.`);
        return;
      }
      router.push(user.role === 'consumer' ? "/consumer/dashboard" : "/client/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (regPassword !== regConfirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await register("client", regName, regEmail, regPassword, regPhone);
      router.push("/onboarding/client/step1");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let bothVerified = emailVerified && phoneVerified;

      if (!emailVerified && emailOtpCode.length === 6) {
        const res = await api.post('/auth/verify-otp', { email: otpEmail, code: emailOtpCode, type: 'email' });
        if (res.data?.verified) {
          setEmailVerified(true);
        } else {
          setError(res.data?.message || "Invalid email OTP.");
          setLoading(false);
          return;
        }
      }

      if (!phoneVerified && phoneOtpCode.length === 6) {
        const res = await api.post('/auth/verify-otp', { email: otpEmail, code: phoneOtpCode, type: 'phone' });
        if (res.data?.verified) {
          setPhoneVerified(true);
          bothVerified = true;
        } else {
          setError(res.data?.message || "Invalid phone OTP.");
          setLoading(false);
          return;
        }
      }

      if (bothVerified || (emailVerified && phoneOtpCode.length === 6)) {
        router.push("/onboarding/client/step1");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    try {
      await api.post('/auth/send-otp', { email: otpEmail, phone: otpPhone });
      setEmailVerified(false);
      setPhoneVerified(false);
      setEmailOtpCode("");
      setPhoneOtpCode("");
    } catch {
      setError("Failed to resend OTP. Please try again.");
    }
  };

  const quickDemo = () => {
    setLoginEmail("client@weconnect.com");
    setLoginPassword("password");
    setActiveTab("login");
  };

  return (
    <>
      {showForgot && (
        <ForgotPasswordModal accentColor="#1E8E3E" onClose={() => setShowForgot(false)} />
      )}
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#F5F7FA] dark:bg-slate-950">
      {/* Brand Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#1E8E3E]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#0B5ED7]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[480px] relative z-10">
        {/* Quick Demo Access Bar — hidden during OTP step */}
        {!otpStep && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6 flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm dark:bg-slate-900 dark:border-slate-700"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1E8E3E]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#1E8E3E] text-sm">info</span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Testing the portal?</p>
            </div>
            <button
              onClick={quickDemo}
              className="px-4 py-2 bg-[#1E8E3E] text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#166a2e] transition-all shadow-md active:scale-95"
            >
              Quick Demo
            </button>
          </motion.div>
        )}

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden relative dark:bg-slate-900 dark:border-slate-700">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#1E8E3E]/5 rounded-full blur-3xl pointer-events-none" />

          {/* Branding */}
          <div className="flex justify-center mb-10 cursor-pointer" onClick={() => router.push('/')}>
            <img src="/logo%203.png" alt="We Connect" className="h-10 object-contain" />
          </div>

          {/* OTP Verification Step */}
          {otpStep ? (
            <motion.div key="otp" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#1E8E3E]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[#1E8E3E] text-3xl">verified</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight dark:text-white">Verify Your Account</h2>
                <p className="text-slate-500 text-xs">OTPs sent to your email and phone</p>
              </div>

              {/* Dev mode OTP hint */}
              {(devEmailOtp || devPhoneOtp) && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Dev Mode — OTP Codes</p>
                  {devEmailOtp && <p className="text-xs text-amber-800 font-mono">Email OTP: <span className="font-black">{devEmailOtp}</span></p>}
                  {devPhoneOtp && <p className="text-xs text-amber-800 font-mono">Phone OTP: <span className="font-black">{devPhoneOtp}</span></p>}
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                  <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                  <p className="text-red-700 text-xs font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {/* Email OTP */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Email OTP</label>
                    {emailVerified && <span className="text-[10px] font-black text-[#1E8E3E] flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>Verified</span>}
                  </div>
                  <div className="relative">
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={emailOtpCode} onChange={e => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                      disabled={emailVerified}
                      placeholder="6-digit code"
                      className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl text-slate-900 font-mono text-lg tracking-[0.5em] text-center placeholder:text-slate-400 placeholder:tracking-normal focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white focus:ring-4 outline-none transition-all dark:bg-slate-950 dark:text-white ${emailVerified ? 'border-[#1E8E3E] bg-[#1E8E3E]/5' : 'border-slate-200 focus:border-[#1E8E3E] focus:ring-[#1E8E3E]/5'}`}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 ml-1 mt-1">Sent to {otpEmail}</p>
                </div>

                {/* Phone OTP */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Phone OTP</label>
                    {phoneVerified && <span className="text-[10px] font-black text-[#1E8E3E] flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>Verified</span>}
                  </div>
                  <div className="relative">
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={phoneOtpCode} onChange={e => setPhoneOtpCode(e.target.value.replace(/\D/g, ''))}
                      disabled={phoneVerified}
                      placeholder="6-digit code"
                      className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl text-slate-900 font-mono text-lg tracking-[0.5em] text-center placeholder:text-slate-400 placeholder:tracking-normal focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white focus:ring-4 outline-none transition-all dark:bg-slate-950 dark:text-white ${phoneVerified ? 'border-[#1E8E3E] bg-[#1E8E3E]/5' : 'border-slate-200 focus:border-[#1E8E3E] focus:ring-[#1E8E3E]/5'}`}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 ml-1 mt-1">Sent to {otpPhone}</p>
                </div>

                <button type="submit" disabled={loading || (emailOtpCode.length < 6 && !emailVerified) || (phoneOtpCode.length < 6 && !phoneVerified)}
                  className="w-full py-5 bg-[#1E8E3E] text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl mt-6 hover:bg-[#166a2e] hover:shadow-2xl hover:shadow-[#1E8E3E]/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">verified_user</span> Verify & Continue</>}
                </button>

                <button type="button" onClick={handleResendOtp} className="w-full py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-[#1E8E3E] transition-colors">
                  Resend OTPs
                </button>
              </form>
            </motion.div>
          ) : (
            <>
          {/* Tab Switcher */}
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-10 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
            {(["login", "register"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setActiveTab(t); setError(""); }}
                className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${
                  activeTab === t
                    ? "bg-[#1E8E3E] text-white shadow-lg shadow-emerald-700/20"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                {t === "login" ? "Sign In" : "Register"}
              </button>
            ))}
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

          <AnimatePresence mode="wait">
            {activeTab === "login" ? (
              <motion.div 
                key="login"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight dark:text-white">Client Portal</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Generator Dashboard</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block">Corporate Email</label>
                    <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      placeholder="name@company.com" 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white focus:ring-4 focus:ring-[#1E8E3E]/5 outline-none transition-all font-medium dark:bg-slate-950 dark:text-white dark:border-slate-700" 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Password</label>
                      <button type="button" onClick={() => setShowForgot(true)} className="text-[10px] font-black text-[#1E8E3E] uppercase tracking-widest hover:underline">Forgot?</button>
                    </div>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white focus:ring-4 focus:ring-[#1E8E3E]/5 outline-none transition-all font-mono dark:bg-slate-950 dark:text-white dark:border-slate-700" 
                      />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors">
                        <span className="material-symbols-outlined text-xl">{showPassword ? "visibility_off" : "visibility"}</span>
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 bg-[#1E8E3E] text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl mt-8 hover:bg-[#166a2e] hover:shadow-2xl hover:shadow-[#1E8E3E]/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
                    {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">login</span> Secure Entry</>}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="register"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight dark:text-white">Join We Connect</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Start Disposing Responsibly</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2 block">Name</label>
                      <input type="text" required value={regName} onChange={e => setRegName(e.target.value)} placeholder="John Doe" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2 block">Phone</label>
                      <input type="tel" required value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="+91..." className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2 block">Company Name</label>
                    <input type="text" required value={regCompany} onChange={e => setRegCompany(e.target.value)} placeholder="Your Ventures Pvt Ltd" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2 block">Company Email</label>
                    <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="name@company.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2 block">Password</label>
                      <input type="password" required value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Min. 8" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white outline-none transition-all font-mono dark:bg-slate-950 dark:text-white dark:border-slate-700" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2 block">Confirm</label>
                      <input type="password" required value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="Repeat" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#1E8E3E] focus:bg-white dark:focus:bg-slate-800 dark:focus:text-white outline-none transition-all font-mono dark:bg-slate-950 dark:text-white dark:border-slate-700" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 bg-[#1E8E3E] text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl mt-6 hover:bg-[#166a2e] shadow-xl hover:shadow-[#1E8E3E]/20 transition-all active:scale-[0.98]">
                    {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : "Create Client Account"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-slate-950"><div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin"></div></div>}>
      <ClientLoginPageContent />
    </Suspense>
  );
}

