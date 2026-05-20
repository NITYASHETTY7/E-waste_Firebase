"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";

const CATEGORIES = [
  { icon: "monitor", label: "Display Units", desc: "Monitors, TVs, screens" },
  { icon: "laptop_mac", label: "Laptops & PCs", desc: "Computers, workstations" },
  { icon: "smartphone", label: "Mobile Devices", desc: "Phones, tablets" },
  { icon: "dns", label: "IT Equipment", desc: "Servers, networking gear" },
  { icon: "battery_charging_full", label: "Batteries", desc: "Li-ion, lead-acid" },
  { icon: "cable", label: "Cables & Wiring", desc: "Copper, fiber cables" },
  { icon: "print", label: "Printers", desc: "Laser, inkjet printers" },
  { icon: "memory", label: "Components", desc: "RAM, CPUs, circuit boards" },
  { icon: "power", label: "Power Equipment", desc: "UPS, generators" },
  { icon: "devices_other", label: "Other", desc: "Miscellaneous e-waste" },
];

const REQUIRED_DOCS = [
  { id: "auction_notice", label: "Auction Notice / Sale Notice", required: true },
  { id: "terms", label: "Terms & Conditions of Auction", required: true },
  { id: "asset_details", label: "Asset Details / Description Document", required: true },
  { id: "inventory_doc", label: "Inventory Document", required: true },
  { id: "material_list", label: "Material List (Excel Only)", required: true },
  { id: "weight_cert", label: "Weight Certificate", required: true },
  { id: "location_proof", label: "Location Proof", required: true },
  { id: "ownership", label: "Title Documents / Ownership Proof", required: true },
  { id: "encumbrance", label: "Encumbrance Certificate", required: false, optionalText: "(if applicable)" },
  { id: "inspection", label: "Inspection Report / Valuations", required: false, optionalText: "(if available)" },
  { id: "possession", label: "Possession Notice", required: false, optionalText: "(SARFAESI Act)" },
  { id: "sale_agreement", label: "Draft Sale Agreement", required: false, optionalText: "(optional)" }
];

