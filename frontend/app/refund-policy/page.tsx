import type { Metadata } from "next";
import Link from "next/link";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  CreditCard,
  Clock,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — Rudvay Tech Private Limited",
  description:
    "Official Cancellation and Refund Policy for campus event ticketing managed by Rudvay Tech Private Limited (CIN: U62011TS2026PTC223549).",
};

export default function RefundPolicyPage() {
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
            <RefreshCw className="h-3.5 w-3.5" /> Financial Operations & Safeguards
          </div>
          <h1 className="editorial-title text-3xl sm:text-5xl text-white">Cancellation & Refund Policy</h1>
          <p className="text-xs sm:text-sm text-[#e1ded3] max-w-2xl leading-relaxed">
            Transparent refund timelines, payment failure reconciliation, and cancellation guidelines operated by <strong>Rudvay Tech Private Limited</strong> for Sphoorthy Engineering College events.
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
        
        {/* Section 1: Overview */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">1. Nature of Campus Event Passes</h2>
              <p className="text-xs text-slate-500">Fixed-date admission and venue capacity constraints</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            Campus celebration events (such as Udbhav Freshers Party and Cultural Fests) operate under strictly capped venue capacities, catering preparations, and security clearances. 
          </p>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            Because a ticket reservation immediately reserves a seat and allocates catering resources for the designated attendee, <strong>confirmed event entry passes are strictly non-refundable and non-transferable</strong> once issued, except as expressly provided below.
          </p>
        </section>

        {/* Section 2: Scenarios for Refunds */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">2. Refund Scenarios & Conditions</h2>
              <p className="text-xs text-slate-500">When refunds are approved and issued</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs font-medium text-slate-700">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <h3 className="font-extrabold text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Event Cancellation by College
              </h3>
              <p className="text-emerald-900 leading-relaxed font-normal">
                If an event is completely cancelled by Sphoorthy Engineering College or Rudvay Tech Private Limited without any rescheduled date, all registered attendees will receive a <strong>100% refund of the ticket face value</strong> automatically to their original payment source.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
              <h3 className="font-extrabold text-blue-950 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" /> Event Rescheduled or Postponed
              </h3>
              <p className="text-blue-900 leading-relaxed font-normal">
                If an event is postponed to a new date, your issued ticket remains automatically valid for the rescheduled date. Attendees who cannot attend the new date may request a refund within <strong>48 hours</strong> of the postponement announcement.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Failed Transactions & Payment Debited Without Ticket */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-pink-50 text-pink-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">3. Failed Transactions & Double Charges</h2>
              <p className="text-xs text-slate-500">Automated payment gateway reconciliation</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            During peak registration periods, intermittent bank server or UPI network timeouts can occasionally cause your account to be debited while the portal payment session times out before issuing the ticket. Here is how our automated safeguards protect you:
          </p>

          <div className="space-y-3 pt-1 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-amber-300">
                1
              </span>
              <div>
                <p className="font-bold text-slate-900">Automatic Gateway Reconciliation</p>
                <p className="text-slate-600 leading-relaxed mt-0.5">
                  Our payment gateway partners (Razorpay / Cashfree / PhonePe) run automated reconciliation batches. If a payment is confirmed by your bank after the session expires, our backend automatically generates your ticket and dispatches it to your verified email.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-amber-300">
                2
              </span>
              <div>
                <p className="font-bold text-slate-900">Automated Reversal to Source</p>
                <p className="text-slate-600 leading-relaxed mt-0.5">
                  If the payment is dropped or cannot be mapped to a valid registration, the payment gateway automatically initiates an auto-refund to your bank/UPI account within <strong>3 to 7 working days</strong>.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-amber-300">
                3
              </span>
              <div>
                <p className="font-bold text-slate-900">Duplicate Transactions</p>
                <p className="text-slate-600 leading-relaxed mt-0.5">
                  If you accidentally paid twice for the same roll number registration, the duplicate payment will be refunded in full after administrative verification.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Refund Processing & Timeline */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">4. Refund Processing Timelines</h2>
              <p className="text-xs text-slate-500">Method and settlement period</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            Once approved, all refunds are initiated immediately via the banking network. Settlement periods depend on the payment method used:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 font-extrabold text-slate-800">
                <tr>
                  <th className="p-3 border-b border-slate-200">Payment Channel</th>
                  <th className="p-3 border-b border-slate-200">Estimated Reversal Time</th>
                  <th className="p-3 border-b border-slate-200">Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td className="p-3 font-semibold">UPI (GPay / PhonePe / Paytm / BHIM)</td>
                  <td className="p-3 font-mono font-bold text-emerald-700">2 – 5 Business Days</td>
                  <td className="p-3">Original Linked Bank Account</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Debit / Credit Cards</td>
                  <td className="p-3 font-mono font-bold text-emerald-700">5 – 7 Business Days</td>
                  <td className="p-3">Issuing Bank Card Account</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Net Banking</td>
                  <td className="p-3 font-mono font-bold text-emerald-700">3 – 7 Business Days</td>
                  <td className="p-3">Originating Bank Account</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Offline Cash Desk Collections</td>
                  <td className="p-3 font-mono font-bold text-amber-700">Subject to Campus Desk</td>
                  <td className="p-3">Cash Desk Coordinator verification</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Escalation & How to Claim */}
        <section className="panel p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">5. How to Raise a Refund Query</h2>
              <p className="text-xs text-slate-500">Submitting your details for prompt investigation</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
            If your transaction was debited but you have not received your ticket pass or refund within <strong>7 business days</strong>, please send an email to our support desk with the following details:
          </p>

          <ul className="grid sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Full Student Name & College Roll Number</span>
            </li>
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Registered College Email Address & Mobile Number</span>
            </li>
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Payment Gateway Order ID / Transaction Reference</span>
            </li>
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Bank UPI Reference Number (UTR) or Screenshot</span>
            </li>
          </ul>
        </section>

        {/* Section 6: Corporate Support Desk */}
        <section className="panel p-6 sm:p-8 space-y-4 bg-gradient-to-br from-slate-900 to-[#17221e] text-white">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-amber-300">6. Support & Contact Desk</h2>
              <p className="text-xs text-slate-400">Rudvay Tech Private Limited · Dedicated Support</p>
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
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">General Support</div>
              <div className="font-mono font-semibold text-amber-200 text-xs truncate">contact@rudvay.tech</div>
            </a>

            <a
              href="mailto:founder@rudvay.tech"
              className="p-3.5 rounded-xl bg-white/10 border border-white/10 hover:border-amber-300/50 hover:bg-white/15 transition-all text-xs space-y-1 block"
            >
              <Mail className="h-4 w-4 text-amber-300" />
              <div className="text-[10px] uppercase text-slate-400 font-extrabold">Founder Desk / Escalations</div>
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
