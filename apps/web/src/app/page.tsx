"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

function DemoBox() {
  const [bids, setBids] = useState([
    { name: "Vendor A", amount: 210000, rank: "🥇" },
    { name: "Vendor B", amount: 205000, rank: "🥈" },
    { name: "Vendor C", amount: 198000, rank: "🥉" },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBids(prev => {
        const next = prev.map(bid => ({
          ...bid,
          amount: bid.amount + Math.floor(Math.random() * 5000)
        })).sort((a, b) => b.amount - a.amount);
        
        return next.map((bid, i) => ({
          ...bid,
          rank: i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"
        }));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-6 lg:p-8 text-white w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
      
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em]">Live Auction</span>
          </div>
          <span className="text-2xl font-black font-headline">02:15</span>
        </div>
        <div className="bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black border border-emerald-500/30 uppercase tracking-wider">
          Auto Extend Enabled
        </div>
      </div>

      <div className="space-y-1 relative z-10">
        <div className="grid grid-cols-3 text-white/40 text-[9px] font-black uppercase tracking-[0.2em] pb-3 border-b border-white/10 px-2">
          <span>Vendor</span>
          <span>Current Bid</span>
          <span className="text-right">Rank</span>
        </div>
        
        {bids.map((bid, i) => (
          <motion.div 
            key={bid.name}
            layout
            className="grid grid-cols-3 items-center py-4 px-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <span className="font-bold text-sm">{bid.name}</span>
            <span className="font-mono text-emerald-400 font-bold">₹{bid.amount.toLocaleString()}</span>
            <span className="text-right text-2xl">{bid.rank}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-white/10 relative z-10">
        <p className="text-[10px] text-white/50 font-medium text-center italic">
          Real-time price discovery in progress...
        </p>
      </div>
    </motion.div>
  );
}

function LandingPageContent() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);
      
      if (currentScrollY <= 50) {
        setShowNavbar(true);
      } else if (currentScrollY > lastScrollY.current) {
        // Scrolling down -> hide navbar if menus are closed
        if (!mobileMenuOpen && !loginDropdownOpen) {
          setShowNavbar(false);
        }
      } else {
        // Scrolling up -> show navbar
        setShowNavbar(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen, loginDropdownOpen]);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  if (!mounted) return null;

  return (
    <div className="bg-[#F5F7FA] min-h-screen flex flex-col relative text-[#1A1A2E] dark:bg-slate-950">
      {/* 1. NAVBAR — floating pill */}
      <div className={`fixed top-0 left-0 w-full z-50 flex justify-center pt-4 px-4 transition-all duration-500 ${isScrolled ? 'pt-2' : 'pt-4'} ${
        showNavbar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      }`}>
        <nav className={`w-full max-w-6xl flex items-center justify-between px-6 py-2.5 rounded-2xl transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl' 
            : 'bg-white/10 dark:bg-slate-950/20 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.25)]'
        }`}>
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <img
              src={isScrolled ? "/logo%204.png" : "/logo%203.png"}
              alt="We Connect"
              className="h-[56px] object-contain transition-all duration-300"
            />
          </div>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-8 relative">
            <button suppressHydrationWarning onClick={() => window.scrollTo(0, 0)} className={`font-bold transition-colors duration-300 text-sm ${isScrolled ? 'text-[#4A5568] dark:text-slate-200 hover:text-[#1E8E3E] dark:hover:text-emerald-400' : 'text-white/90 hover:text-emerald-400'}`}>Home</button>
            <button suppressHydrationWarning onClick={() => scrollTo('about')} className={`font-bold transition-colors duration-300 text-sm ${isScrolled ? 'text-[#4A5568] dark:text-slate-200 hover:text-[#1E8E3E] dark:hover:text-emerald-400' : 'text-white/90 hover:text-emerald-400'}`}>About</button>
            <button suppressHydrationWarning onClick={() => scrollTo('how-it-works')} className={`font-bold transition-colors duration-300 text-sm ${isScrolled ? 'text-[#4A5568] dark:text-slate-200 hover:text-[#1E8E3E] dark:hover:text-emerald-400' : 'text-white/90 hover:text-emerald-400'}`}>Process</button>
            <button suppressHydrationWarning onClick={() => scrollTo('services')} className={`font-bold transition-colors duration-300 text-sm ${isScrolled ? 'text-[#4A5568] dark:text-slate-200 hover:text-[#1E8E3E] dark:hover:text-emerald-400' : 'text-white/90 hover:text-emerald-400'}`}>Services</button>

            <div className="relative">
              <button
                suppressHydrationWarning
                onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                onBlur={() => setTimeout(() => setLoginDropdownOpen(false), 200)}
                className={`font-bold transition-colors duration-300 flex items-center gap-1 text-sm ${isScrolled ? 'text-[#4A5568] dark:text-slate-200 hover:text-[#1E8E3E] dark:hover:text-emerald-400' : 'text-white/90 hover:text-emerald-400'}`}
              >
                Login <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>

              {loginDropdownOpen && (
                <div className="absolute top-full right-0 mt-3 w-56 bg-white/90 backdrop-blur-xl border border-[#E2E8F0] dark:border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.12)] rounded-xl flex flex-col overflow-hidden z-50 animate-fade-in dark:bg-slate-900/95">
                  <button suppressHydrationWarning onMouseDown={() => router.push('/client-login')} className="text-left px-5 py-3 text-sm font-bold text-[#4A5568] hover:bg-[#E8F5E9] hover:text-[#1E8E3E] transition-colors flex items-center gap-3 dark:text-slate-200 dark:hover:bg-emerald-950/40">
                    <span className="material-symbols-outlined text-[18px] text-[#1E8E3E]">corporate_fare</span> Client Login
                  </button>
                  <button suppressHydrationWarning onMouseDown={() => router.push('/vendor-login')} className="text-left px-5 py-3 text-sm font-bold text-[#4A5568] hover:bg-[#E3EEFF] hover:text-[#0B5ED7] transition-colors flex items-center gap-3 dark:text-slate-200 dark:hover:bg-blue-950/40">
                    <span className="material-symbols-outlined text-[18px] text-[#0B5ED7]">local_shipping</span> Vendor Login
                  </button>
                  <button suppressHydrationWarning onMouseDown={() => router.push('/user-login')} className="text-left px-5 py-3 text-sm font-bold text-[#4A5568] hover:bg-[#FFF8E1] hover:text-[#FFC107] transition-colors flex items-center gap-3 dark:text-slate-200 dark:hover:bg-amber-950/40">
                    <span className="material-symbols-outlined text-[18px] text-[#FFC107]">person</span> User Login
                  </button>
                  <div className="border-t border-[#E2E8F0] dark:border-slate-800 my-1"></div>
                  <button suppressHydrationWarning onMouseDown={() => router.push('/admin-login')} className="text-left px-5 py-3 text-sm font-bold text-[#4A5568] hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center gap-3 dark:text-slate-200 dark:hover:bg-slate-800/40">
                    <span className="material-symbols-outlined text-[18px] text-gray-700 dark:text-gray-300">admin_panel_settings</span> Admin Login
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Toggle */}
          <button suppressHydrationWarning className={`p-2 transition-colors duration-300 lg:hidden ${isScrolled ? 'text-[#1A1A2E] dark:text-slate-200' : 'text-white'}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span className="material-symbols-outlined text-[28px]">{mobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </nav>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-4 right-4 mt-2 bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl py-4 px-6 flex flex-col gap-4 animate-fade-in border border-slate-200/80 dark:bg-slate-900/95 dark:border-slate-800/80 lg:hidden">
            <button suppressHydrationWarning onClick={() => { window.scrollTo(0, 0); setMobileMenuOpen(false); }} className="text-left text-base font-bold text-[#1A1A2E] dark:text-white py-3 border-b border-[#E2E8F0] dark:border-slate-800">Home</button>
            <button suppressHydrationWarning onClick={() => scrollTo('about')} className="text-left text-base font-bold text-[#1A1A2E] dark:text-white py-3 border-b border-[#E2E8F0] dark:border-slate-800">About</button>
            <button suppressHydrationWarning onClick={() => scrollTo('how-it-works')} className="text-left text-base font-bold text-[#1A1A2E] dark:text-white py-3 border-b border-[#E2E8F0] dark:border-slate-800">Process</button>
            <button suppressHydrationWarning onClick={() => scrollTo('services')} className="text-left text-base font-bold text-[#1A1A2E] dark:text-white py-3 border-b border-[#E2E8F0] dark:border-slate-800">Services</button>
            <div className="flex flex-col gap-3 mt-2">
              <button suppressHydrationWarning onClick={() => router.push('/client-login')} className="w-full text-left py-3 text-base font-bold text-[#1E8E3E] border-b border-[#E2E8F0] dark:border-slate-800">Client Login</button>
              <button suppressHydrationWarning onClick={() => router.push('/vendor-login')} className="w-full text-left py-3 text-base font-bold text-[#0B5ED7] border-b border-[#E2E8F0] dark:border-slate-800">Vendor Login</button>
              <button suppressHydrationWarning onClick={() => router.push('/user-login')} className="w-full text-left py-3 text-base font-bold text-[#FFC107] border-b border-[#E2E8F0] dark:border-slate-800">User Login</button>
              <button suppressHydrationWarning onClick={() => router.push('/admin-login')} className="w-full text-left py-3 text-base font-bold text-gray-700 dark:text-slate-300">Admin Login</button>
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN LAYOUT - Hero Section */}
      <main id="home" className="flex flex-col w-full relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)', minHeight: '100vh' }}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#1E8E3E] rounded-full blur-[150px] opacity-20 animate-pulse pointer-events-none" />

        <section className="flex w-full relative z-10 flex-col lg:flex-row justify-center px-4 sm:px-8 lg:px-20 pt-32 pb-16 lg:py-20 min-h-screen items-center gap-12 lg:gap-20">

          <div className="w-full max-w-[700px] flex flex-col items-center lg:items-start text-center lg:text-left">

            {/* Hero Copy */}
            <div className="flex flex-col items-center lg:items-start">
              {/* Badge */}
              <motion.span 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-block px-5 py-2 bg-white/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-8 backdrop-blur-md border border-white/10"
              >
                India's Most Advanced E-Waste Platform
              </motion.span>

              {/* Headline */}
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[2.5rem] sm:text-[3.5rem] lg:text-[4.5rem] leading-[1.1] font-headline font-black text-white mb-8 drop-shadow-2xl tracking-tighter"
              >
                INDIA’S SMART <br /> <span className="text-emerald-400">E-WASTE</span> MARKETPLACE
              </motion.h1>

              {/* Tagline */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <h2 className="text-xl lg:text-2xl font-bold text-white/90 mb-2">
                  Transparent. Compliant. Profitable.
                </h2>
              </motion.div>

              {/* Subtext */}
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-white/70 text-[1.1rem] lg:text-[1.2rem] font-medium leading-relaxed mb-12 max-w-xl"
              >
                Manage your e-waste the smart way with audits, bidding, and verified vendors – all in one platform.
              </motion.p>

              {/* Action Buttons */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-5 mb-16 w-full sm:w-auto"
              >
                <button 
                  onClick={() => router.push('/get-started')}
                  className="group relative px-10 py-5 bg-emerald-600 rounded-2xl text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-900/40 hover:bg-emerald-500 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
                  Raise Pickup Request
                </button>
                <button 
                  onClick={() => router.push('/get-started')}
                  className="group relative px-10 py-5 bg-white/5 border-2 border-white/20 rounded-2xl text-white font-black text-sm uppercase tracking-[0.2em] hover:bg-white hover:text-slate-900 hover:border-white hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden"
                >
                  <span className="material-symbols-outlined text-xl">verified_user</span>
                  Become a Vendor
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-8 sm:gap-12 pt-10 border-t border-white/10 w-full justify-center lg:justify-start"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-[26px]">verified</span>
                  <span className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">CPCB Authorized</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-[26px]">balance</span>
                  <span className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">Transparent Bidding</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-[26px]">shield</span>
                  <span className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">Secure Payments</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Demo Box Component */}
          <div className="w-full max-w-md lg:max-w-none flex justify-center">
            <DemoBox />
          </div>
        </section>
      </main>

      {/* 3. SERVICES SECTION */}
      <section id="services" className="py-24 px-6 md:px-10 relative z-10 bg-[#FFFFFF] border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-[#1E8E3E] uppercase tracking-[0.2em] mb-4">Our Expertise</h2>
            <h3 className="text-4xl font-headline font-extrabold text-[#1A1A2E]">Comprehensive Services</h3>
            <div className="w-20 h-1 bg-gradient-to-r from-[#1E8E3E] to-[#0B5ED7] mx-auto mt-6 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { icon: "corporate_fare", title: "Corporate E-Waste Disposal", desc: "Enterprise-grade disposal solutions for large organizations." },
              { icon: "devices", title: "IT Asset Recycling", desc: "Safe and secure recycling of computers, servers, and mobile devices." },
              { icon: "battery_charging_full", title: "Battery Disposal", desc: "Environmentally friendly disposal of industrial and consumer batteries." },
              { icon: "gavel", title: "Scrap Auction", desc: "Maximize value through our transparent competitive bidding system." },
              { icon: "verified", title: "Compliance Management", desc: "End-to-end documentation and regulatory reporting." }
            ].map((service, i) => (
              <div key={i} className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-[0_4px_16px_rgba(0,0,0,0.04)] rounded-[20px] p-8 flex flex-col items-center text-center group hover:border-emerald-500 transition-all hover:-translate-y-1">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors">
                  <span className="material-symbols-outlined text-3xl text-emerald-600 group-hover:text-white transition-colors">{service.icon}</span>
                </div>
                <h4 className="font-bold text-[#1A1A2E] mb-3 leading-tight">{service.title}</h4>
                <p className="text-xs text-[#4A5568] leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ABOUT SECTION */}
      <section id="about" className="py-24 px-6 md:px-10 relative z-10 bg-[#0f172a] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">Who We Are</h2>
              <h3 className="text-4xl font-headline font-extrabold text-white mb-8 leading-tight">India’s Trusted E-Waste Bridge</h3>
              <p className="text-xl text-slate-100 leading-relaxed font-medium mb-6">
                At <span className="text-emerald-400 font-extrabold">We Connect</span>, we are building a smarter and more transparent ecosystem for responsible e-waste management across India.
              </p>
              <p className="text-slate-400 leading-relaxed mb-10">
                We act as a trusted bridge between organizations generating e-waste and authorized recyclers, ensuring seamless disposal, compliance, and value realization — all through a single digital platform.
              </p>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-white/10">
                  <h4 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">rocket_launch</span> Mission
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">To create a scalable and compliant e-waste ecosystem that helps organizations dispose responsibly while maximizing value recovery.</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-white/10">
                  <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">visibility</span> Vision
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">To become India’s most trusted e-waste aggregator platform, driving sustainability through technology, transparency, and accountability.</p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-emerald-600 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="material-symbols-outlined text-[120px]">handshake</span>
                </div>
                <h4 className="text-xl font-bold mb-6 relative z-10">What We Do</h4>
                <ul className="space-y-4 relative z-10">
                  {[
                    "Corporates, hospitals, manufacturers can easily raise disposal requests",
                    "Verified vendors conduct audits, pickups, and recycling",
                    "Structured bidding ensures best price & full transparency",
                    "Digital management of all compliance documents"
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm font-medium text-white">
                      <span className="material-symbols-outlined text-emerald-300">check_circle</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white/5 backdrop-blur-sm p-8 rounded-[2.5rem] border border-white/10 shadow-sm">
                <h4 className="text-xl font-bold text-white mb-6">Our Role in the Ecosystem</h4>
                <div className="grid gap-4">
                  {[
                    { icon: "link", text: "Connects verified clients with authorized vendors" },
                    { icon: "fact_check", text: "Enables audit-based evaluation before disposal" },
                    { icon: "gavel", text: "Introduces sealed and open bidding for fair pricing" },
                    { icon: "verified_user", text: "Ensures complete compliance with regulations" },
                    { icon: "track_changes", text: "Tracks every stage from request to certification" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors text-white">
                      <span className="material-symbols-outlined text-emerald-400 text-[20px]">{item.icon}</span>
                      <span className="text-xs font-bold text-slate-200">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-24 px-6 md:px-10 relative z-10 bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-[#1E8E3E] uppercase tracking-[0.2em] mb-4">The Process</h2>
            <h3 className="text-4xl font-headline font-extrabold text-[#1A1A2E]">How It Works</h3>
            <div className="w-20 h-1 bg-gradient-to-r from-[#1E8E3E] to-[#0B5ED7] mx-auto mt-6 rounded-full" />
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-[60px] left-[50px] right-[50px] h-0.5 bg-slate-100" />
            
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-6">
              {[
                { step: "01", title: "Upload Requirement", icon: "upload_file" },
                { step: "02", title: "Vendor Audit", icon: "person_search" },
                { step: "03", title: "Sealed Bidding", icon: "lock" },
                { step: "04", title: "Live Auction", icon: "sensors" },
                { step: "05", title: "Final Quote", icon: "description" },
                { step: "06", title: "Payment", icon: "payments" },
                { step: "07", title: "Pickup & Compliance", icon: "local_shipping" }
              ].map((item, i) => (
                <div key={i} className="relative flex flex-col items-center text-center group">
                  <div className="w-20 h-20 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center mb-6 shadow-sm group-hover:border-emerald-500 group-hover:shadow-lg transition-all relative z-10">
                    <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-emerald-600 transition-colors">{item.icon}</span>
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center border-4 border-white">
                      {item.step}
                    </div>
                  </div>
                  <h4 className="font-bold text-[#1A1A2E] text-xs leading-tight">{item.title}</h4>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOR CLIENTS & VENDORS */}
      <section className="py-24 px-6 md:px-10 relative z-10 bg-[#F5F7FA] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 lg:gap-12">

          {/* For Clients */}
          <div className="bg-[#FFFFFF] border-t-4 border-t-[#1E8E3E] shadow-[0_10px_40px_rgba(0,0,0,0.05)] rounded-[2.5rem] p-10 lg:p-12 flex flex-col hover:-translate-y-1 transition-transform relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[100px] text-[#1E8E3E]">corporate_fare</span>
            </div>
            <span className="material-symbols-outlined text-[48px] text-[#1E8E3E] mb-4">corporate_fare</span>
            <h3 className="text-3xl font-headline font-extrabold text-[#1A1A2E] mb-2 tracking-tight">For Clients</h3>
            <p className="text-[#4A5568] font-medium mb-8 uppercase text-[10px] tracking-[0.2em]">Maximize returns on disposal</p>

            <ul className="space-y-4 mb-12 flex-grow">
              {[
                { title: "Raise pickup requests", icon: "add_task" },
                { title: "Track status in real-time", icon: "route" },
                { title: "Get best price via bidding", icon: "trending_up" },
                { title: "Download compliance certificates", icon: "verified" }
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">{item.icon}</span>
                  <span className="text-sm font-bold text-slate-700">{item.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* For Vendors */}
          <div className="bg-[#FFFFFF] border-t-4 border-t-[#0B5ED7] shadow-[0_10px_40px_rgba(0,0,0,0.05)] rounded-[2.5rem] p-10 lg:p-12 flex flex-col hover:-translate-y-1 transition-transform relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[100px] text-[#0B5ED7]">local_shipping</span>
            </div>
            <span className="material-symbols-outlined text-[48px] text-[#0B5ED7] mb-4">local_shipping</span>
            <h3 className="text-3xl font-headline font-extrabold text-[#1A1A2E] mb-2 tracking-tight">For Vendors</h3>
            <p className="text-[#4A5568] font-medium mb-8 uppercase text-[10px] tracking-[0.2em]">Grow your recycling business</p>

            <ul className="space-y-4 mb-12 flex-grow">
              {[
                { title: "Access verified leads", icon: "verified" },
                { title: "Participate in bidding", icon: "gavel" },
                { title: "Manage pickups seamlessly", icon: "inventory" },
                { title: "Earn consistently", icon: "payments" }
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <span className="material-symbols-outlined text-blue-600 text-[20px]">{item.icon}</span>
                  <span className="text-sm font-bold text-slate-700">{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 7. WHY CHOOSE SECTION */}
      <section className="py-24 px-6 md:px-10 relative z-10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-100 rounded-full blur-3xl opacity-50" />
              <img 
                src="https://images.unsplash.com/photo-1591405351990-4726e331f141?auto=format&fit=crop&q=80&w=800" 
                alt="E-Waste Recycling" 
                className="rounded-[3rem] shadow-2xl relative z-10 object-cover aspect-square"
              />
              <div className="absolute -bottom-6 -right-6 bg-emerald-600 text-white p-8 rounded-[2rem] shadow-xl z-20">
                <span className="text-4xl font-black block">100%</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Compliant Process</span>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-[#1E8E3E] uppercase tracking-[0.2em] mb-4">The Advantage</h2>
              <h3 className="text-4xl font-headline font-extrabold text-[#1A1A2E] mb-8 leading-tight">Why Choose We Connect</h3>
              
              <div className="grid gap-6">
                {[
                  { title: "End-to-end digital process", icon: "settings_suggest" },
                  { title: "Transparent pricing through auction model", icon: "analytics" },
                  { title: "Verified vendor network", icon: "group_add" },
                  { title: "Real-time tracking and updates", icon: "update" },
                  { title: "Centralized document management", icon: "folder_managed" },
                  { title: "Dedicated support for every transaction", icon: "support_agent" }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 transition-colors">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px] group-hover:text-white transition-colors">{item.icon}</span>
                    </div>
                    <p className="text-slate-700 font-bold self-center">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. COMMITMENT SECTION */}
      <section className="py-24 px-6 md:px-10 relative z-10 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-16">
            <h2 className="text-sm font-bold text-[#1E8E3E] uppercase tracking-[0.2em] mb-4">Our Promise</h2>
            <h3 className="text-4xl font-headline font-extrabold text-[#1A1A2E] tracking-tight">Our Commitment</h3>
            <div className="w-20 h-1 bg-emerald-500 mx-auto mt-6 rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Responsible recycling practices", icon: "recycling" },
              { title: "Full compliance with environmental norms", icon: "verified" },
              { title: "Reliable vendor partnerships", icon: "handshake" },
              { title: "Seamless client experience", icon: "auto_awesome" }
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-emerald-500 transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm mx-auto group-hover:bg-emerald-600 transition-colors">
                  <span className="material-symbols-outlined text-3xl text-emerald-600 group-hover:text-white transition-colors">{item.icon}</span>
                </div>
                <p className="font-bold text-slate-800 leading-relaxed text-sm">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. CONTACT SECTION */}
      <section id="contact" className="py-24 px-6 md:px-10 relative z-10 bg-[#F5F7FA] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#1A1A2E] rounded-[3rem] overflow-hidden shadow-2xl flex flex-col lg:flex-row">
            <div className="p-12 lg:p-20 flex-grow">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">Get In Touch</h2>
              <h3 className="text-4xl font-headline font-extrabold text-white mb-12">Let's build a greener <br />future together</h3>
              
              <div className="space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-emerald-400">mail</span>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Email Us</p>
                    <p className="text-white font-bold text-lg">support@weconnect.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-emerald-400">call</span>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Call Us</p>
                    <p className="text-white font-bold text-lg">+91-XXXXXXXXXX</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-emerald-400">location_on</span>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Location</p>
                    <p className="text-white font-bold text-lg">Bangalore, India</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:w-[38%] bg-emerald-600 p-12 lg:px-8 lg:py-16 flex flex-col justify-center text-center">
              <span className="material-symbols-outlined text-white text-[80px] mb-8 opacity-20">recycling</span>
              <h4 className="text-2xl font-black text-white mb-6 whitespace-nowrap">"Where Waste Becomes Value"</h4>
              <p className="text-emerald-100 font-medium leading-relaxed mb-10">Join India's most advanced e-waste platform and start your journey towards responsible disposal.</p>
              <button onClick={() => router.push('/get-started')} className="w-full bg-white text-emerald-600 font-black text-xs uppercase tracking-widest py-5 rounded-2xl shadow-xl hover:bg-slate-50 transition-all">
                Get Started Now
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-20 px-6 md:px-10 bg-[#0f172a] text-slate-400 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 cursor-pointer mb-8" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                <img src="/logo%203.png" alt="We Connect" className="h-[70px] object-contain" />
              </div>
              <p className="text-sm leading-relaxed max-w-sm mb-8">
                India’s leading digital e-waste marketplace connecting authorized recyclers with organizations for transparent, compliant, and profitable disposal.
              </p>
              <div className="flex gap-4">
                {[
                  { icon: 'public', label: 'Website' },
                  { icon: 'mail', label: 'Email' },
                  { icon: 'call', label: 'Phone' },
                  { icon: 'distance', label: 'Network' }
                ].map(social => (
                  <div key={social.label} title={social.label} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald-600 hover:border-emerald-600 transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-[18px] text-white">{social.icon}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-8">Quick Links</h4>
              <ul className="space-y-4">
                {['Home', 'About Us', 'How It Works', 'Services', 'Contact'].map(item => (
                  <li key={item}>
                    <button onClick={() => scrollTo(item.toLowerCase().replace(/ /g, '-'))} className="text-sm hover:text-emerald-400 transition-colors">{item}</button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-8">Legal & Policy</h4>
              <ul className="space-y-4">
                {['Privacy Policy', 'Terms of Service', 'E-Waste Policy', 'Compliance'].map(item => (
                  <li key={item}>
                    <button className="text-sm hover:text-emerald-400 transition-colors">{item}</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] uppercase tracking-widest font-bold">
              © 2026 We Connect Vendors LLP. All Rights Reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-white">System Status: Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center dark:bg-slate-950"><div className="w-8 h-8 border-4 border-[#1E8E3E] border-t-transparent rounded-full animate-spin"></div></div>}>
      <LandingPageContent />
    </Suspense>
  );
}
