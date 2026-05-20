"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function VendorTeamSettings() {
  const { currentUser } = useApp();
  
  const [teamMembers, setTeamMembers] = useState([
    { id: "M1", name: currentUser?.name || "Vendor Admin", email: currentUser?.email || "admin@company.com", role: "Owner", 
      permissions: { viewAuctions: true, placeBids: true, managePickups: true, viewReports: true, manageTeam: true }, status: 'active' },
    { id: "M2", name: "Operations Lead", email: "ops@company.com", role: "Manager", 
      permissions: { viewAuctions: true, placeBids: false, managePickups: true, viewReports: false, manageTeam: false }, status: 'active' },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "Staff" });
  const [newPerms, setNewPerms] = useState({ viewAuctions: true, placeBids: false, managePickups: false, viewReports: false, manageTeam: false });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setTeamMembers(prev => [...prev, {
      ...newMember, id: `M${Date.now()}`, permissions: newPerms, status: 'pending'
    }]);
    setShowModal(false);
    setNewMember({ name: "", email: "", role: "Staff" });
    setNewPerms({ viewAuctions: true, placeBids: false, managePickups: false, viewReports: false, manageTeam: false });
  };

  const togglePermission = (memberId: string, permKey: keyof typeof newPerms) => {
    setTeamMembers(prev => prev.map(m => {
      if (m.id === memberId && m.role !== "Owner") {
        return { ...m, permissions: { ...m.permissions, [permKey]: !m.permissions[permKey] } };
      }
      return m;
    }));
  };

  const removeMember = (memberId: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== memberId || m.role === "Owner"));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-[color:var(--color-on-surface)]">Team & Access Matrix</h2>
          <p className="text-[color:var(--color-on-surface-variant)] mt-1">Manage sub-accounts for your staff and configure specific platform permissions.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary w-full md:w-auto px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">person_add</span>
          Invite Member
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[color:var(--color-surface-container-low)]">
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)]">Team Member</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] text-center">View Auctions</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] text-center">Place Bids</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] text-center">Manage Pickups</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-[color:var(--color-on-surface-variant)] text-center">View Reports</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-outline-variant)]/30">
              {teamMembers.map(member => (
                <tr key={member.id} className="hover:bg-[color:var(--color-surface-container-lowest)] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[color:var(--color-secondary-container)] flex items-center justify-center text-[color:var(--color-primary)] font-bold">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-[color:var(--color-on-surface)]">{member.name}</p>
                          {member.role === "Owner" && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase">Owner</span>}
                          {member.status === "pending" && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase dark:bg-slate-800">Invited</span>}
                        </div>
                        <p className="text-xs text-[color:var(--color-on-surface-variant)]">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  
                  {/* Permissions checkboxes loop */}
                  {(['viewAuctions', 'placeBids', 'managePickups', 'viewReports'] as const).map(p => (
                    <td key={p} className="p-4 text-center">
                      <button 
                        onClick={() => togglePermission(member.id, p)}
                        disabled={member.role === "Owner"}
                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                          member.permissions[p] 
                            ? "bg-[color:var(--color-primary)] text-white" 
                            : "bg-[color:var(--color-surface-dim)] border border-[color:var(--color-outline-variant)] text-transparent hover:border-[color:var(--color-primary)]/50"
                        } ${member.role === "Owner" ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <span className="material-symbols-outlined text-sm font-bold" style={{fontVariationSettings: "'wght' 700"}}>check</span>
                      </button>
                    </td>
                  ))}
                  
                  <td className="p-4 text-right">
                    {member.role !== "Owner" && (
                      <button onClick={() => removeMember(member.id)} className="text-[color:var(--color-on-surface-variant)] hover:text-red-500 transition-colors p-2">
                        <span className="material-symbols-outlined text-sm">person_remove</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[color:var(--color-surface)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[color:var(--color-outline-variant)]">
            <div className="p-6 border-b border-[color:var(--color-outline-variant)] flex justify-between items-center">
              <h3 className="font-headline font-bold text-lg text-[color:var(--color-on-surface)]">Invite Team Member</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-on-surface)]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
              <div>
                <label className="label">Full Name</label>
                <input required type="text" className="input-base" placeholder="John Doe" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input required type="email" className="input-base" placeholder="john@yourdomain.com" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} />
              </div>
              <div>
                <label className="label mb-2">Initial Permissions</label>
                <div className="space-y-3 bg-[color:var(--color-surface-container-low)] p-4 rounded-xl border border-[color:var(--color-outline-variant)]/50">
                  {Object.entries({
                    viewAuctions: "View Active Auctions",
                    placeBids: "Place Bids on Auctions",
                    managePickups: "Manage Delivery & Pickups",
                    viewReports: "View Analytical Reports"
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                       <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          newPerms[key as keyof typeof newPerms]
                            ? "bg-[color:var(--color-primary)] text-white" 
                            : "bg-white border border-[color:var(--color-outline-variant)] text-transparent"
                        }`}>
                        <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                      </div>
                      <input type="checkbox" className="hidden" 
                        checked={newPerms[key as keyof typeof newPerms]} 
                        onChange={() => setNewPerms({...newPerms, [key]: !newPerms[key as keyof typeof newPerms]})} />
                      <span className="text-sm text-[color:var(--color-on-surface)] font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1 py-3 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-3 rounded-xl font-bold">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
