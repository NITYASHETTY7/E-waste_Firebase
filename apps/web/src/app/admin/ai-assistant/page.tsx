"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

export default function AdminAiAssistantPage() {
  const { currentUser } = useApp();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
    {
      role: "ai",
      content: "Hello! I am your WeConnect AI Assistant. I can help you with e-waste data analysis, compliance queries, or platform management tasks. How can I assist you today?",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsg = prompt.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setPrompt("");
    setLoading(true);

    try {
      const { response } = await api.post("/ai/ask", { prompt: userMsg });
      setMessages((prev) => [...prev, { role: "ai", content: response }]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `I encountered an error: ${error.message}. Please make sure the AI module is properly configured.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-5xl mx-auto px-4 pt-8">
      <div className="mb-6">
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          AI Command Center
          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest dark:bg-indigo-900/30 dark:text-indigo-400">
            Beta
          </span>
        </h2>
        <p className="text-slate-500 font-medium">Ask questions about your e-waste data, compliance, or platform rules.</p>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
          <form onSubmit={handleAsk} className="relative flex items-center gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about monthly collections, vendor compliance, or revenue..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-6 pr-14 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </form>
          <p className="mt-3 text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
            AI can make mistakes. Verify important financial data manually.
          </p>
        </div>
      </div>
    </div>
  );
}
