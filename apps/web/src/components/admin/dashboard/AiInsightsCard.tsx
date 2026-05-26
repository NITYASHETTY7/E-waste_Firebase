"use client";

import React from "react";
import { motion } from "framer-motion";

export function AiInsightsCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="p-4 sm:p-5 lg:p-4 xl:p-6 rounded-[2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/30 shadow-2xl relative overflow-hidden h-full"
    >
      <div className="absolute top-0 right-1/3 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-white font-headline font-bold text-base">AI Insights</h3>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-black text-indigo-300 uppercase tracking-wider">New</span>
          </div>
          <p className="text-white/40 text-[11px] leading-relaxed mb-4">AI powered insights to help you make better decisions</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2.5 flex-1">
          {/* Revenue Prediction */}
          <div className="p-3 sm:p-4 lg:p-3 xl:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/8 transition-colors flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Revenue Prediction</p>
              <p className="text-white font-headline font-black text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg leading-none whitespace-nowrap">₹3,12,00,000</p>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="material-symbols-outlined text-emerald-400 text-sm">trending_up</span>
              <span className="text-emerald-400 text-[10px] font-black">+15.2%</span>
              <span className="text-white/30 text-[10px] ml-1">Next Month</span>
            </div>
          </div>

          {/* Best Performing Category */}
          <div className="p-3 sm:p-4 lg:p-3 xl:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/8 transition-colors flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Best Performing Category</p>
              <p className="text-white font-headline font-black text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg leading-none">IT Equipment</p>
            </div>
            <p className="text-white/30 text-[10px] font-bold mt-2">35.6% of total</p>
          </div>

          {/* High Value Auction */}
          <div className="p-3 sm:p-4 lg:p-3 xl:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/8 transition-colors flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">High Value Auction</p>
              <p className="text-white font-headline font-black text-sm sm:text-base lg:text-sm xl:text-base 2xl:text-lg leading-none">Dell IT Assets</p>
            </div>
            <p className="text-white/30 text-[10px] font-bold mt-2">₹15.2L Top Bid</p>
          </div>
        </div>

        {/* CTA */}
        <button className="mt-4 flex items-center gap-2 px-5 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-indigo-600/25 w-fit">
          <span className="material-symbols-outlined text-sm">psychology</span>
          Get AI Insights
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </motion.div>
  );
}
