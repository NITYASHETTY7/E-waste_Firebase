"use client";

import React from "react";
import { useRouter } from "next/navigation";

export function AiAssistantCard() {
  const router = useRouter();

  return (
    <div className="mx-4 mt-6 p-5 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
      {/* Decorative background elements */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-400/10 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
            <span className="material-symbols-outlined text-sm">smart_toy</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">AI Power</span>
        </div>
        
        <h4 className="text-lg font-headline font-bold leading-tight mb-2">
          Need help with <br/> platform data?
        </h4>
        
        <p className="text-[11px] text-indigo-100 font-medium leading-relaxed mb-5 opacity-90">
          Ask our AI assistant about collections, vendor performance, or compliance rules.
        </p>
        
        <button 
          onClick={() => router.push("/admin/ai-assistant")}
          className="w-full py-2.5 bg-white text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors shadow-lg shadow-black/5 flex items-center justify-center gap-2 group/btn"
        >
          Ask AI Assistant
          <span className="material-symbols-outlined text-sm group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
