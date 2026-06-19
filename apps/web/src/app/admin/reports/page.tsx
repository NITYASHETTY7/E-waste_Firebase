"use client";

import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminReports() {
  const { listings, users, bids } = useApp();
  const [activeTab, setActiveTab] = useState<"platform" | "clients" | "vendors">("platform");
  const [mounted, setMounted] = useState(false);
  const [hoveredCat, setHoveredCat] = useState<any | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Calculations
  const completedListings = listings.filter(l => l.status === "completed" || l.auctionPhase === "completed");
  const totalWeight = completedListings.reduce((sum, l) => sum + (l.weight || 0), 0);
  const totalRevenue = bids.filter(b => b.status === "accepted").reduce((sum, b) => sum + b.amount, 0);
  const totalCommissions = totalRevenue * 0.05;

  const vendors = users.filter(u => u.role === "vendor");
  const clients = users.filter(u => u.role === "client" || u.role === "user");

  const metrics = useMemo(() => [
    { label: "Total E-Waste Processed", value: `${totalWeight.toLocaleString()} KG`, delta: "0%", icon: "recycling" },
    { label: "Total Platform Revenue", value: `₹${(totalRevenue / 1000).toFixed(1)}K`, delta: "0%", icon: "payments" },
    { label: "Platform Commissions", value: `₹${(totalCommissions / 1000).toFixed(1)}K`, delta: "0%", icon: "account_balance" },
    { label: "Active Recycling Partners", value: vendors.length.toString(), delta: "0", icon: "handshake" },
  ], [totalWeight, totalRevenue, totalCommissions, vendors.length]);

  const { monthlyData, maxCo2 } = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];
    let absoluteMax = 0;
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = months[d.getMonth()];
      const year = d.getFullYear();
      
      const weight = listings
        .filter(l => {
          const ld = new Date(l.createdAt);
          return (l.status === "completed" || l.auctionPhase === "completed") && 
                 ld.getMonth() === d.getMonth() && 
                 ld.getFullYear() === year;
        })
        .reduce((sum, l) => sum + (l.weight || 0), 0);
      
      const co2 = Number((weight * 1.5 / 1000).toFixed(2)); // in MT
      if (co2 > absoluteMax) absoluteMax = co2;
      result.push({ month: monthLabel, year, co2, waste: weight });
    }
    return { monthlyData: result, maxCo2: Math.max(10, Math.ceil(absoluteMax * 1.2)) };
  }, [listings]);

  const categoryImpact = useMemo(() => {
    const cats: Record<string, number> = {};
    completedListings.forEach(l => {
      const cat = l.category || "Other";
      cats[cat] = (cats[cat] || 0) + (l.weight || 0);
    });

    const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#F43F5E", "#06B6D4", "#F97316", "#A855F7"];
    const totalWeightSum = Object.values(cats).reduce((s, v) => s + v, 0);

    return Object.entries(cats).map(([label, weight], i) => ({
      label,
      weight,
      co2: Number((weight * 1.5 / 1000).toFixed(2)),
      pct: totalWeightSum > 0 ? Number(((weight / totalWeightSum) * 100).toFixed(1)) : 0,
      color: colors[i % colors.length]
    })).sort((a,b) => b.weight - a.weight);
  }, [completedListings]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    let total = 0;
    listings.forEach(l => {
      const cat = l.category || "Other";
      categories[cat] = (categories[cat] || 0) + 1;
      total++;
    });

    const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

    return Object.entries(categories).map(([label, count], i) => ({
      label,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      color: colors[i % colors.length]
    })).sort((a,b) => b.pct - a.pct).slice(0, 5);
  }, [listings]);

  const eprData = useMemo(() => {
    return clients.map(client => {
      const clientListings = listings.filter(l => 
        (l.userId === client.id || (client.companyId && l.userId === client.companyId)) && 
        (l.status === "completed" || l.auctionPhase === "completed")
      );
      const achieved = clientListings.reduce((s, l) => s + (l.weight || 0), 0) / 1000; // MT
      const target = 5.0; // Default target 5MT
      return {
        name: client.name || client.email,
        category: client.role === "user" ? "Individual" : "Enterprise",
        target,
        achieved: Number(achieved.toFixed(2)),
        progress: Math.min(Math.round((achieved / target) * 100), 100)
      };
    }).sort((a,b) => b.achieved - a.achieved);
  }, [clients, listings]);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDownload = (name: string) => {
    showToast(`Generating ${name}...`);
    
    const clean = (val: any) => {
      if (val === undefined || val === null) return "";
      return String(val).replace(/,/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
    };

    const safeFilename = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    let headers = "Date,Entity,Category,Weight (KG),Amount (INR),CO2 Saved (MT)";
    let rows: string[] = [];

    if (name.includes("Impact")) {
      rows = completedListings.map(l => {
        const date = new Date(l.createdAt).toLocaleDateString('en-IN');
        const co2 = (l.weight * 1.5 / 1000).toFixed(2);
        return `${clean(date)},${clean(l.userName)},${clean(l.category)},${l.weight},0,${co2}`;
      });
    } else if (name.includes("Revenue")) {
      headers = "Client Name,Total Lots,Total Weight (KG),Total Revenue (INR)";
      rows = clients.map(c => {
        const clientListings = listings.filter(l => l.userId === c.id || (c.companyId && l.userId === c.companyId));
        const weight = clientListings.reduce((s, l) => s + (l.weight || 0), 0);
        const revenue = bids.filter(b => b.status === "accepted" && clientListings.some(l => l.id === b.listingId)).reduce((s, b) => s + b.amount, 0);
        return `${clean(c.name)},${clientListings.length},${weight},${revenue}`;
      });
    } else if (name.includes("Monthly")) {
       headers = "Month,Year,Waste Processed (KG),CO2 Saved (MT)";
       rows = monthlyData.filter(d => d.waste > 0).map(d => `${clean(d.month)},${d.year},${d.waste},${d.co2}`);
    }

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${safeFilename}_report.csv`);
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`${name} downloaded successfully.`);
    }, 100);
  };

  if (!mounted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 px-4 md:px-8 pt-8 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-6 py-3 rounded-2xl shadow-2xl text-sm font-black text-white transition-all transform animate-in fade-in slide-in-from-top-4 ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">{toast.type === "error" ? "error" : "check_circle"}</span>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-headline font-extrabold tracking-tight text-slate-900 dark:text-white">Platform Analytics & Reports</h2>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest dark:bg-emerald-900/30 dark:text-emerald-400">
              Live Data: {completedListings.length} Projects
            </span>
          </div>
          <p className="text-slate-500 font-medium">Real-time environmental metrics, producer compliance, and performance audits.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit dark:bg-slate-800">
          {(["platform", "clients", "vendors"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "platform" && (
        <div className="space-y-8">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between h-44 shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-700">
                <div className="flex justify-between items-start">
                  <span className="material-symbols-outlined text-emerald-600 opacity-50">{m.icon}</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{m.delta}</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{m.label}</p>
                  <h3 className="text-3xl font-headline font-bold text-slate-900 dark:text-white">{m.value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
              <h4 className="font-headline font-bold text-slate-900 mb-8 flex items-center justify-between dark:text-white">
                Impact by Category
                <button onClick={() => handleDownload("Impact Distribution")} className="text-[10px] font-black uppercase text-emerald-600 hover:underline">Export</button>
              </h4>
              
              <div className="relative h-64 flex items-center justify-center group/chart">
                {categoryImpact.length > 0 ? (
                  <>
                    <svg className="w-56 h-56 -rotate-90 overflow-visible" viewBox="0 0 100 100">
                      <circle r="40" cx="50" cy="50" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-50 dark:text-slate-800/50" />
                      {categoryImpact.map((item, i) => {
                        const prevPcts = categoryImpact.slice(0, i).reduce((sum, ci) => sum + Number(ci.pct), 0);
                        return (
                          <g key={item.label} className="group/segment cursor-pointer"
                            onMouseEnter={() => setHoveredCat(item)}
                            onMouseLeave={() => setHoveredCat(null)}>
                            <circle 
                              r="40" cx="50" cy="50" fill="transparent"
                              stroke={item.color} 
                              strokeWidth={hoveredCat?.label === item.label ? "16" : "12"}
                              strokeDasharray={`${item.pct} 100`}
                              strokeDashoffset={-prevPcts}
                              pathLength="100"
                              className="transition-all duration-300 origin-center" 
                            />
                          </g>
                        );
                      })}
                    </svg>
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center px-4 max-w-[140px]">
                        <AnimatePresence mode="wait">
                          {hoveredCat ? (
                            <motion.div 
                              key={hoveredCat.label}
                              initial={{ opacity: 0, y: 5 }} 
                              animate={{ opacity: 1, y: 0 }} 
                              exit={{ opacity: 0, y: -5 }}
                              className="flex flex-col items-center"
                            >
                              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1 line-clamp-1">
                                {hoveredCat.label}
                              </p>
                              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                                {Math.round(hoveredCat.pct)}%
                              </p>
                            </motion.div>
                          ) : (
                            <motion.div 
                              key="total"
                              initial={{ opacity: 0 }} 
                              animate={{ opacity: 1 }}
                              className="flex flex-col items-center"
                            >
                              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                                {Number((totalWeight / 1000).toFixed(1))}T
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Total Impact
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">donut_large</span>
                    <p className="text-xs text-slate-400 italic">No impact data yet</p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-2">
                {categoryImpact.map(ci => (
                  <div key={ci.label} 
                    onMouseEnter={() => setHoveredCat(ci)}
                    onMouseLeave={() => setHoveredCat(null)}
                    className={`flex items-center justify-between group/row cursor-default p-2 rounded-xl transition-all ${hoveredCat?.label === ci.label ? "bg-slate-50 dark:bg-slate-800 scale-[1.02] shadow-sm" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: ci.color }} />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover/row:text-slate-900 dark:group-hover/row:text-white transition-colors truncate max-w-[120px]">{ci.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 dark:text-white block">{ci.pct}%</span>
                      <span className="text-[9px] text-slate-400 font-medium">{ci.co2} MT CO2</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
              <h4 className="font-headline font-bold text-slate-900 mb-8 flex items-center justify-between dark:text-white">
                Monthly Impact Ledger
                <button onClick={() => handleDownload("Monthly Impact")} className="text-xs font-bold text-emerald-600 hover:underline">Download Report</button>
              </h4>
              <div className="overflow-y-auto max-h-80 pr-2 custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="pb-4">Month</th>
                      <th className="pb-4 text-right">Waste (KG)</th>
                      <th className="pb-4 text-right">CO2 Saved (MT)</th>
                      <th className="pb-4 text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {monthlyData.filter(d => d.waste > 0).reverse().map((d) => (
                      <tr key={`${d.month}-${d.year}`} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-4">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{d.month} {d.year}</span>
                        </td>
                        <td className="py-4 text-right">
                          <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{d.waste.toLocaleString()} KG</span>
                        </td>
                        <td className="py-4 text-right">
                          <span className="text-sm font-black text-emerald-600">+{d.co2} MT</span>
                        </td>
                        <td className="py-4 text-right">
                          <span className="text-[10px] font-bold text-slate-400">98.2%</span>
                        </td>
                      </tr>
                    ))}
                    {monthlyData.every(d => d.waste === 0) && (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-400 italic text-sm">No monthly disposal activity recorded yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
            <h4 className="font-headline font-bold text-slate-900 mb-6 flex items-center justify-between dark:text-white">
                EPR Tracking (Extended Producer Responsibility)
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full dark:bg-emerald-900/20">FY 2024-25 Q2</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest dark:bg-slate-950">
                  <tr>
                    <th className="px-6 py-4">Producer Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Target (MT)</th>
                    <th className="px-6 py-4 text-right">Achieved (MT)</th>
                    <th className="px-6 py-4 w-1/4 text-center">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                   {eprData.length > 0 ? eprData.map((row, i) => (
                     <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                       <td className="px-6 py-4 font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{row.name}</td>
                       <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${row.category === 'Individual' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                            {row.category}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-right font-mono text-slate-500">{row.target.toFixed(2)}</td>
                       <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{row.achieved.toFixed(2)}</td>
                       <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                           <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                             <div className="h-full bg-emerald-500" style={{ width: `${row.progress}%` }} />
                           </div>
                           <span className="text-[10px] font-bold text-slate-500 w-8">{row.progress}%</span>
                         </div>
                       </td>
                     </tr>
                   )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No disposal data found for EPR tracking</td>
                    </tr>
                   )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "clients" && (
        <div className="space-y-8">
           <div className="bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
              <h4 className="font-headline font-bold text-slate-900 mb-6 dark:text-white">Client Revenue & Volume</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest dark:bg-slate-950">
                    <tr>
                      <th className="p-4">Client Name</th>
                      <th className="p-4">Industry</th>
                      <th className="p-4 text-center">Total Lots</th>
                      <th className="p-4 text-right">Total Weight</th>
                      <th className="p-4 text-right">Total Revenue Generated</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients.map(client => {
                       const clientListings = listings.filter(l => l.userId === client.id || (client.companyId && l.userId === client.companyId));
                       const clientWeight = clientListings.reduce((s, l) => s + (l.weight || 0), 0);
                       const clientRevenue = bids.filter(b => b.status === "accepted" && clientListings.some(l => l.id === b.listingId)).reduce((s, b) => s + b.amount, 0);
                       return (
                         <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">{client.name}</td>
                            <td className="p-4 text-xs text-slate-500">{client.onboardingProfile?.industrySector || "IT Services"}</td>
                            <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{clientListings.length}</td>
                            <td className="p-4 text-right text-slate-600 font-mono dark:text-slate-400">{clientWeight.toLocaleString()} KG</td>
                            <td className="p-4 text-right font-bold text-emerald-700 font-mono">₹{clientRevenue.toLocaleString()}</td>
                            <td className="p-4 text-right">
                               <button onClick={() => handleDownload(`${client.name} Revenue Report`)} className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700">Audit</button>
                            </td>
                         </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === "vendors" && (
        <div className="space-y-8">
           <div className="bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
              <h4 className="font-headline font-bold text-slate-900 mb-6 dark:text-white">Vendor Performance Audit</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest dark:bg-slate-950">
                    <tr>
                      <th className="p-4">Vendor Entity</th>
                      <th className="p-4">Verification</th>
                      <th className="p-4 text-center">Participation</th>
                      <th className="p-4 text-center">Won</th>
                      <th className="p-4 text-center">Win Rate</th>
                      <th className="p-4 text-right">Total Purchase Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vendors.map(vendor => {
                       const vendorBids = bids.filter(b => b.vendorId === vendor.id);
                       const vendorWon = vendorBids.filter(b => b.status === "accepted");
                       const winRate = vendorBids.length > 0 ? Math.round((vendorWon.length / vendorBids.length) * 100) : 0;
                       const totalPurchase = vendorWon.reduce((s, b) => s + b.amount, 0);
                       return (
                         <tr key={vendor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">{vendor.name}</td>
                            <td className="p-4">
                               <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${vendor.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                                  {vendor.status?.toUpperCase() || "PENDING"}
                               </span>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">{vendorBids.length} bids</td>
                            <td className="p-4 text-center font-bold text-emerald-600">{vendorWon.length}</td>
                            <td className="p-4 text-center">
                               <div className="flex items-center justify-center gap-2">
                                  <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                                     <div className="h-full bg-emerald-500" style={{ width: `${winRate}%` }} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500">{winRate}%</span>
                               </div>
                            </td>
                            <td className="p-4 text-right font-bold text-slate-900 font-mono dark:text-white">₹{totalPurchase.toLocaleString()}</td>
                         </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
