"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

type AuthTab = "login" | "register";
type RegStep = 1 | 2 | 3;

function InputField({ label, type = "text", value, onChange, placeholder, required = true, disabled = false }: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  required?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">{label}</label>
      <input
        type={type} required={required} disabled={disabled}
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/5 outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700 dark:focus:bg-slate-800 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

function UserLoginPageContent() {
  const router = useRouter();
  const { login } = useApp();

  const [tab, setTab] = useState<AuthTab>("login");
  const [step, setStep] = useState<RegStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Step 1 — personal info
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [address, setAddress] = useState("");

  // Step 2 — PAN + bank
  const [pan, setPan] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankType, setBankType] = useState("savings");

  // Step 3 — OTP
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [devEmailOtp, setDevEmailOtp] = useState("");
  const [devPhoneOtp, setDevPhoneOtp] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login("user" as any, loginEmail, loginPassword);
      router.push("/user/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Login failed. Please check your credentials.");
    } finally { setLoading(false); }
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const regRes = await api.post('/auth/register', { name, email, password, phone, role: 'USER' });
      localStorage.setItem('ecoloop_token', regRes.data.access_token);
      await api.patch('/user-products/me/profile', { dob, address });
      const otpRes = await api.post('/auth/send-otp', { email, phone });
      setDevEmailOtp(otpRes.data?.devEmailOtp ?? "");
      setDevPhoneOtp(otpRes.data?.devPhoneOtp ?? "");
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.patch('/user-products/me/profile', {
        panNumber: pan,
        bankAccountHolder: bankHolder,
        bankName,
        bankAccountNumber: bankAccount,
        bankIfscCode: bankIfsc,
        bankAccountType: bankType,
      });
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to save details. Please try again.");
    } finally { setLoading(false); }
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (!emailVerified && emailOtp.length === 6) {
        const res = await api.post('/auth/verify-otp', { email, code: emailOtp, type: 'email' });
        if (!res.data?.verified) { setError(res.data?.message || "Invalid email OTP"); setLoading(false); return; }
        setEmailVerified(true);
      }
      if (!phoneVerified && phoneOtp.length === 6) {
        const res = await api.post('/auth/verify-otp', { email, code: phoneOtp, type: 'phone' });
        if (!res.data?.verified) { setError(res.data?.message || "Invalid phone OTP"); setLoading(false); return; }
        setPhoneVerified(true);
      }
      await api.post('/auth/complete-verification', { email }).catch(() => {});
      localStorage.removeItem('ecoloop_token');
      setRegistrationComplete(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Verification failed. Please try again.");
    } finally { setLoading(false); }
  };

  const stepLabels = ["Personal Info", "PAN & Bank", "Verify OTP"];

  return (
    <>
      {showForgot && <ForgotPasswordModal accentColor="#7C3AED" onClose={() => setShowForgot(false)} />}
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#F5F7FA] dark:bg-slate-950">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[520px] relative z-10">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden relative dark:bg-slate-900 dark:border-slate-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-center mb-8 cursor-pointer" onClick={() => router.push('/')}>
              <img src="/logo%203.png" alt="WeConnect" className="h-10 object-contain" />
            </div>

            {/* Registration complete — pending admin approval */}
            {registrationComplete && (
              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-3xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-purple-600 text-4xl">hourglass_top</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Registration Submitted!</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Your account is <strong className="text-purple-600">pending admin approval</strong>.<br />
                  You will receive an email once approved (usually within 24–72 hours).
                </p>
                <button onClick={() => { setRegistrationComplete(false); setTab("login"); setStep(1); }}
                  className="w-full py-4 bg-purple-600 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-purple-700 transition-all">
                  Back to Sign In
                </button>
              </div>
            )}

            {/* Tab switcher — visible on login tab or register step 1 */}
            {!registrationComplete && (tab === "login" || step === 1) && (
              <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                {(["login", "register"] as const).map(t => (
                  <button key={t} onClick={() => { setTab(t); setError(""); setStep(1); }}
                    className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${tab === t ? "bg-purple-600 text-white shadow-lg shadow-purple-700/20" : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"}`}>
                    {t === "login" ? "Sign In" : "Register"}
                  </button>
                ))}
              </div>
            )}

            {/* Step indicator for steps 2 & 3 */}
            {!registrationComplete && tab === "register" && step > 1 && (
              <div className="mb-8">
                <div className="flex items-center gap-0">
                  {stepLabels.map((l, i) => (
                    <div key={l} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${step > i + 1 ? 'bg-purple-600 text-white' : step === i + 1 ? 'bg-purple-600 text-white ring-4 ring-purple-500/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                          {step > i + 1 ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{l}</span>
                      </div>
                      {i < stepLabels.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full ${step > i + 1 ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!registrationComplete && error && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                <span className="material-symbols-outlined text-red-500 text-sm">error</span>
                <p className="text-red-700 text-xs font-bold">{error}</p>
              </motion.div>
            )}

            {!registrationComplete && <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.div key="login" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Individual Portal</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Sell your e-waste directly</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-5">
                    <InputField label="Email" type="email" value={loginEmail} onChange={setLoginEmail} placeholder="you@email.com" />
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 dark:text-slate-400">Password</label>
                        <button type="button" onClick={() => setShowForgot(true)} className="text-[10px] font-black text-purple-600 uppercase tracking-widest hover:underline">Forgot?</button>
                      </div>
                      <div className="relative">
                        <input type={showPw ? "text" : "password"} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/5 outline-none transition-all font-mono dark:bg-slate-950 dark:text-white dark:border-slate-700" />
                        <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                          <span className="material-symbols-outlined text-xl">{showPw ? "visibility_off" : "visibility"}</span>
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full py-5 bg-purple-600 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl mt-8 hover:bg-purple-700 hover:shadow-2xl hover:shadow-purple-700/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
                      {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">person</span> Sign In</>}
                    </button>
                  </form>
                </motion.div>

              ) : step === 1 ? (
                <motion.div key="reg-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Create Your Account</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Step 1 of 3 — Personal Details</p>
                  </div>
                  <form onSubmit={handleStep1} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Full Name" value={name} onChange={setName} placeholder="Rahul Sharma" />
                      <InputField label="Date of Birth" type="date" value={dob} onChange={setDob} placeholder="" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="+91 9876543210" />
                      <InputField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
                    </div>
                    <InputField label="Full Address (with city, state & PIN)" value={address} onChange={setAddress} placeholder="123 Main St, Bengaluru, Karnataka 560001" />
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 chars" />
                      <InputField label="Confirm Password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat" />
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full py-5 bg-purple-600 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl mt-2 hover:bg-purple-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
                      {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">arrow_forward</span> Continue</>}
                    </button>
                  </form>
                </motion.div>

              ) : step === 2 ? (
                <motion.div key="reg-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">PAN & Bank Details</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Step 2 of 3 — For payment processing</p>
                  </div>
                  <form onSubmit={handleStep2} className="space-y-4">
                    <InputField label="PAN Card Number" value={pan} onChange={v => setPan(v.toUpperCase())} placeholder="ABCDE1234F" />
                    <InputField label="Account Holder Name" value={bankHolder} onChange={setBankHolder} placeholder="Name as on bank account" />
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Bank Name" value={bankName} onChange={setBankName} placeholder="State Bank of India" />
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block dark:text-slate-400">Account Type</label>
                        <select value={bankType} onChange={e => setBankType(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700">
                          <option value="savings">Savings</option>
                          <option value="current">Current</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Account Number" value={bankAccount} onChange={setBankAccount} placeholder="1234567890" />
                      <InputField label="IFSC Code" value={bankIfsc} onChange={v => setBankIfsc(v.toUpperCase())} placeholder="SBIN0001234" />
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button type="button" onClick={() => { setStep(1); setError(""); }}
                        className="flex-1 py-5 border border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 transition-all">
                        Back
                      </button>
                      <button type="submit" disabled={loading}
                        className="flex-1 py-5 bg-purple-600 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">arrow_forward</span> Continue</>}
                      </button>
                    </div>
                  </form>
                </motion.div>

              ) : (
                <motion.div key="reg-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-purple-600 text-3xl">verified</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Verify Your Account</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Step 3 of 3 — OTP Verification</p>
                  </div>

                  {(devEmailOtp || devPhoneOtp) && (
                    <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl dark:bg-amber-900/20 dark:border-amber-800">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Dev Mode — OTP Codes</p>
                      {devEmailOtp && <p className="text-xs text-amber-800 font-mono dark:text-amber-300">Email OTP: <strong>{devEmailOtp}</strong></p>}
                      {devPhoneOtp && <p className="text-xs text-amber-800 font-mono dark:text-amber-300">Phone OTP: <strong>{devPhoneOtp}</strong></p>}
                    </div>
                  )}

                  <form onSubmit={handleStep3} className="space-y-5">
                    {([
                      { label: "Email OTP", value: emailOtp, set: setEmailOtp, verified: emailVerified, sentTo: email },
                      { label: "Phone OTP", value: phoneOtp, set: setPhoneOtp, verified: phoneVerified, sentTo: phone },
                    ] as const).map(({ label, value, set, verified, sentTo }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 dark:text-slate-400">{label}</label>
                          {verified && <span className="text-[10px] font-black text-purple-600 flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>Verified</span>}
                        </div>
                        <input type="text" inputMode="numeric" maxLength={6}
                          value={value} onChange={e => (set as any)(e.target.value.replace(/\D/g, ''))}
                          disabled={verified} placeholder="6-digit code"
                          className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl font-mono text-lg tracking-[0.5em] text-center placeholder:text-slate-400 placeholder:tracking-normal outline-none transition-all dark:bg-slate-950 dark:text-white ${verified ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5'}`} />
                        <p className="text-[10px] text-slate-500 ml-1 mt-1">Sent to {sentTo}</p>
                      </div>
                    ))}
                    <button type="submit"
                      disabled={loading || (!emailVerified && emailOtp.length < 6) || (!phoneVerified && phoneOtp.length < 6)}
                      className="w-full py-5 bg-purple-600 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-purple-700 hover:shadow-2xl hover:shadow-purple-700/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
                      {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : <><span className="material-symbols-outlined text-lg">verified_user</span> Verify & Submit</>}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function UserLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-slate-950"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <UserLoginPageContent />
    </Suspense>
  );
}
