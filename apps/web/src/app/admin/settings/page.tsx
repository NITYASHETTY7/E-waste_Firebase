"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("Role Management");

  // Create Admin state
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!adminForm.name.trim() || !adminForm.email.trim() || !adminForm.password.trim()) {
      setAdminError("All fields are required.");
      return;
    }
    if (adminForm.password !== adminForm.confirmPassword) {
      setAdminError("Passwords do not match.");
      return;
    }
    if (adminForm.password.length < 6) {
      setAdminError("Password must be at least 6 characters.");
      return;
    }

    setAdminLoading(true);
    try {
      await api.post("/users/admin", {
        name: adminForm.name.trim(),
        email: adminForm.email.trim().toLowerCase(),
        password: adminForm.password,
      });
      setAdminSuccess(`Admin account created for ${adminForm.email.trim().toLowerCase()}.`);
      setAdminForm({ name: "", email: "", password: "", confirmPassword: "" });
    } catch (err: any) {
      setAdminError(err?.response?.data?.message || "Failed to create admin account.");
    } finally {
      setAdminLoading(false);
    }
  };

  const roles = [
    { name: "Super Admin", desc: "Full system control", perms: [true, true, true, true, true] },
    { name: "Sustainability Manager", desc: "Operations & reporting", perms: [true, true, false, true, false] },
    { name: "Support", desc: "Read-only assistance", perms: [true, false, false, false, false] },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      {/* Header — matches Stitch Admin Settings reference */}
      <div>
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Admin Settings</h2>
        <p className="text-[color:var(--color-on-surface-variant)] mt-1">Configure system-wide parameters, user access levels, and notification protocols.</p>
      </div>

      {/* Tabbed Navigation */}
      <div className="flex items-center gap-8 border-b border-slate-100 mb-8 overflow-x-auto dark:border-slate-800">
        {["General", "Bidding Parameters", "Notifications", "Role Management", "Admin Accounts"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab
                ? "text-[color:var(--color-primary)] border-b-2 border-[color:var(--color-primary)]"
                : "text-slate-400 hover:text-[color:var(--color-primary)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab !== "Admin Accounts" && <div className="grid grid-cols-12 gap-8">
        {/* Permissions Matrix */}
        <div className="col-span-12 card overflow-hidden">
          <div className="bg-[color:var(--color-inverse-surface)] px-6 py-4 flex justify-between items-center">
            <h3 className="text-white font-bold flex items-center gap-2 text-sm uppercase tracking-widest">
              <span className="material-symbols-outlined text-[color:var(--color-primary-fixed)] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
              Permission Matrix
            </h3>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded">System Level: Enterprise</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                  <th className="px-8 py-5 text-[10px] uppercase font-black text-slate-400 tracking-widest">Role Name</th>
                  {["View Listings", "Edit Listings", "Approve Vendors", "View Reports", "Manage Users"].map((p) => (
                    <th key={p} className="px-4 py-5 text-[10px] uppercase font-black text-slate-400 tracking-widest text-center">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {roles.map((role) => (
                  <tr key={role.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${role.name === "Super Admin" ? "bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]" : "bg-slate-100 text-slate-500"}`}>
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {role.name === "Super Admin" ? "stars" : role.name === "Support" ? "support_agent" : "eco"}
                          </span>
                        </div>
                        <div>
                          <p className="font-headline font-bold text-sm text-[color:var(--color-on-surface)]">{role.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{role.desc}</p>
                        </div>
                      </div>
                    </td>
                    {role.perms.map((p, i) => (
                      <td key={i} className="px-4 py-5 text-center text-sm">
                        <input
                          type="checkbox"
                          checked={p}
                          readOnly
                          className="w-5 h-5 rounded border-slate-200 text-[color:var(--color-primary)] focus:ring-[color:var(--color-primary)] opacity-60 cursor-not-allowed dark:border-slate-700"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-slate-50 flex items-start gap-4 border-t border-slate-100 dark:bg-slate-950 dark:border-slate-800">
            <span className="material-symbols-outlined text-[color:var(--color-primary)] text-lg">info</span>
            <div>
              <p className="text-xs font-bold text-[color:var(--color-on-surface)]">About Custom Roles</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed max-w-2xl font-medium">
                Role permissions are granularly tracked in the audit log. Changes to Super Admin roles require secondary verification via OTP. Existing users assigned to modified roles will have their access updated upon their next session initialization.
              </p>
            </div>
          </div>
        </div>

        {/* Security Overview */}
        <div className="col-span-12 lg:col-span-4 card p-6">
          <h4 className="font-headline font-bold text-[color:var(--color-on-surface)] mb-4">Security Overview</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">2FA Required</span>
              <span className="px-3 py-1 rounded-full bg-[color:var(--color-primary-container)] text-white text-[10px] font-black uppercase tracking-tighter">Active</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Session Timeout</span>
              <span className="text-sm font-bold text-[color:var(--color-on-surface)]">15 Minutes</span>
            </div>
          </div>
        </div>

        {/* Quick Role Creator */}
        <div className="col-span-12 lg:col-span-8 card p-6">
          <h4 className="font-headline font-bold text-[color:var(--color-on-surface)] mb-4">Quick Role Creator</h4>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">New Role Name</label>
              <input type="text" placeholder="e.g. Regional Inspector" className="w-full input-base" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Inherit From</label>
              <select className="w-full input-base appearance-none">
                <option>Support</option>
                <option>Sustainability Manager</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="h-[46px] px-8 bg-[color:var(--color-secondary-container)] text-[color:var(--color-on-secondary-container)] font-bold rounded-xl text-xs uppercase tracking-widest hover:opacity-90 transition-all">
                Create
              </button>
            </div>
          </div>
        </div>
      </div>}

      {/* Admin Accounts Tab */}
      {activeTab === "Admin Accounts" && (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-7 card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[color:var(--color-secondary-container)] flex items-center justify-center">
                <span className="material-symbols-outlined text-[color:var(--color-primary)]" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
              </div>
              <div>
                <h4 className="font-headline font-bold text-[color:var(--color-on-surface)]">Create Admin Account</h4>
                <p className="text-[11px] text-slate-400 font-medium">New admin can log in immediately with full access.</p>
              </div>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Admin"
                  value={adminForm.name}
                  onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))}
                  className="input-base w-full text-slate-900 dark:text-white placeholder:text-slate-400"
                  disabled={adminLoading}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  placeholder="admin@weconnect.com"
                  value={adminForm.email}
                  onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
                  className="input-base w-full text-slate-900 dark:text-white placeholder:text-slate-400"
                  disabled={adminLoading}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={adminForm.password}
                    onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                    className="input-base w-full pr-10 text-slate-900 dark:text-white placeholder:text-slate-400"
                    disabled={adminLoading}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-lg">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={adminForm.confirmPassword}
                  onChange={e => setAdminForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className="input-base w-full text-slate-900 dark:text-white placeholder:text-slate-400"
                  disabled={adminLoading}
                />
              </div>

              {adminError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <span className="material-symbols-outlined text-red-500 text-base shrink-0">error</span>
                  <p className="text-xs font-bold text-red-700">{adminError}</p>
                </div>
              )}
              {adminSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="material-symbols-outlined text-emerald-500 text-base shrink-0">check_circle</span>
                  <p className="text-xs font-bold text-emerald-700">{adminSuccess}</p>
                </div>
              )}

              <button type="submit" disabled={adminLoading}
                className="w-full py-3 bg-[color:var(--color-primary)] text-white font-black text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2">
                {adminLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Creating...</>
                ) : (
                  <><span className="material-symbols-outlined text-base">person_add</span> Create Admin Account</>
                )}
              </button>
            </form>
          </div>

          <div className="col-span-12 lg:col-span-5 card p-6">
            <h4 className="font-headline font-bold text-[color:var(--color-on-surface)] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              Admin Privileges
            </h4>
            <div className="space-y-3">
              {[
                { icon: "manage_accounts", label: "Approve / reject users", color: "text-emerald-600 bg-emerald-50" },
                { icon: "gavel", label: "Manage all auctions", color: "text-blue-600 bg-blue-50" },
                { icon: "bar_chart", label: "Access all reports", color: "text-purple-600 bg-purple-50" },
                { icon: "admin_panel_settings", label: "Create more admin accounts", color: "text-amber-600 bg-amber-50" },
                { icon: "settings", label: "Configure platform settings", color: "text-slate-600 bg-slate-100" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 items-start">
              <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5">warning</span>
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                Admin accounts have unrestricted access. Only create accounts for trusted team members.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      {activeTab !== "Admin Accounts" && (
        <div className="flex justify-end gap-4">
          <button className="text-[color:var(--color-primary)] font-bold text-xs uppercase tracking-widest px-6 py-3 hover:bg-emerald-50 rounded-xl transition-all">
            Discard Changes
          </button>
          <button className="bg-[color:var(--color-primary)] text-white font-bold text-xs uppercase tracking-widest px-10 py-3 rounded-xl shadow-lg shadow-emerald-900/10 hover:scale-105 transition-all">
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
