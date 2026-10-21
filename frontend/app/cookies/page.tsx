import type { Metadata } from "next";
import Link from "next/link";
import {
  Cookie,
  ShieldCheck,
  Lock,
  Database,
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Cookie Policy — Rudvay Tech Private Limited",
  description:
    "Official Cookie Policy explaining how cookies and local storage are utilized on the campus events platform operated by Rudvay Tech Private Limited (CIN: U62011TS2026PTC223549).",
};

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4 px-4 sm:px-6">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.13em] text-slate-600 hover:text-amber-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Campus Calendar
      </Link>

      {/* Hero Header */}
      <section className="page-hero surface-grid p-6 sm:p-10 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[#e5c86f] text-xs font-bold uppercase tracking-widest">
            <Cookie className="h-3.5 w-3.5" /> Transparency & Privacy
          </div>
          <h1 className="editorial-title text-3xl sm:text-5xl text-white">Cookie Policy</h1>
          <p className="text-xs sm:text-sm text-[#e1ded3] max-w-2xl leading-relaxed">
            Learn how <strong>Rudvay Tech Private Limited</strong> uses cookies, sessionStorage, and localStorage technologies to safeguard your event reservations and deliver secure gate check-ins.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-mono text-amber-200/90">
            <span>Corporate Entity: Rudvay Tech Private Limited</span>
            <span>•</span>
            <span className="font-bold">CIN: U62011TS2026PTC223549</span>
            <span>•</span>
            <span>Updated: October 2026</span>
          </div>
        </div>
      </section>

      {/* Content Panels */}
      <div className="space-y-6 text-slate-800">
        
        {/* Section 1: What Are Cookies */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Cookie className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">1. What Are Cookies & Web Storage?</h2>
              <p className="text-xs text-slate-500">Understanding data storage in modern web applications</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            Cookies and web storage technologies (such as <code>localStorage</code> and <code>sessionStorage</code>) are small text files and secure key-value stores placed directly in your web browser. They allow our platform to remember your active booking session, keep event check-in staff securely signed in, and preserve offline ticketing capabilities when network coverage is weak.
          </p>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            Rudvay Tech Private Limited prioritizes user privacy. <strong>We do NOT employ third-party tracking cookies or marketing profiling cookies.</strong>
          </p>
        </section>

        {/* Section 2: Cookies & Storage We Use */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">2. Storage Technologies Deployed</h2>
              <p className="text-xs text-slate-500">Categories of functional storage on our platform</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Strictly Necessary / Authentication Tokens
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  Essential
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Stores cryptographic session tokens and verification state for authorized college staff (Gate Desk, Food Counter, Cash Desk, and Administrators). These tokens authenticate API calls and prevent unauthorized role escalation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Temporary Registration Session Storage
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  Essential
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Retains ephemeral registration references (such as <code>reg_token_*</code> and <code>ticket_token_*</code>) during payment gateway roundtrips so that your generated ticket pass is securely linked to your browser immediately after payment confirmation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" /> Offline Gate Scanner Cache (IndexedDB / LocalStorage)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                  Operational
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Used exclusively on staff gate-scanner devices to queue validated entries when Wi-Fi or mobile network signals on campus grounds fluctuate, guaranteeing zero queues at entry gates.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: What We Never Do */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">3. Non-Tracking Commitment</h2>
              <p className="text-xs text-slate-500">Zero advertisement or behavioral tracking</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
              <h4 className="font-bold text-rose-950 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-rose-600" /> No Advertising Networks
              </h4>
              <p className="text-rose-800 leading-relaxed">
                We do not integrate Google AdSense, Facebook Pixel, TikTok trackers, or any third-party behavioral advertising scripts.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
              <h4 className="font-bold text-rose-950 flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-rose-600" /> No Cross-Site Profiling
              </h4>
              <p className="text-rose-800 leading-relaxed">
                Your college browsing activity, roll number, and ticketing records are never shared with or sold to data brokers.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Managing Cookies */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">4. How to Manage Cookies</h2>
              <p className="text-xs text-slate-500">Browser controls and settings</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            Most modern web browsers allow you to manage or clear cookies and local storage through their Settings or Preferences menu. However, because our storage items are strictly necessary for session continuity and gate security, blocking them may prevent you from viewing your active digital ticket pass or completing ticket checkout.
          </p>
        </section>

        {/* Section 5: Corporate Contact Information */}
        <section className="panel p-6 sm:p-8 space-y-4 bg-gradient-to-br from-slate-900 to-[#17221e] text-white">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-amber-300">5. Contact Rudvay Tech Private Limited</h2>
              <p className="text-xs text-slate-400">Questions about cookies and data privacy</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold">
              CIN: U62011TS2026PTC223549
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            <a
              href="mailto:contact@rudvay.tech"
              className="p-3.5 rounded-xl bg-white/10 border border-white/10 hover:border-amber-300/50 hover:bg-white/15 transition-all text-xs space-y-1 block"
            >
              <Mail className="h-4 w-4 text-amber-300" />
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">General Enquiries</div>
              <div className="font-mono font-semibold text-amber-200 text-xs truncate">contact@rudvay.tech</div>
            </a>

            <a
              href="mailto:founder@rudvay.tech"
              className="p-3.5 rounded-xl bg-white/10 border border-white/10 hover:border-amber-300/50 hover:bg-white/15 transition-all text-xs space-y-1 block"
            >
              <Mail className="h-4 w-4 text-amber-300" />
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">Founder Desk</div>
              <div className="font-mono font-semibold text-amber-200 text-xs truncate">founder@rudvay.tech</div>
            </a>

            <a
              href="tel:+918179645560"
              className="p-3.5 rounded-xl bg-white/10 border border-white/10 hover:border-amber-300/50 hover:bg-white/15 transition-all text-xs space-y-1 block"
            >
              <Phone className="h-4 w-4 text-amber-300" />
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">Helpline</div>
              <div className="font-mono font-semibold text-amber-200 text-xs">+91 8179645560</div>
            </a>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2 border-t border-white/10">
            <span>Rudvay Tech Private Limited (CIN: U62011TS2026PTC223549)</span>
            <a
              href="https://rudvay.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 hover:underline inline-flex items-center gap-1 font-semibold"
            >
              https://rudvay.tech <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
