"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function ConsumerPickup() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    pincode: "",
    itemCategories: [] as string[],
    estimatedWeight: "1-5 KG",
    preferredDate: "",
    preferredTime: "Morning (9 AM - 12 PM)",
    notes: ""
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const CATEGORIES = [
    { id: "mobile", icon: "smartphone", label: "Mobile / Tablet" },
    { id: "laptop", icon: "laptop_mac", label: "Laptop / Desktop" },
    { id: "appliances", icon: "kitchen", label: "Home Appliances" },
    { id: "batteries", icon: "battery_charging_full", label: "Batteries / Cables" },
  ];

  const handleToggleCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      itemCategories: prev.itemCategories.includes(cat) 
        ? prev.itemCategories.filter(c => c !== cat) 
        : [...prev.itemCategories, cat]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1200));
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[color:var(--color-surface)] flex items-center justify-center p-4">
        <div className="card p-10 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
          </div>
          <h2 className="text-2xl font-headline font-extrabold text-slate-900 dark:text-white">Pickup Scheduled!</h2>
          <p className="text-slate-500 text-sm">Your items will be collected by a verified WeConnect partner on {formData.preferredDate}. You'll receive a confirmation SMS shortly.</p>
          <div className="pt-6">
            <button onClick={() => router.push("/")} className="btn-primary w-full py-3 rounded-xl font-bold">Return Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-surface)] pb-20">
      {/* Simple Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 dark:bg-slate-900 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
            <img 
              src="/logo%202.svg" 
              alt="We Connect" 
              className="h-10 w-auto object-contain"
            />
          </div>
          <button onClick={() => router.push("/")} className="text-xs font-bold text-slate-500 hover:text-slate-900">Cancel</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-headline font-extrabold text-slate-900 tracking-tight mb-2 dark:text-white">Schedule a Pickup</h1>
          <p className="text-slate-500">Recycle your household e-waste responsibly and earn green rewards.</p>
        </div>

        {/* Progress bar */}
        <div className="flex justify-between mb-8 relative">
           <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-200 -z-10" />
           <div className="absolute top-1/2 left-0 h-[2px] bg-emerald-500 transition-all duration-500 -z-10" 
                style={{ width: `${(step - 1) * 50}%` }} />
           
           {[1, 2, 3].map(i => (
             <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-500 shadow-sm ${
               step >= i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 border border-slate-200"
             }`}>
               {step > i ? <span className="material-symbols-outlined text-sm">check</span> : i}
             </div>
           ))}
        </div>

        <div className="card p-6 md:p-8 shadow-xl border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800">
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="font-headline font-bold text-xl text-slate-900 mb-4 dark:text-white">What do you want to recycle?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <button type="button" key={cat.id} onClick={() => handleToggleCategory(cat.id)}
                      className={`p-4 rounded-xl border-2 text-left flex flex-col items-center justify-center gap-2 transition-all ${
                        formData.itemCategories.includes(cat.id)
                          ? "border-emerald-500 bg-emerald-50" 
                          : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}>
                      <span className={`material-symbols-outlined text-3xl ${formData.itemCategories.includes(cat.id) ? "text-emerald-600" : "text-slate-400"}`}>
                        {cat.icon}
                      </span>
                      <span className={`text-xs font-bold ${formData.itemCategories.includes(cat.id) ? "text-emerald-800" : "text-slate-600"}`}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
                
                <div className="pt-4">
                   <label className="label">Estimated Weight</label>
                   <select className="input-base" value={formData.estimatedWeight} onChange={e => setFormData({...formData, estimatedWeight: e.target.value})}>
                     <option>Under 1 KG</option>
                     <option>1-5 KG</option>
                     <option>5-15 KG</option>
                     <option>15+ KG (Bulk)</option>
                   </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-fade-in">
                 <h3 className="font-headline font-bold text-xl text-slate-900 mb-4 dark:text-white">Location Details</h3>
                 <div>
                   <label className="label">Full Name</label>
                   <input required type="text" className="input-base" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
                 <div>
                   <label className="label">Mobile Number</label>
                   <input required type="tel" className="input-base" placeholder="+91" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                 </div>
                 <div>
                   <label className="label">Pickup Address</label>
                   <textarea required className="input-base min-h-[100px]" placeholder="Door No, Street Name, Landmark" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                 </div>
                 <div>
                   <label className="label">Pincode</label>
                   <input required type="text" className="input-base" placeholder="e.g. 560001" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
                 </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-fade-in">
                 <h3 className="font-headline font-bold text-xl text-slate-900 mb-4 dark:text-white">Schedule Details</h3>
                 <div>
                   <label className="label">Preferred Date</label>
                   <input required type="date" className="input-base" value={formData.preferredDate} onChange={e => setFormData({...formData, preferredDate: e.target.value})} />
                 </div>
                 <div>
                   <label className="label">Preferred Time Slot</label>
                   <select className="input-base" value={formData.preferredTime} onChange={e => setFormData({...formData, preferredTime: e.target.value})}>
                     <option>Morning (9 AM - 12 PM)</option>
                     <option>Afternoon (12 PM - 4 PM)</option>
                     <option>Evening (4 PM - 7 PM)</option>
                   </select>
                 </div>
                 <div>
                   <label className="label">Any Special Instructions? (Optional)</label>
                   <textarea className="input-base h-20" placeholder="e.g. Leave at security, call before arrival" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                 </div>

                 <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-6">
                    <p className="text-xs text-blue-800 font-medium flex items-start gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-[16px]">info</span>
                      We ensure 100% data wiping for all collected laptops and mobile devices before recycling. A certificate of destruction will be emailed to you.
                    </p>
                 </div>
              </div>
            )}

            <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              {step > 1 && (
                <button type="button" onClick={() => setStep(step - 1)} className="btn-outline px-6 py-3.5 rounded-xl font-bold flex-1 max-w-[140px]">
                  Back
                </button>
              )}
              <button type="submit" disabled={isSubmitting || (step === 1 && formData.itemCategories.length === 0)} 
                className="btn-primary w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <><span className="material-symbols-outlined animate-spin">progress_activity</span> Processing...</>
                ) : (
                  step < 3 ? "Continue" : "Confirm Pickup"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
