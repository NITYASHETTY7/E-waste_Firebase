"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

type Step = "email" | "otp" | "password" | "done";

interface Props {
  accentColor?: string;
  onClose: () => void;
}

export default function ForgotPasswordModal({
  accentColor = "#0B5ED7",
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      if (res.data?.devOtp) setDevOtp(res.data.devOtp);
      setStep("otp");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "No account found with that email address."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    setStep("password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword });
      setStep("done");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Invalid or expired OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-700 relative"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}18` }}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: accentColor }}
                  >
                    lock_reset
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Reset Password
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    We'll send an OTP to your email
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-sm">
                    error
                  </span>
                  <p className="text-red-700 text-xs font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700 dark:focus:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: accentColor }}
                  className="w-full py-4 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-lg">
                      progress_activity
                    </span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">
                        send
                      </span>
                      Send OTP
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}18` }}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: accentColor }}
                  >
                    verified
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Enter OTP
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Sent to {email}
                  </p>
                </div>
              </div>

              {/* Dev OTP display removed per user request */}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-sm">
                    error
                  </span>
                  <p className="text-red-700 text-xs font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block">
                    6-Digit Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="• • • • • •"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xl tracking-[0.5em] text-center placeholder:text-slate-400 placeholder:tracking-normal focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700 dark:focus:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  style={{ backgroundColor: accentColor }}
                  className="w-full py-4 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-lg">
                    check_circle
                  </span>
                  Verify Code
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(""); setOtp(""); }}
                  className="w-full py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-colors"
                >
                  ← Back
                </button>
              </form>
            </motion.div>
          )}

          {step === "password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}18` }}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: accentColor }}
                  >
                    password
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    New Password
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Choose a strong password
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-sm">
                    error
                  </span>
                  <p className="text-red-700 text-xs font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="relative">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block">
                    New Password
                  </label>
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full px-4 py-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700 dark:focus:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-4 bottom-3.5 text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPw ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1 mb-2 block">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all dark:bg-slate-950 dark:text-white dark:border-slate-700 dark:focus:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: accentColor }}
                  className="w-full py-4 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-lg">
                      progress_activity
                    </span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">
                        save
                      </span>
                      Reset Password
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${accentColor}18` }}
              >
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ color: accentColor }}
                >
                  check_circle
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                Password Reset!
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                Your password has been updated. You can now log in with your new
                password.
              </p>
              <button
                onClick={onClose}
                style={{ backgroundColor: accentColor }}
                className="px-8 py-3 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-xl hover:opacity-90 transition-all active:scale-[0.98]"
              >
                Back to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
