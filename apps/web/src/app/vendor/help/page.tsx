"use client";

import { useState } from "react";

export default function VendorHelp() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setSubject("");
      setMessage("");
    }, 3000);
  };

  const faqs = [
    { q: "Why is my account locked?", a: "Accounts are usually locked by administrators due to outstanding compliance documentation, pending penalty amounts, or audit mismatches. Please contact support to resolve this." },
    { q: "How do I clear my pending penalties?", a: "Go to the Payments tab. If you have any outstanding penalties, a card will be displayed at the top letting you pay immediately by sharing your transaction UTR reference." },
    { q: "How do I submit site audit pictures?", a: "Once you accept a site visit audit request, you can upload site photographs directly from the site audit details page before completing the verification." }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4 sm:px-6 lg:px-8 py-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Help & Support</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Get answers to FAQs or contact WeConnect support directly.</p>
      </div>

      {/* Support channels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: "mail", label: "Email Support", desc: "support@weconnect.com", sub: "Replies within 24 hours" },
          { icon: "call", label: "Support Hotline", desc: "+1 (800) 555-0199", sub: "Mon - Fri, 9 AM - 6 PM" },
          { icon: "chat", label: "Live Chat", desc: "Chat with Assistant", sub: "Available in dashboard" }
        ].map(ch => (
          <div key={ch.label} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl text-center shadow-sm">
            <span className="material-symbols-outlined text-3xl text-blue-600 mb-2">{ch.icon}</span>
            <p className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] mb-1">{ch.label}</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{ch.desc}</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{ch.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* FAQs */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Frequently Asked Questions</h3>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{faq.q}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-medium">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl space-y-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Send a Message</h3>
          {submitted ? (
            <div className="p-10 text-center text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900">
              <span className="material-symbols-outlined text-4xl block mb-2">check_circle</span>
              Support ticket created! We will contact you soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Account Lock inquiry"
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 ml-1">Message</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your issue or request in detail..."
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all resize-none"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
              >
                Submit Ticket
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
