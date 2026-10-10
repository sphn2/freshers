import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Lock, Eye, FileText, CheckCircle2, ArrowLeft, Mail, Phone, MapPin, Globe, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Sphoorthy Events",
  description: "Official Privacy Policy for Sphoorthy Engineering College Campus Event Platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4 px-4 sm:px-6">
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.13em] text-slate-600 hover:text-pink-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Campus Calendar
      </Link>

      {/* Hero Header */}
      <section className="page-hero surface-grid p-6 sm:p-10 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[#e5c86f] text-xs font-bold uppercase tracking-widest">
            <Shield className="h-3.5 w-3.5" /> Official Policy Document
          </div>
          <h1 className="editorial-title text-3xl sm:text-5xl text-white">Privacy Policy</h1>
          <p className="text-xs sm:text-sm text-[#e1ded3] max-w-2xl leading-relaxed">
            Sphoorthy Engineering College & Rudvay Tech Pvt Ltd are committed to protecting your personal information and privacy rights during campus event registrations.
          </p>
          <p className="text-[11px] font-mono text-amber-200/80 pt-2">Last updated: October 11, 2026</p>
        </div>
      </section>

      {/* Content Panels */}
      <div className="space-y-6 text-slate-800">
        
        {/* Section 1: Overview */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-pink-50 text-pink-700">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">1. Information We Collect</h2>
              <p className="text-xs text-slate-500">Details provided during event registration & booking</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            When you register for a campus event (such as Udbhav Freshers Party or Cultural Fest), we collect personal information necessary to generate your official digital ticket, process admission payments, and verify entry at campus gates:
          </p>
          <ul className="grid sm:grid-cols-2 gap-3 text-xs font-medium text-slate-700 pt-1">
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Student Identity:</strong> Full Name, College Roll Number, and Department.</span>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Contact Information:</strong> College Email Address and 10-digit Mobile Number.</span>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Transaction Details:</strong> Payment method, Razorpay payment tokens, order IDs, and offline cash receipt logs.</span>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Access Verification:</strong> QR code validation timestamps for gate entry and food pass redemption.</span>
            </li>
          </ul>
        </section>

        {/* Section 2: How Data is Used */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">2. How We Use Your Information</h2>
              <p className="text-xs text-slate-500">Purposes of data processing</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            We use the collected information exclusively for event administration and campus security:
          </p>
          <ul className="space-y-2.5 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-600 mt-2 shrink-0"></span>
              <span><strong>Ticket Pass Generation:</strong> To generate personalized QR digital passes sent directly to your verified college email address.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-600 mt-2 shrink-0"></span>
              <span><strong>Campus Gate Security:</strong> To allow authorized gate staff to scan ticket QR codes and verify attendee student identity on event day.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-600 mt-2 shrink-0"></span>
              <span><strong>Food Voucher Distribution:</strong> To ensure eligible participants claim single-use food vouchers efficiently without duplication.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-600 mt-2 shrink-0"></span>
              <span><strong>Payment Verification & Support:</strong> To reconcile payment confirmations with Razorpay / cash desk collectors and handle ticket re-send requests.</span>
            </li>
          </ul>
        </section>

        {/* Section 3: Data Security & Storage */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">3. Data Security & Retention</h2>
              <p className="text-xs text-slate-500">How your information is protected</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            We implement stringent technological measures to safeguard your personal data against unauthorized access, disclosure, or alteration:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
              <h3 className="font-extrabold text-amber-900">Encrypted Storage & HTTPS</h3>
              <p className="text-amber-800 leading-relaxed">
                All data in transit is encrypted using SSL/TLS protocols. Access tokens and sensitive operations are secured with cryptographic signatures.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-1">
              <h3 className="font-extrabold text-emerald-900">Strict Role Access Controls</h3>
              <p className="text-emerald-800 leading-relaxed">
                Staff accounts operate under strict role isolation. Gate staff cannot edit registration data; only designated administrators have reporting access.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Third-Party Services & No Selling Policy */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">4. Third-Party Sharing & Policy</h2>
              <p className="text-xs text-slate-500">No selling or external commercial sharing</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            <strong>We do not sell, rent, or trade your personal information to third parties.</strong> Data is shared only with trusted infrastructure providers required to deliver the event registration services:
          </p>
          <ul className="space-y-2 text-xs text-slate-700">
            <li>• <strong>Razorpay:</strong> Payment gateway provider for online transactions. Payment details are processed in accordance with Razorpay's PCI-DSS compliant security standards.</li>
            <li>• <strong>Transactional Email Providers:</strong> Used solely to dispatch booking confirmations and digital ticket passes.</li>
            <li>• <strong>College Administration:</strong> Event attendance records may be audited by Sphoorthy Engineering College administration for security and academic verification.</li>
          </ul>
        </section>

        {/* Section 5: Contact Information */}
        <section className="panel p-6 sm:p-8 space-y-4 bg-gradient-to-br from-slate-900 to-[#17221e] text-white">
          <h2 className="text-lg font-extrabold text-amber-300">5. Contact & Data Support</h2>
          <p className="text-xs leading-relaxed text-slate-300">
            If you have questions regarding this Privacy Policy, need to update your registered email address, or require support regarding your event ticket pass, please reach out to us:
          </p>

          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            <a
              href="mailto:founder@rudvay.tech"
              className="p-3.5 rounded-xl bg-white/10 border border-white/10 hover:border-amber-300/50 hover:bg-white/15 transition-all text-xs space-y-1 block"
            >
              <Mail className="h-4 w-4 text-amber-300" />
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">Email Support</div>
              <div className="font-mono font-semibold text-amber-200 text-xs truncate">founder@rudvay.tech</div>
            </a>

            <a
              href="tel:8179645560"
              className="p-3.5 rounded-xl bg-white/10 border border-white/10 hover:border-amber-300/50 hover:bg-white/15 transition-all text-xs space-y-1 block"
            >
              <Phone className="h-4 w-4 text-amber-300" />
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">Phone Helpline</div>
              <div className="font-mono font-semibold text-amber-200 text-xs">+91 8179645560</div>
            </a>

            <a
              href="https://rudvay.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-white/10 border border-white/10 hover:border-amber-300/50 hover:bg-white/15 transition-all text-xs space-y-1 block"
            >
              <Globe className="h-4 w-4 text-amber-300" />
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">Technology Partner</div>
              <div className="font-semibold text-amber-200 text-xs flex items-center gap-1">
                Rudvay Tech Pvt Ltd <ExternalLink className="h-3 w-3" />
              </div>
            </a>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span>Sphoorthy Engineering College Campus, Nadergul, Hyderabad, Telangana, India</span>
          </div>
        </section>
      </div>
    </div>
  );
}
