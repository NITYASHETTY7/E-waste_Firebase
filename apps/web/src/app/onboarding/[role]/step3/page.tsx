"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { BankDetails } from "@/types";

const BANKS = [
  "State Bank of India","HDFC Bank","ICICI Bank","Axis Bank","Kotak Mahindra Bank",
  "Punjab National Bank","Bank of Baroda","Canara Bank","IndusInd Bank","Yes Bank",
  "Federal Bank","IDFC First Bank","Union Bank of India","Indian Bank","Bank of India",
  "UCO Bank","Bank of Maharashtra","Other",
];

export default function OnboardingStep3() {
  const params = useParams();
  const role = params.role as string;
  const router = useRouter();
  const { currentUser, pendingOnboardingRole, saveOnboardingBankDetails } = useApp();
  const effectiveRole = role || pendingOnboardingRole || currentUser?.role || "client";
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<Partial<BankDetails>>({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    accountType: "current",
  });
  const [confirmAccount, setConfirmAccount] = useState("");
  const [chequeFile, setChequeFile] = useState<string | null>(null);
  const [chequeRawFile, setChequeRawFile] = useState<File | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ifscLoading, setIfscLoading] = useState(false);
  const [branchName, setBranchName] = useState("");

  const set = (key: keyof BankDetails, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => { const n = { ...prev }; delete n[key as string]; return n; });
  };

  const lookupIFSC = async (code: string) => {
    if (code.length !== 11) { setBranchName(""); return; }
    setIfscLoading(true);
    // Simulate IFSC lookup
    await new Promise(r => setTimeout(r, 800));
    const fakeData: Record<string, string> = {
      "SBIN0001234": "SBI - MG Road Branch, Bangalore",
      "HDFC0001234": "HDFC Bank - Koramangala Branch",
      "ICIC0001234": "ICICI Bank - Whitefield Branch",
    };
    setBranchName(fakeData[code] || code.startsWith("SBIN") ? "State Bank of India Branch" : "Bank Branch (Demo)");
    setIfscLoading(false);
  };


  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.accountHolderName?.trim()) e.accountHolderName = "Required";
    if (effectiveRole === "consumer" && !chequeFile) e.cheque = "Cancelled cheque is required for individuals";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    saveOnboardingBankDetails(form as BankDetails, chequeRawFile || undefined);
    router.push(`/onboarding/${effectiveRole}/step4`);
  };

  return (
    <div>
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 bg-[color:var(--color-secondary-container)] text-[color:var(--color-on-secondary-container)] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
          <span className="material-symbols-outlined text-sm">account_balance</span>
          Step 3 — Bank Details
        </span>
        <h1 className="text-3xl font-headline font-extrabold text-[color:var(--color-on-surface)] tracking-tight">
          Payment Information
        </h1>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">
          Your bank details are required for secure payment settlements after successful bids.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="card p-6 space-y-5">
          <div>
            <label className="label">Account Holder Name *</label>
            <input className={`input-base ${errors.accountHolderName ? "ring-2 ring-red-400" : ""}`}
              value={form.accountHolderName} onChange={e => set("accountHolderName", e.target.value)}
              placeholder="Exactly as on bank records" />
            {errors.accountHolderName && <p className="text-red-500 text-xs mt-1">{errors.accountHolderName}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Bank Name *</label>
              <select className={`input-base ${errors.bankName ? "ring-2 ring-red-400" : ""}`}
                value={form.bankName} onChange={e => set("bankName", e.target.value)}>
                <option value="">Select Bank</option>
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
              {errors.bankName && <p className="text-red-500 text-xs mt-1">{errors.bankName}</p>}
            </div>
            <div>
              <label className="label">Account Type *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {["current", "savings"].map(type => (
                  <button key={type} type="button"
                    onClick={() => set("accountType", type as "current" | "savings")}
                    className={`py-2.5 rounded-lg text-xs font-black uppercase tracking-wider border-2 transition-all ${
                      form.accountType === type
                        ? "bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] border-[color:var(--color-primary)]"
                        : "bg-[color:var(--color-surface)] text-[color:var(--color-on-surface-variant)] border-[color:var(--color-outline-variant)] hover:bg-[color:var(--color-surface-variant)]"
                    }`}
                  >
                    {type === "current" ? "Current" : "Savings"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Account Number *</label>
            <div className="relative">
              <input
                type={showAccount ? "text" : "password"}
                className={`input-base font-mono !pr-12 ${errors.accountNumber ? "ring-2 ring-red-400" : ""}`}
                value={form.accountNumber} onChange={e => set("accountNumber", e.target.value.replace(/\D/g, ""))}
                placeholder="Enter account number"
              />
              <button type="button" onClick={() => setShowAccount(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-on-surface-variant)]">
                <span className="material-symbols-outlined text-lg">{showAccount ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
            {errors.accountNumber && <p className="text-red-500 text-xs mt-1">{errors.accountNumber}</p>}
          </div>

          <div>
            <label className="label">Confirm Account Number *</label>
            <input type="password" className={`input-base font-mono ${errors.confirmAccount ? "ring-2 ring-red-400" : ""}`}
              value={confirmAccount} onChange={e => { setConfirmAccount(e.target.value.replace(/\D/g, "")); setErrors(p => { const n = {...p}; delete n.confirmAccount; return n; }); }}
              placeholder="Re-enter account number" />
            {errors.confirmAccount && <p className="text-red-500 text-xs mt-1">{errors.confirmAccount}</p>}
          </div>

          <div>
            <label className="label">IFSC Code *</label>
            <input className={`input-base font-mono uppercase ${errors.ifscCode ? "ring-2 ring-red-400" : ""}`}
              value={form.ifscCode}
              onChange={e => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
                set("ifscCode", val);
                lookupIFSC(val);
              }}
              placeholder="SBIN0001234" maxLength={11} />
            {errors.ifscCode && <p className="text-red-500 text-xs mt-1">{errors.ifscCode}</p>}
            {ifscLoading && <p className="text-xs text-[color:var(--color-on-surface-variant)] mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Verifying IFSC...</p>}
            {branchName && !ifscLoading && (
              <p className="text-xs text-[color:var(--color-primary)] font-bold mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {branchName}
              </p>
            )}
          </div>
        </div>

        {/* Cancelled Cheque */}
        <div className="card p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[color:var(--color-primary)]">note</span>
            Cancelled Cheque {effectiveRole === "consumer" ? "*" : "(Optional)"}
          </h3>
          {chequeFile ? (
            <div className="flex items-center gap-3 p-3 bg-[color:var(--color-primary-fixed)]/10 rounded-xl">
              <span className="material-symbols-outlined text-[color:var(--color-primary)]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[color:var(--color-on-surface)]">{chequeFile}</p>
                <p className="text-xs text-[color:var(--color-on-surface-variant)]">Cancelled cheque uploaded</p>
              </div>
              <button type="button" onClick={() => setChequeFile(null)}
                className="text-red-400 hover:text-red-600 transition-colors">
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[color:var(--color-outline-variant)] rounded-xl p-6 flex flex-col items-center gap-2 text-center cursor-pointer hover:border-[color:var(--color-primary)]/50 hover:bg-[color:var(--color-surface-container-low)] transition-all"
            >
              <span className="material-symbols-outlined text-3xl text-[color:var(--color-outline)]">cloud_upload</span>
              <p className="text-sm font-bold text-[color:var(--color-on-surface-variant)]">Upload Cancelled Cheque</p>
              <p className="text-xs text-[color:var(--color-on-surface-variant)]">PDF, JPG or PNG · Max 5MB · Helps with faster verification</p>
              <input type="file" ref={fileRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => { if (e.target.files?.[0]) { setChequeFile(e.target.files[0].name); setChequeRawFile(e.target.files[0]); } }} />
            </div>
          )}
          {errors.cheque && <p className="text-red-500 text-xs mt-2 font-bold">{errors.cheque}</p>}
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
          <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5">info</span>
          <p className="text-xs text-amber-200">
            <strong>Important:</strong> Ensure account details match your company name exactly. Mismatched details may delay payment settlements by 5–7 business days.
          </p>
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={() => router.back()}
            className="btn-outline flex-1 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back
          </button>
          <button type="submit"
            className="btn-tertiary flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
            Continue to Verification
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </form>
    </div>
  );
}