export default function ClientPost() {
  const { addListing, currentUser, addNotification } = useApp();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [form, setForm] = useState({
    title: "", weight: "", description: "", location: "",
    pickupAddress: "", urgency: "medium" as "low" | "medium" | "high",
    invitationDeadline: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{name: string, url: string, type: string}[]>([]);
  const [rawFiles, setRawFiles] = useState<Record<string, File>>({});
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"category" | "details" | "auction" | "media">("category");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => { const n = {...p}; delete n[k]; return n; });
  };

  const handleNext = () => {
    const errs: Record<string, string> = {};
    if (step === "details") {
      if (!form.title) errs.title = "Required";
      if (!form.weight || isNaN(Number(form.weight))) errs.weight = "Valid weight required";
      if (!form.description) errs.description = "Required";
      if (!form.location) errs.location = "Required";
      if (!form.pickupAddress) errs.pickupAddress = "Required";
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      setStep("auction");
    } else if (step === "auction") {
      setStep("media");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (images.length === 0) { setErrors({ media: "Please upload at least one image." }); return; }
    const missingDocs = REQUIRED_DOCS.filter(d => d.required && !documents.some(doc => doc.type === d.id));
    if (missingDocs.length > 0) {
      setErrors({ media: `Missing required documents: ${missingDocs.map(d => d.label).join(', ')}` });
      return;
    }

    setSubmitting(true);
    try {
      await addListing({
        title: form.title,
        category: selectedCategory,
        weight: Number(form.weight),
        location: form.location,
        userId: currentUser?.id || "",
        userName: currentUser?.name || "",
        description: form.description,
        urgency: form.urgency,
        pickupAddress: form.pickupAddress,
        invitationDeadline: form.invitationDeadline ? new Date(form.invitationDeadline).toISOString() : undefined,
        images,
        documents,
        _rawFiles: rawFiles,
      } as any);
      addNotification({
        userId: currentUser?.id || "",
        type: "general",
        title: "Listing Submitted",
        message: `Your listing "${form.title}" has been submitted for admin review. You'll be notified once it's approved.`,
        link: "/client/listings",
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to submit listing. Please try again.";
      setErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-16">
        <div className="w-24 h-24 rounded-full bg-[color:var(--color-primary-fixed)] flex items-center justify-center mx-auto mb-6 animate-bounce">
          <span className="material-symbols-outlined text-5xl text-[color:var(--color-on-primary-fixed)]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
        <h2 className="text-3xl font-headline font-extrabold text-[color:var(--color-on-surface)] mb-3">Listing Submitted!</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mb-6">
          Your listing is pending admin review. Once approved, vendors selected by the admin will
          automatically receive an email invitation to place their sealed bids.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/client/listings" className="btn-primary">View My Auctions</Link>
          <a href="/client/post" className="btn-outline">Post Another</a>
        </div>
      </div>
    );
  }

  const stepsList = ["Category", "Details", "Timeline", "Documents"];
  const currentStepIndex = step === "category" ? 0 : step === "details" ? 1 : step === "auction" ? 2 : 3;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20">
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Post E-Waste Listing</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Configure your listing for a transparent, legitimate e-auction. Admin will review and select vendors.</p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 md:mx-0 md:px-0">
        {stepsList.map((s, i) => (
          <div key={s} className="flex items-center gap-2 whitespace-nowrap">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
              i < currentStepIndex ? "bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)]" :
              i === currentStepIndex ? "bg-[color:var(--color-tertiary)] text-[color:var(--color-on-tertiary)]" :
              "bg-[color:var(--color-surface-dim)] text-[color:var(--color-on-surface-variant)]"
            }`}>
              {i < currentStepIndex ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
            </div>
            <span className={`text-xs font-bold ${i <= currentStepIndex ? "text-[color:var(--color-on-surface)]" : "text-[color:var(--color-outline)]"}`}>{s}</span>
            {i !== stepsList.length - 1 && <div className="w-8 h-px bg-[color:var(--color-outline-variant)] mx-2" />}
          </div>
        ))}
      </div>

      {step === "category" && (
        <div className="animate-fade-in card p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] mb-4">Select Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {CATEGORIES.map(cat => (
              <button key={cat.label} type="button" onClick={() => setSelectedCategory(cat.label)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  selectedCategory === cat.label
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-secondary-container)]"
                    : "border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)]/30 hover:bg-[color:var(--color-surface-variant)]"
                }`}>
                <span className={`material-symbols-outlined text-3xl block mb-2 ${selectedCategory === cat.label ? "text-[color:var(--color-primary)]" : "text-slate-500"}`}
                  style={selectedCategory === cat.label ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                  {cat.icon}
                </span>
                <p className="font-black text-xs text-[color:var(--color-on-surface)] leading-tight">{cat.label}</p>
              </button>
            ))}
          </div>
          <div className="mt-8 flex justify-end">
            <button onClick={() => { if (selectedCategory) setStep("details"); }} disabled={!selectedCategory}
              className={`btn-primary px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest ${!selectedCategory ? "opacity-50" : ""}`}>
              Next Step →
            </button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="animate-fade-in space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)]">Basic Information</h3>
            <div>
              <label className="label">Listing Title *</label>
              <input className={`input-base ${errors.title ? "ring-2 ring-red-400" : ""}`} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Batch of 15 CRT Monitors" />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>
            <div>
              <label className="label">Total Weight (KG) *</label>
              <input type="number" className={`input-base ${errors.weight ? "ring-2 ring-red-400" : ""}`} value={form.weight} onChange={e => set("weight", e.target.value)} placeholder="50" min="0.1" step="0.1" />
              {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight}</p>}
            </div>
            <div>
              <label className="label">Description & Condition *</label>
              <textarea rows={3} className={`input-base resize-none ${errors.description ? "ring-2 ring-red-400" : ""}`} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe condition, quantity, special handling requirements..." />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>
          </div>
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)]">Logistics</h3>
            <div>
              <label className="label">City / Area *</label>
              <input className={`input-base ${errors.location ? "ring-2 ring-red-400" : ""}`} value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Koramangala, Bangalore" />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
            </div>
            <div>
              <label className="label">Full Pickup Address *</label>
              <textarea rows={2} className={`input-base resize-none ${errors.pickupAddress ? "ring-2 ring-red-400" : ""}`} value={form.pickupAddress} onChange={e => set("pickupAddress", e.target.value)} placeholder="Building, floor, landmark..." />
              {errors.pickupAddress && <p className="text-red-500 text-xs mt-1">{errors.pickupAddress}</p>}
            </div>
            <div>
              <label className="label">Pickup Urgency</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {[["low", "Low", "Within 2 weeks"], ["medium", "Medium", "Within 1 week"], ["high", "High", "ASAP (1–2 days)"]].map(([val, label, desc]) => (
                  <button key={val} type="button" onClick={() => set("urgency", val)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      form.urgency === val
                        ? val === "high" ? "border-red-400 bg-red-50" : val === "medium" ? "border-amber-400 bg-amber-50" : "border-[color:var(--color-primary)] bg-[color:var(--color-secondary-container)]"
                        : "border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-variant)]"
                    }`}>
                    <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
                    <p className="text-[9px] text-[color:var(--color-on-surface-variant)] mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-4 justify-between mt-8">
            <button onClick={() => setStep("category")} className="btn-outline w-full sm:w-auto px-8 py-3 rounded-xl font-bold">← Back</button>
            <button onClick={handleNext} className="btn-primary w-full sm:w-auto px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest">Next Step →</button>
          </div>
        </div>
      )}

      {step === "auction" && (
        <div className="animate-fade-in space-y-6">
          <div className="card p-6 space-y-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)]">Invitation Deadline</h3>
              <p className="text-xs text-[color:var(--color-on-surface-variant)] mt-1">Optional: deadline by which invited vendors must respond to the invitation.</p>
            </div>
            <div>
              <label className="label">Vendor Response Deadline (optional)</label>
              <input type="datetime-local" className="input-base" value={form.invitationDeadline}
                onChange={e => set("invitationDeadline", e.target.value)} />
            </div>
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-400 text-base mt-0.5">info</span>
              <p className="text-xs text-blue-200 leading-relaxed">
                <strong>Sealed bid open/close times</strong> are set by the admin when they create the sealed bid event after your audit is complete. You don't need to configure them here.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-4 justify-between mt-8">
            <button onClick={() => setStep("details")} className="btn-outline w-full sm:w-auto px-8 py-3 rounded-xl font-bold">← Back</button>
            <button onClick={handleNext} className="btn-primary w-full sm:w-auto px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest">Next Step →</button>
          </div>
        </div>
      )}

      {step === "media" && (
        <form onSubmit={handleSubmit} className="animate-fade-in space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] flex items-center justify-between">
              Images of Equipment
              <span className="text-[10px] bg-[color:var(--color-primary-container)] text-[color:var(--color-on-primary-container)] px-2 py-1 rounded">Required</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div key={i} className="aspect-square bg-[color:var(--color-surface-dim)] rounded-xl border border-[color:var(--color-outline-variant)] overflow-hidden">
                  <img src={img} alt="e-waste" className="w-full h-full object-cover" />
                </div>
              ))}
              <label className="aspect-square bg-[color:var(--color-surface)] border-2 border-dashed border-[color:var(--color-outline-variant)] rounded-xl flex flex-col items-center justify-center text-[color:var(--color-primary)] hover:bg-[color:var(--color-secondary-container)] transition-colors cursor-pointer text-center p-2">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      Array.from(e.target.files).forEach(file => {
                        const reader = new FileReader();
                        reader.onloadend = () => setImages(prev => [...prev, reader.result as string]);
                        reader.readAsDataURL(file);
                      });
                    }
                  }} />
                <span className="material-symbols-outlined text-2xl">photo_camera</span>
                <span className="text-[10px] font-black uppercase mt-2">Open Camera to Take Photo</span>
              </label>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] flex items-center justify-between">
              Legal & Compliance Documents
              <span className="text-[10px] bg-[color:var(--color-primary-container)] text-[color:var(--color-on-primary-container)] px-2 py-1 rounded">Required</span>
            </h3>
            <p className="text-xs text-[color:var(--color-on-surface-variant)] -mt-2">Upload the following critical legal documents to secure platform approval for this auction block.</p>
            <div className="space-y-3">
              {REQUIRED_DOCS.map(docReq => {
                const uploadedDoc = documents.find(d => d.type === docReq.id);
                return (
                  <div key={docReq.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border rounded-xl transition-colors ${uploadedDoc ? "bg-emerald-50/10 border-emerald-500/30" : "bg-[color:var(--color-surface)] border-[color:var(--color-outline-variant)]"}`}>
                    <div>
                      <p className="text-sm font-bold text-[color:var(--color-on-surface)] flex items-center gap-2">
                        {docReq.label}
                        {docReq.required
                          ? <span className="text-[9px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-black uppercase shadow-sm">Req</span>
                          : <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-black uppercase tracking-widest dark:bg-slate-800">{docReq.optionalText}</span>}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {uploadedDoc ? (
                        <div className="flex items-center gap-2 bg-white text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm dark:bg-slate-900">
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <span className="text-xs font-bold truncate max-w-[140px] md:max-w-[180px]">{uploadedDoc.name}</span>
                          <button type="button" onClick={() => setDocuments(documents.filter(d => d.type !== docReq.id))}
                            className="ml-2 hover:text-red-500 transition-colors">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ) : (
                        <label className="btn-outline px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg cursor-pointer flex items-center gap-2 hover:bg-slate-100 w-fit">
                          <input
                            type="file"
                            accept={docReq.id === "material_list" ? ".xlsx,.xls,.csv" : ".pdf,.doc,.docx"}
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.length) {
                                const file = e.target.files[0];
                                setRawFiles(prev => ({ ...prev, [docReq.id]: file }));
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setDocuments(prev => [
                                    ...prev.filter(d => d.type !== docReq.id),
                                    { name: file.name, url: reader.result as string, type: docReq.id }
                                  ]);
                                };
                                reader.readAsDataURL(file);
                              }
                            }} />
                          <span className="material-symbols-outlined text-sm">upload_file</span> Upload
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {errors.media && <p className="text-red-500 text-xs text-center font-bold">{errors.media}</p>}
          </div>

          {errors.submit && <p className="text-red-500 text-xs text-center font-bold">{errors.submit}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-4 justify-between mt-8">
            <button type="button" onClick={() => setStep("auction")} disabled={submitting} className="btn-outline w-full sm:w-auto px-8 py-4 rounded-xl font-bold">← Back</button>
            <button type="submit" disabled={submitting} className="btn-tertiary w-full sm:flex-1 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-70">
              {submitting ? (
                <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Submitting...</>
              ) : (
                <><span className="material-symbols-outlined">send</span>Submit for Admin Review</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
