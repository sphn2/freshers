import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  Scale,
  Users,
  CreditCard,
  Ban,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Terms and Conditions — Rudvay Tech Private Limited",
  description:
    "Official Terms and Conditions for campus event ticketing and access control platform operated by Rudvay Tech Private Limited (CIN: U62011TS2026PTC223549).",
};

export default function TermsAndConditionsPage() {
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
            <Scale className="h-3.5 w-3.5" /> Legal Agreement & Policies
          </div>
          <h1 className="editorial-title text-3xl sm:text-5xl text-white">Terms & Conditions</h1>
          <p className="text-xs sm:text-sm text-[#e1ded3] max-w-2xl leading-relaxed">
            These terms and conditions govern your access to and use of the campus event ticketing, entry pass generation, and digital verification portal provided by <strong>Rudvay Tech Private Limited</strong> for Sphoorthy Engineering College events.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-mono text-amber-200/90">
            <span>Corporate Entity: Rudvay Tech Private Limited</span>
            <span>•</span>
            <span className="font-bold">CIN: U62011TS2026PTC223549</span>
            <span>•</span>
            <span>Effective Date: October 2026</span>
          </div>
        </div>
      </section>

      {/* Content Panels */}
      <div className="space-y-6 text-slate-800">
        
        {/* Section 1: Corporate Entity & Agreement Scope */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">1. Acceptance of Terms & Legal Entity</h2>
              <p className="text-xs text-slate-500">Contractual relationship with Rudvay Tech Private Limited</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            This digital platform is engineered, maintained, and operated by <strong>Rudvay Tech Private Limited</strong> (bearing Corporate Identification Number <strong>CIN: U62011TS2026PTC223549</strong>), having its registered office in Hyderabad, Telangana, India.
          </p>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            By accessing this portal, booking event tickets, receiving entry passes, or utilizing related services, you ("User", "Student", or "Attendee") explicitly agree to be legally bound by these Terms and Conditions, our{" "}
            <Link href="/privacy" className="font-bold text-amber-800 underline hover:text-amber-950">Privacy Policy</Link>,{" "}
            <Link href="/cookies" className="font-bold text-amber-800 underline hover:text-amber-950">Cookie Policy</Link>, and{" "}
            <Link href="/refund-policy" className="font-bold text-amber-800 underline hover:text-amber-950">Cancellation & Refund Policy</Link>. If you do not agree with any provision of these terms, please refrain from using the platform.
          </p>
        </section>

        {/* Section 2: Student Eligibility & Verification */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">2. Student Eligibility & Verification</h2>
              <p className="text-xs text-slate-500">Criteria for attending campus events</p>
            </div>
          </div>
          <ul className="space-y-3 text-xs sm:text-sm leading-relaxed text-slate-600">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Bona Fide Students Only:</strong> Event registration is exclusively open to verified students of Sphoorthy Engineering College with an active student roll number. Impersonation or registration using another student's credentials is strictly prohibited.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Identity Card Mandate:</strong> All attendees must carry their physical college student ID card along with their digital ticket pass for verification at the campus gates.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Academic Standing & Department Verification:</strong> Ticket pricing tiers (e.g., First Year vs Second Year) are mapped directly to official college roll number prefixes (e.g., 26... vs 25...). Providing false year or branch details will void the ticket without refund.</span>
            </li>
          </ul>
        </section>

        {/* Section 3: Digital Passes & Gate Entry Protocol */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">3. Pass Generation & Gate Regulations</h2>
              <p className="text-xs text-slate-500">Security protocols and venue entry guidelines</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs font-medium text-slate-700">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-600" /> Strict Entry Timing
              </h4>
              <p className="text-slate-600 leading-relaxed">
                All students must arrive at the campus by <strong>9:00 AM sharp</strong>. Campus gates will close promptly at 9:00 AM, and entry will be strictly prohibited thereafter.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Ban className="h-4 w-4 text-rose-600" /> No Re-Entry Policy
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Once an attendee enters the venue, they cannot exit before <strong>4:00 PM</strong>. If any student leaves prior to 4:00 PM, re-entry into the campus is strictly disallowed.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Prohibited Items
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Water bottles, outside food, sharp items, narcotics, alcohol, or unauthorized electronic gear are strictly forbidden. Bags are subject to security inspection.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-600" /> Single-Use Digital Pass
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Each digital pass carries a high-entropy, encrypted QR code and fallback 6-digit numeric code. The code is invalidated in real-time upon the first scan at the gate.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Payments & Ticketing */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-pink-50 text-pink-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">4. Payments, Pricing & Convenience Charges</h2>
              <p className="text-xs text-slate-500">Transaction processing terms</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            All online payments are securely processed through Reserve Bank of India (RBI) authorized payment gateways (including Razorpay, Cashfree, and PhonePe). Ticket fees are clearly displayed prior to checkout and may include statutory GST and payment gateway convenience fees.
          </p>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            For terms regarding failed payments, double debits, and cancellation procedures, please review our comprehensive{" "}
            <Link href="/refund-policy" className="font-bold text-amber-800 underline hover:text-amber-950">
              Cancellation & Refund Policy
            </Link>.
          </p>
        </section>

        {/* Section 5: Code of Conduct & Disciplinary Action */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">5. Campus Discipline & Penalties</h2>
              <p className="text-xs text-slate-500">Compliance with college code of conduct</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            All attendees are expected to maintain the highest standards of decorum and cooperate fully with event coordinators, volunteers, security personnel, and faculty organizers.
          </p>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            Indiscipline, harassment, physical altercations, vandalism, or non-compliance with staff instructions will lead to immediate expulsion from the campus venue, revoking of passes without refund, and severe disciplinary action under college and autonomous board regulations.
          </p>
        </section>

        {/* Section 6: Intellectual Property & Technology Ownership */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">6. Intellectual Property & Platform Ownership</h2>
              <p className="text-xs text-slate-500">Proprietary rights of Rudvay Tech Private Limited</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            The software, user interface, database architecture, offline scanning algorithms, QR validation engines, and brand assets powering the Sphoorthy Campus Events platform are the exclusive intellectual property of <strong>Rudvay Tech Private Limited</strong>. No unauthorized reproduction, reverse engineering, scraping, or commercial exploitation is permitted.
          </p>
        </section>

        {/* Section 7: Corporate Contact Information */}
        <section className="panel p-6 sm:p-8 space-y-4 bg-gradient-to-br from-slate-900 to-[#17221e] text-white">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-amber-300">7. Corporate Contact & Grievance Redressal</h2>
              <p className="text-xs text-slate-400">Rudvay Tech Private Limited · CIN: U62011TS2026PTC223549</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold">
              CIN: U62011TS2026PTC223549
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">
            For questions, legal notices, or issues regarding these Terms & Conditions, please contact our team via the following official channels:
          </p>

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
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">Official Helpline</div>
              <div className="font-mono font-semibold text-amber-200 text-xs">+91 8179645560</div>
            </a>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2 border-t border-white/10">
            <span>Corporate Entity: Rudvay Tech Private Limited (CIN: U62011TS2026PTC223549)</span>
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
