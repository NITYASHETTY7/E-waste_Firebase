"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { motion } from "framer-motion";
import Link from "next/link";
import api from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING_ADMIN_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ADMIN_APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  QUOTE_RECEIVED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  QUOTE_ACCEPTED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  PICKUP_REQUESTED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PICKUP_IN_PROGRESS: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_ADMIN_REVIEW: "Pending Review",
  ADMIN_APPROVED: "Open for Quotes",
  QUOTE_RECEIVED: "Quotes Received",
  QUOTE_ACCEPTED: "Quote Accepted",
  PICKUP_REQUESTED: "Pickup Requested",
  PICKUP_IN_PROGRESS: "Pickup In Progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

interface Product { id: string; name: string; status: string; askingPrice: number; weightKg: number; createdAt: string; quotes: any[]; }

export default function UserDashboard() {
  const { currentUser } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user-products/mine').then(r => setProducts(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const total = products.length;
  const withQuotes = products.filter(p => p.quotes?.length > 0).length;
  const completed = products.filter(p => p.status === 'COMPLETED').length;
  const pending = products.filter(p => ['PICKUP_REQUESTED', 'PICKUP_IN_PROGRESS'].includes(p.status)).length;

  const quickActions = [
    { href: "/user/upload", icon: "upload_file", label: "Submit Product", desc: "List a new e-waste item", color: "bg-purple-600 text-white shadow-purple-200/50 dark:shadow-purple-900/50" },
    { href: "/user/my-products", icon: "inventory_2", label: "My Products", desc: "View all your submissions", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
    { href: "/user/quotes", icon: "request_quote", label: "Vendor Quotes", desc: "Review & accept offers", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
    { href: "/user/track", icon: "local_shipping", label: "Track Pickup", desc: "Monitor pickup status", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome back, <span className="text-purple-600">{currentUser?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Manage your e-waste submissions and track payments</p>
        </div>
        <Link href="/user/upload"
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200/50 dark:shadow-purple-900/50 text-sm">
          <span className="material-symbols-outlined text-lg">upload_file</span>
          Submit New Product
        </Link>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Products Submitted", value: total, icon: "inventory_2", color: "text-purple-600" },
          { label: "Quotes Received", value: withQuotes, icon: "request_quote", color: "text-blue-600" },
          { label: "Pickups In Progress", value: pending, icon: "local_shipping", color: "text-orange-500" },
          { label: "Completed", value: completed, icon: "task_alt", color: "text-green-600" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{k.label}</p>
              <span className={`material-symbols-outlined text-xl ${k.color}`}>{k.icon}</span>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{loading ? "—" : k.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-5">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map(a => (
            <Link key={a.href} href={a.href}
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm ${a.color}`}>
              <span className="material-symbols-outlined text-3xl">{a.icon}</span>
              <div className="text-center">
                <p className="font-black text-sm">{a.label}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent Products */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Recent Submissions</h2>
          <Link href="/user/my-products" className="text-[10px] font-black uppercase tracking-widest text-purple-600 hover:underline">View All</Link>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-3">inventory_2</span>
            <p className="text-slate-500 dark:text-slate-400 font-bold">No products submitted yet</p>
            <Link href="/user/upload" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-all">
              <span className="material-symbols-outlined text-base">add</span> Submit your first product
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {products.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-600 text-lg">devices</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.weightKg}kg · Ask ₹{p.askingPrice.toLocaleString()} · {new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${STATUS_COLOR[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
