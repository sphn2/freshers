"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  LogIn,
  LogOut,
  QrCode,
  ShieldCheck,
  Utensils,
  Phone,
  Mail,
  MapPin,
  Globe,
  ExternalLink,
} from "lucide-react";

export function SiteProviderFrame({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SiteFrame>{children}</SiteFrame>
    </AuthProvider>
  );
}

function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const [currentYear, setCurrentYear] = useState<number>(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Strict role-isolated navigation links: GATE_STAFF sees ONLY Gate Desk, FOOD_STAFF sees ONLY Food Counter
  let links: { href: string; label: string; icon: React.ElementType }[] = [];

  if (!user || role === "STUDENT") {
    links = [
      { href: "/", label: "What's on", icon: CalendarDays },
    ];
  } else if (role === "GATE_STAFF") {
    links = [
      { href: "/scanner/gate", label: "Gate Entry Desk", icon: QrCode },
    ];
  } else if (role === "FOOD_STAFF") {
    links = [
      { href: "/scanner/food", label: "Food Counter Desk", icon: Utensils },
    ];
  } else if (role === "OFFLINE_COLLECTOR") {
    links = [
      { href: "/offline", label: "Cash Desk", icon: Banknote },
    ];
  } else if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "EVENT_MANAGER") {
    links = [
      { href: "/", label: "What's on", icon: CalendarDays },
      { href: "/scanner/gate", label: "Gate Desk", icon: QrCode },
      { href: "/scanner/food", label: "Food Counter", icon: Utensils },
      { href: "/offline", label: "Cash Desk", icon: Banknote },
      { href: "/admin", label: "Operations", icon: ShieldCheck },
    ];
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand-lockup no-underline flex items-center gap-3">
            <img
              src="/college_logo.png"
              alt="Sphoorthy Engineering College (UGC Autonomous)"
              className="h-10 sm:h-12 w-auto object-contain max-w-[220px] sm:max-w-[340px]"
            />
          </Link>

          <nav aria-label="Main navigation" className="site-nav hidden md:flex">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="site-nav-link"
                data-active={pathname === href}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white font-extrabold text-xs grid place-items-center shadow-xs border border-amber-300">
                    {user.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900 leading-tight">{user.full_name}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[9px] font-extrabold tracking-[.1em] text-amber-900 bg-amber-100 border border-amber-300/80 uppercase">
                      {role.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Sign out"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 hover:border-rose-300 transition-all shadow-2xs cursor-pointer active:scale-95 ml-1"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link href="/auth/login" className="button-primary !min-h-10 !px-4">
                Staff sign in <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {/* Mobile Header Action / Logout */}
          {user ? (
            <div className="flex md:hidden items-center gap-2">
              <div className="flex flex-col text-right">
                <span className="text-[11px] font-bold text-slate-900 truncate max-w-[100px]">{user.full_name?.split(" ")[0]}</span>
                <span className="text-[8px] font-extrabold tracking-wider text-amber-800 uppercase">{role.replaceAll("_", " ")}</span>
              </div>
              <button
                type="button"
                aria-label="Sign out"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 active:scale-95 transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link href="/auth/login" aria-label="Staff sign in" className="button-primary !min-h-10 !px-3 md:hidden">
              <LogIn className="h-4 w-4" />
            </Link>
          )}
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer bg-[#17221e] border-t border-[#ded7c9]/20 text-[#e2dcd0] mt-12">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 pt-12 pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10">
            
            {/* Column 1: Institution & Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/95 p-1.5 rounded-lg shadow-md border border-white/20">
                  <img
                    src="/college_logo.png"
                    alt="Sphoorthy Engineering College (UGC Autonomous)"
                    className="h-9 sm:h-11 w-auto object-contain max-w-[240px]"
                  />
                </div>
              </div>
              <p className="text-xs text-[#b5ad9e] leading-relaxed">
                Official event calendar, pass generation, gate verification, and food voucher platform for Sphoorthy Engineering College.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Systems Active & Operational
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#d3a52b] uppercase tracking-widest">Navigation</h4>
              <ul className="space-y-2 text-xs">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[#c7bfb1] hover:text-white transition-colors inline-flex items-center gap-1.5 group">
                      <span className="text-[#d3a52b] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">›</span>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Contact Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#d3a52b] uppercase tracking-widest">Contact Information</h4>
              <div className="space-y-2.5 text-xs text-[#c7bfb1]">
                <a 
                  href="tel:8179645560" 
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-[#d3a52b]/50 hover:bg-white/10 transition-all text-white group"
                >
                  <div className="p-2 rounded-md bg-[#d3a52b]/15 text-[#d3a52b] group-hover:bg-[#d3a52b] group-hover:text-[#17221e] transition-colors shrink-0">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#a39a88] uppercase tracking-wider font-extrabold">Phone Number</span>
                    <span className="font-mono font-bold text-xs tracking-wide">+91 8179645560</span>
                  </div>
                </a>

                <a 
                  href="mailto:founder@rudvay.tech" 
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-[#d3a52b]/50 hover:bg-white/10 transition-all text-white group"
                >
                  <div className="p-2 rounded-md bg-[#d3a52b]/15 text-[#d3a52b] group-hover:bg-[#d3a52b] group-hover:text-[#17221e] transition-colors shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] text-[#a39a88] uppercase tracking-wider font-extrabold">Official Email</span>
                    <span className="font-mono font-medium text-xs truncate block text-amber-200/90">founder@rudvay.tech</span>
                  </div>
                </a>

                <div className="flex items-start gap-2.5 pt-1 text-[11px] text-[#a39a88]">
                  <MapPin className="h-4 w-4 text-[#d3a52b] shrink-0 mt-0.5" />
                  <span>Sphoorthy Engineering College Campus, Nadergul, Hyderabad</span>
                </div>
              </div>
            </div>

            {/* Column 4: Design & Development Credit */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#d3a52b] uppercase tracking-widest">Engineering & Design</h4>
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/80 via-[#17221e] to-emerald-900/40 border border-emerald-500/30 space-y-3 shadow-lg relative overflow-hidden group">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-400/50 grid place-items-center text-emerald-300 font-extrabold text-sm shadow-inner shrink-0">
                    R
                  </div>
                  <div>
                    <a 
                      href="https://rudvay.tech" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-white hover:text-emerald-300 text-xs tracking-wide flex items-center gap-1 group/link transition-colors"
                    >
                      Rudvay Tech Pvt Ltd
                      <ExternalLink className="h-3 w-3 opacity-70 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                    <p className="text-[10px] text-emerald-400/90 font-medium tracking-tight">Powering Intelligent Security</p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/10 text-xs space-y-1.5">
                  <p className="text-[10px] uppercase text-[#a39a88] tracking-widest font-extrabold">Designed & Developed by</p>
                  <p className="font-bold text-white text-sm bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-100 bg-clip-text text-transparent">
                    SAI HARSHA CHERUKU
                  </p>
                  <a 
                    href="https://rudvay.tech" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 hover:text-emerald-200 font-semibold hover:underline pt-0.5"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    https://rudvay.tech
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* Sub-footer Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#9a9180]">
            <div className="flex items-center gap-3 flex-wrap">
              <p>© {currentYear} Sphoorthy Engineering College. All rights reserved.</p>
              <span className="text-[#9a9180]/40">•</span>
              <Link href="/privacy" className="text-amber-200/80 hover:text-amber-200 font-semibold underline transition-colors">
                Privacy Policy
              </Link>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-center sm:text-right flex-wrap justify-center sm:justify-end">
              <span>Designed and developed by</span>
              <span className="font-bold text-white">SAI HARSHA CHERUKU</span>
              <span>from</span>
              <a 
                href="https://rudvay.tech" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-bold text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1 transition-colors"
              >
                Rudvay Tech Pvt Ltd
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
      </footer>

      {user && links.length > 0 && (
        <nav aria-label="Staff shortcuts" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-[#fbf9f4]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-around">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 text-center text-[9px] font-bold leading-tight ${pathname === href ? "text-amber-700 font-extrabold" : "text-slate-500"}`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 text-center text-[9px] font-bold leading-tight text-rose-600 active:scale-95 transition-transform cursor-pointer"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign Out
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
