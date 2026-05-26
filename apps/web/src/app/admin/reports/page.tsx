"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate } from "@/utils/format";

export default function AdminReports() {
  const { listings, users, bids, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<"platform" | "clients" | "vendors">("platform");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDemo = currentUser?.email === process.env.ADMIN_EMAIL;

  // Calculations
  const completedListings = listings.filter(l => l.status === "completed" || l.auctionPhase === "completed");
  const activeListings = listings.filter(l => l.status === "active" || l.auctionPhase === "live");
  
  const totalWeight = completedListings.reduce((sum, l) => sum + (l.weight || 0), 0);
  const totalRevenue = bids.filter(b => b.status === "accepted").reduce((sum, b) => sum + b.amount, 0);
  const totalCommissions = totalRevenue * 0.05;

  const vendors = users.filter(u => u.role === "vendor");
  const clients = users.filter(u => u.role === "client");

  const metrics = [
    { label: "Total E-Waste Processed", value: `${totalWeight.toLocaleString()} KG`, delta: "+15%", icon: "recycling" },
    { label: "Total Platform Revenue", value: `₹${(totalRevenue / 1000).toFixed(1)}K`, delta: "+8.2%", icon: "payments" },
    { label: "Platform Commissions", value: `₹${(totalCommissions / 1000).toFixed(1)}K`, delta: "+11%", icon: "account_balance" },
    { label: "Active Recycling Partners", value: vendors.length.toString(), delta: `+${vendors.filter(v => (new Date().getTime() - new Date(v.registeredAt || 0).getTime()) < 30 * 86400000).length}`, icon: "handshake" },
  ];

  const getMonthlyData = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    return months.map((month, i) => {
      const weight = listings
        .filter(l => l.status === "completed" && new Date(l.createdAt).getMonth() === i)
        .reduce((sum, l) => sum + l.weight, 0);
      
      const co2 = Math.round(weight * 1.5); 
      const seedCo2 = isDemo && i <= currentMonth ? 100 + i * 20 : 0;
      
      return { month, co2: co2 || seedCo2, waste: weight };
    });
  };

  const getCategoryData = () => {
    const categories = Array.from(new Set(listings.map(l => l.category)));
    const total = listings.length || 1;
    return categories.map(cat => ({
      label: cat,
      pct: Math.round((listings.filter(l => l.category === cat).length / total) * 100),
      color: cat === "Display Units" ? "bg-blue-500" : cat === "IT Equipment" ? "bg-emerald-500" : "bg-amber-500"
    })).sort((a,b) => b.pct - a.pct).slice(0, 4);
  };

  const handleDownload = (name: string) => alert(`Downloading ${name}...`);

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();

  if (!mounted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 px-4 md:px-8 pt-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-slate-900 dark:text-white">Analytical Intelligence</h2>
          <p className="text-slate-500 mt-1 font-medium">Cross-platform metrics, compliance tracking, and revenue audits.</p>
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
            {/* CO2 Savings Chart */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
              <h4 className="font-headline font-bold text-slate-900 mb-8 flex items-center justify-between dark:text-white">
                Environmental Impact (CO2 Saved)
                <button onClick={() => handleDownload("Impact Report")} className="text-xs font-bold text-emerald-600 hover:underline">Download Report</button>
              </h4>
              <div className="h-64 flex items-end justify-between gap-4 px-4 relative">
                <div className="absolute inset-0 flex flex-col justify-between py-2 text-[10px] text-slate-100 pointer-events-none">
                  {[300, 225, 150, 75, 0].map(v => <div key={v} className="border-b border-slate-100 w-full h-px dark:border-slate-800" />)}
                </div>
                {monthlyData.map((d) => (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-2 group relative">
                    <div className="w-full bg-emerald-600/10 rounded-t-lg transition-all hover:bg-emerald-600/20 cursor-pointer" style={{ height: `${Math.min(100, (d.co2 / 300) * 100)}%` }}>
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                        {d.co2} MT CO2
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Material Category Reports */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
              <h4 className="font-headline font-bold text-slate-900 mb-8 dark:text-white">Material Categories</h4>
              <div className="space-y-6">
                {categoryData.length > 0 ? categoryData.map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="text-slate-900 dark:text-white">{item.pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden dark:bg-slate-950">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-20 text-slate-400 italic text-sm">No data available</p>
                )}
              </div>
            </div>
          </div>

          {/* EPR Tracking */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 dark:bg-slate-900 dark:border-slate-700">
            <h4 className="font-headline font-bold text-slate-900 mb-6 flex items-center justify-between dark:text-white">
                EPR Tracking (Extended Producer Responsibility)
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">FY 2024-25 Q2</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-black tracking-wider dark:bg-slate-950">
                  <tr>
                    <th className="px-6 py-4">Producer Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Target (MT)</th>
                    <th className="px-6 py-4 text-right">Achieved (MT)</th>
                    <th className="px-6 py-4 w-1/3">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { name: "Dell India Pvt Ltd", category: "IT Equipment", target: 450 },
                    { name: "Samsung Electronics", category: "Display Units", target: 800 },
                    { name: "HP Inc", category: "Printers", target: 200 },
                    { name: "LG Electronics", category: "Consumer Electronics", target: 650 }
                  ].map((epr, idx) => {
                    const achieved = listings
                        .filter(l => l.status === "completed" && l.category === epr.category)
                        .reduce((sum, l) => sum + l.weight, 0);
                    
                    const displayAchieved = achieved || (isDemo ? (idx === 0 ? 320 : idx === 1 ? 410 : 120) : 0);
                    const pct = Math.min(100, Math.round((displayAchieved / epr.target) * 100));
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{epr.name}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{epr.category}</td>
                        <td className="px-6 py-4 text-slate-400 text-right">{epr.target}</td>
                        <td className="px-6 py-4 font-bold text-emerald-700 text-right">{displayAchieved}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                              <div className={`h-full ${pct > 90 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-slate-500 min-w-[32px]">{pct}%</span>
                          </div>
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
                       const clientListings = listings.filter(l => l.userId === client.id);
                       const clientWeight = clientListings.reduce((s, l) => s + l.weight, 0);
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
