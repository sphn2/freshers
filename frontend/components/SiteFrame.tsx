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
  FileText,
  Cookie,
  RefreshCw,
  Building2,
  Scale,
} from "lucide-react";
import VerifyPaymentModal from "@/components/VerifyPaymentModal";

export function SiteProviderFrame({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SiteFrame>{children}</SiteFrame>
    </AuthProvider>
  );
}

function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, hasRole, logout } = useAuth();
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Ensure scroll is reset to top whenever navigating between pages
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  // Dynamically build desk and management links according to granted privileges
  let links: { href: string; label: string; icon: React.ElementType }[] = [];

  if (!user || role === "STUDENT") {
    links = [
      { href: "/", label: "What's on", icon: CalendarDays },
    ];
  } else {
    // Show campus events calendar link for administrative or event coordination staff
    if (hasRole(["SUPER_ADMIN", "ADMIN", "EVENT_MANAGER"])) {
      links.push({ href: "/", label: "What's on", icon: CalendarDays });
    }

    if (hasRole(["GATE_STAFF"])) {
      links.push({ href: "/scanner/gate", label: "Gate Desk", icon: QrCode });
    }
    if (hasRole(["FOOD_STAFF"])) {
      links.push({ href: "/scanner/food", label: "Food Counter", icon: Utensils });
    }
    if (hasRole(["OFFLINE_COLLECTOR"])) {
      links.push({ href: "/offline", label: "Cash Desk", icon: Banknote });
    }
    if (hasRole(["SUPER_ADMIN", "ADMIN", "EVENT_MANAGER"])) {
      links.push({ href: "/admin", label: "Operations", icon: ShieldCheck });
    }

    // Fallback: If no operational desk has been granted yet, still provide "What's on"
    if (links.length === 0) {
      links.push({ href: "/", label: "What's on", icon: CalendarDays });
    }
  }

  return (
    <>
      {/* Top Utility & Corporate Compliance Bar */}
      <div className="bg-[#101915] text-[#d6cfbe] text-[11px] border-b border-white/10 px-4 py-2 sm:py-1.5 transition-colors">
        <div className="mx-auto max-w-[1240px] flex flex-col md:flex-row items-center justify-between gap-2">
          {/* Corporate Entity & CIN Notice */}
          <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
            <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
              <Building2 className="h-3.5 w-3.5 text-amber-400" />
              Rudvay Tech Private Limited
            </span>
            <span className="hidden sm:inline text-white/30">•</span>
            <span className="font-mono text-[10px] text-amber-100/90 font-semibold bg-white/10 px-2 py-0.5 rounded border border-white/10">
              CIN: U62011TS2026PTC223549
            </span>
            <span className="hidden lg:inline text-white/30">•</span>
            <span className="hidden lg:inline text-[#a69e8e]">
              Official Campus Ticketing & Verification Platform
            </span>
          </div>

          {/* Direct Support Contacts & Legal Policies */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center text-[10px] sm:text-[11px]">
            <a
              href="tel:+918179645560"
              className="inline-flex items-center gap-1 text-[#e7e1d5] hover:text-amber-300 transition-colors font-medium font-mono"
              title="Call Helpline"
            >
              <Phone className="h-3 w-3 text-amber-400" />
              +91 8179645560
            </a>

            <span className="text-white/20">|</span>

            <a
              href="mailto:contact@rudvay.tech"
              className="inline-flex items-center gap-1 text-[#e7e1d5] hover:text-amber-300 transition-colors font-medium"
              title="Official Enquiries"
            >
              <Mail className="h-3 w-3 text-amber-400" />
              contact@rudvay.tech
            </a>

            <span className="hidden sm:inline text-white/20">|</span>

            <a
              href="mailto:founder@rudvay.tech"
              className="hidden sm:inline-flex items-center gap-1 text-[#e7e1d5] hover:text-amber-300 transition-colors font-medium"
              title="Founder Desk"
            >
              <Mail className="h-3 w-3 text-amber-400" />
              founder@rudvay.tech
            </a>

            <span className="hidden xl:inline text-white/20">|</span>

            {/* Quick Policies Links */}
            <div className="hidden xl:flex items-center gap-2.5 text-amber-200/80">
              <Link href="/terms" className="hover:text-amber-100 hover:underline">Terms</Link>
              <span className="text-white/20">•</span>
              <Link href="/privacy" className="hover:text-amber-100 hover:underline">Privacy</Link>
              <span className="text-white/20">•</span>
              <Link href="/cookies" className="hover:text-amber-100 hover:underline">Cookies</Link>
              <span className="text-white/20">•</span>
              <Link href="/refund-policy" className="hover:text-amber-100 hover:underline">Refunds</Link>
            </div>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand-lockup no-underline flex items-center gap-3">
            <img
              src="/college_logo.png"
              alt="Sphoorthy Engineering College (UGC Autonomous)"
              className="h-10 sm:h-12 w-auto object-contain max-w-[220px] sm:max-w-[340px]"
            />
          </Link>

          <nav aria-label="Main navigation" className="site-nav hidden md:flex items-center gap-1">
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

            {/* Direct Header Policy Links */}
            <Link
              href="/terms"
              className="site-nav-link !text-xs font-semibold text-slate-600 hover:text-slate-900"
              data-active={pathname === "/terms"}
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="site-nav-link !text-xs font-semibold text-slate-600 hover:text-slate-900"
              data-active={pathname === "/privacy"}
            >
              Privacy
            </Link>
            <Link
              href="/cookies"
              className="site-nav-link !text-xs font-semibold text-slate-600 hover:text-slate-900"
              data-active={pathname === "/cookies"}
            >
              Cookies
            </Link>
            <Link
              href="/refund-policy"
              className="site-nav-link !text-xs font-semibold text-slate-600 hover:text-slate-900"
              data-active={pathname === "/refund-policy"}
            >
              Refund Policy
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
              <span>Verify Payment / Ticket</span>
            </button>

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
          <div className="flex md:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              title="Verify Payment / Resend Ticket"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
              <span>Verify Payment</span>
            </button>
            {user ? (
              <div className="flex items-center gap-1.5">
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
              <Link href="/auth/login" aria-label="Staff sign in" className="button-primary !min-h-9 !px-2.5">
                <LogIn className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer bg-[#131b18] border-t border-[#ded7c9]/20 text-[#e2dcd0] mt-12">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 pt-12 pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10">
            
            {/* Column 1: Institution & Official Portal */}
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
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Rudvay Tech Private Limited</span>
                </div>
                <div className="font-mono text-[10px] text-amber-200/90 font-semibold">
                  CIN: U62011TS2026PTC223549
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Secure Gate & QR Verification Active
              </div>
            </div>

            {/* Column 2: Legal Policies & Compliance */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#d3a52b] uppercase tracking-widest flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" /> Policies & Terms
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link
                    href="/terms"
                    className="text-[#c7bfb1] hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    <FileText className="h-3.5 w-3.5 text-amber-400 opacity-70 group-hover:opacity-100" />
                    <span>Terms & Conditions</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-[#c7bfb1] hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-400 opacity-70 group-hover:opacity-100" />
                    <span>Privacy Policy</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cookies"
                    className="text-[#c7bfb1] hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    <Cookie className="h-3.5 w-3.5 text-amber-400 opacity-70 group-hover:opacity-100" />
                    <span>Cookie Policy</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/refund-policy"
                    className="text-[#c7bfb1] hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-amber-400 opacity-70 group-hover:opacity-100" />
                    <span>Cancellation & Refund Policy</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#events"
                    className="text-[#c7bfb1] hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-amber-400 opacity-70 group-hover:opacity-100" />
                    <span>Campus Event Calendar</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#d3a52b] uppercase tracking-widest">Contact Information</h4>
              <div className="space-y-2.5 text-xs text-[#c7bfb1]">
                <a 
                  href="tel:+918179645560" 
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-[#d3a52b]/50 hover:bg-white/10 transition-all text-white group"
                >
                  <div className="p-2 rounded-md bg-[#d3a52b]/15 text-[#d3a52b] group-hover:bg-[#d3a52b] group-hover:text-[#17221e] transition-colors shrink-0">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-[#a39a88] uppercase tracking-wider font-extrabold">Helpline Number</span>
                    <span className="font-mono font-bold text-xs tracking-wide">+91 8179645560</span>
                  </div>
                </a>

                <a 
                  href="mailto:contact@rudvay.tech" 
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-[#d3a52b]/50 hover:bg-white/10 transition-all text-white group"
                >
                  <div className="p-2 rounded-md bg-[#d3a52b]/15 text-[#d3a52b] group-hover:bg-[#d3a52b] group-hover:text-[#17221e] transition-colors shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] text-[#a39a88] uppercase tracking-wider font-extrabold">Official Email</span>
                    <span className="font-mono font-medium text-xs truncate block text-amber-200/90">contact@rudvay.tech</span>
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
                    <span className="block text-[9px] text-[#a39a88] uppercase tracking-wider font-extrabold">Founder Desk</span>
                    <span className="font-mono font-medium text-xs truncate block text-amber-200/90">founder@rudvay.tech</span>
                  </div>
                </a>

                <div className="flex items-start gap-2.5 pt-1 text-[11px] text-[#a39a88]">
                  <MapPin className="h-4 w-4 text-[#d3a52b] shrink-0 mt-0.5" />
                  <span>Sphoorthy Engineering College Campus, Sagar Road, Nadergul, Hyderabad</span>
                </div>
              </div>
            </div>

            {/* Column 4: Technology Partner & Corporate Identity */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-[#d3a52b] uppercase tracking-widest">Corporate & Engineering</h4>
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
                      Rudvay Tech Private Limited
                      <ExternalLink className="h-3 w-3 opacity-70 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                    <p className="text-[10px] font-mono text-emerald-400 font-bold tracking-tight">CIN: U62011TS2026PTC223549</p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/10 text-xs space-y-1.5">
                  <p className="text-[10px] uppercase text-[#a39a88] tracking-widest font-extrabold">Designed & Developed by</p>
                  <p className="font-bold text-white text-sm bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-100 bg-clip-text text-transparent">
                    SAI HARSHA CHERUKU
                  </p>
                  <p className="text-[10px] text-emerald-300/80">Founder, Rudvay Tech Private Limited</p>
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
          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#9a9180]">
            <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
              <p>© {currentYear} Sphoorthy Engineering College & Rudvay Tech Private Limited.</p>
              <span className="text-[#9a9180]/40 hidden sm:inline">•</span>
              <span className="font-mono text-[10px] text-amber-200/80 font-bold">CIN: U62011TS2026PTC223549</span>
            </div>

            {/* Sub-footer Policy Links */}
            <div className="flex items-center gap-3 text-xs flex-wrap justify-center">
              <Link href="/terms" className="text-amber-200/80 hover:text-amber-200 font-semibold hover:underline transition-colors">
                Terms & Conditions
              </Link>
              <span className="text-[#9a9180]/40">•</span>
              <Link href="/privacy" className="text-amber-200/80 hover:text-amber-200 font-semibold hover:underline transition-colors">
                Privacy Policy
              </Link>
              <span className="text-[#9a9180]/40">•</span>
              <Link href="/cookies" className="text-amber-200/80 hover:text-amber-200 font-semibold hover:underline transition-colors">
                Cookie Policy
              </Link>
              <span className="text-[#9a9180]/40">•</span>
              <Link href="/refund-policy" className="text-amber-200/80 hover:text-amber-200 font-semibold hover:underline transition-colors">
                Refund Policy
              </Link>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-center md:text-right flex-wrap justify-center md:justify-end">
              <span>Designed & engineered by</span>
              <span className="font-bold text-white">SAI HARSHA CHERUKU</span>
              <span>·</span>
              <a 
                href="https://rudvay.tech" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-bold text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1 transition-colors"
              >
                Rudvay Tech Private Limited
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
      <VerifyPaymentModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
      />
    </>
  );
}
