"use client";

import { usePathname } from "next/navigation";

const steps = [
  { num: 1, label: "Profile" },
  { num: 2, label: "Documents" },
  { num: 3, label: "Bank Details" },
  { num: 4, label: "OTP Verify" },
];

function getCurrentStep(pathname: string): number {
  if (pathname.includes("step1")) return 1;
  if (pathname.includes("step2")) return 2;
  if (pathname.includes("step3")) return 3;
  if (pathname.includes("step4")) return 4;
  return 1;
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStep = getCurrentStep(pathname);

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[color:var(--color-outline-variant)]/30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo%202.svg" 
              alt="We Connect" 
              className="h-12 md:h-16 w-auto object-contain"
            />
          </div>

          {/* Step Progress */}
          <div className="hidden md:flex items-center gap-0">
            {steps.map((step, idx) => {
              const isDone = currentStep > step.num;
              const isActive = currentStep === step.num;
              return (
                <div key={step.num} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isDone ? "bg-[color:var(--color-primary)] text-white" :
                      isActive ? "bg-[color:var(--color-tertiary)] text-white scale-110 shadow-lg" :
                      "bg-[color:var(--color-surface-dim)] text-[color:var(--color-on-surface-variant)]"
                    }`}>
                      {isDone ? <span className="material-symbols-outlined text-sm">check</span> : step.num}
                    </div>
                    <span className={`text-[9px] uppercase tracking-wider font-bold ${
                      isActive ? "text-[color:var(--color-on-surface)]" : "text-[color:var(--color-on-surface-variant)]"
                    }`}>{step.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mt-[-10px] mx-1 transition-all ${
                      isDone ? "bg-[color:var(--color-primary)]" : "bg-[color:var(--color-outline-variant)]"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          <a href="/" className="text-xs font-bold text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-on-surface)] transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Login
          </a>
        </div>

        {/* Mobile progress bar */}
        <div className="md:hidden mt-3 max-w-4xl mx-auto">
          <div className="flex justify-between text-[10px] font-bold text-[color:var(--color-on-surface-variant)] uppercase tracking-widest mb-2">
            <span>Step {currentStep} of 4</span>
            <span>{steps[currentStep - 1]?.label}</span>
          </div>
          <div className="h-1.5 bg-[color:var(--color-surface-dim)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[color:var(--color-tertiary)] rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center p-6 pt-10 pb-16">
        <div className="w-full max-w-2xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
