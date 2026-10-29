"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  AlertOctagon, Phone, MessageSquare, ShieldCheck, 
  ExternalLink, Sparkles, Building2, Ticket, CheckCircle2, Copy, Check,
  LockKeyhole, ArrowRight
} from "lucide-react";
import VerifyPaymentModal from "@/components/VerifyPaymentModal";

interface RegistrationsClosedViewProps {
  eventName?: string;
  offlineContactDetails?: string;
  closedNoticeText?: string;
}

export default function RegistrationsClosedView({
  eventName = "UDBHAV '26 — FRESHERS CELEBRATION",
  offlineContactDetails,
  closedNoticeText = "Online registrations are completely closed. No more registrations will be accepted online.",
}: RegistrationsClosedViewProps) {
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [copiedContact, setCopiedContact] = useState(false);

  const fallbackContact = "Contact Organizing Team @ SPHN Main Campus Registration Counter | Phone: 8179645560, 9876543210";
  const displayContact = offlineContactDetails?.trim() || fallbackContact;

  const handleCopyContact = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(displayContact);
      setCopiedContact(true);
      setTimeout(() => setCopiedContact(false), 2000);
    }
  };

  return (
    <>
      <VerifyPaymentModal isOpen={showVerifyModal} onClose={() => setShowVerifyModal(false)} />

      <div className="mx-auto max-w-4xl space-y-8 py-6">
        {/* College Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-amber-300/40 bg-gradient-to-r from-slate-900 via-[#1a1c17] to-slate-900 p-5 text-white shadow-xl">
          <div className="rounded-lg bg-white p-2 shadow-inner">
            <img
              src="/college_logo.png"
              alt="Sphoorthy Engineering College (UGC Autonomous)"
              className="h-10 w-auto object-contain max-w-[280px]"
            />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3.5 py-1.5 text-xs font-bold text-rose-300">
            <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
            Official Event Portal Notice
          </span>
        </div>

        {/* Primary Closed Notice Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500/60 bg-gradient-to-b from-[#1f090d] via-[#140608] to-[#0c0405] p-6 sm:p-10 text-white shadow-2xl space-y-8">
          {/* Ambient Lighting */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-rose-600/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

          {/* Event Name & Closed Badge */}
          <div className="space-y-4 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-md bg-rose-500/20 border border-rose-500/40 px-3.5 py-1.5 text-xs font-black uppercase tracking-widest text-rose-300">
              <AlertOctagon className="h-4 w-4" />
              Online Registrations Status: CLOSED
            </div>

            <h1 className="editorial-title text-3xl sm:text-5xl font-black leading-tight text-white">
              {eventName}
            </h1>

            {/* Main Required Bold Headline */}
            <div className="rounded-xl border-2 border-rose-500/80 bg-rose-950/60 p-5 sm:p-6 shadow-inner space-y-2">
              <p className="text-xl sm:text-2xl font-black uppercase tracking-wide text-rose-100 leading-snug">
                Online registrations are completely closed. No more registrations will be accepted online.
              </p>
              {closedNoticeText && closedNoticeText !== "Online registrations are completely closed. No more registrations will be accepted online." && (
                <p className="text-sm font-medium text-rose-200/90 leading-relaxed pt-1">
                  {closedNoticeText}
                </p>
              )}
            </div>
          </div>

          {/* Offline Registrations & Organizing Team Section */}
          <div className="rounded-xl border border-amber-400/40 bg-gradient-to-r from-[#211909]/90 to-black/80 p-5 sm:p-7 space-y-4 shadow-lg">
            <div className="flex items-center gap-2.5 text-amber-300">
              <Phone className="h-5 w-5 shrink-0" />
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-amber-200">
                For Offline Registrations, Contact The Organizing Team:
              </h2>
            </div>

            <div className="rounded-lg border border-amber-400/30 bg-black/60 p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-extrabold">
                Super Admin Authorized Contact Details:
              </p>
              <p className="text-sm sm:text-base font-bold text-amber-100 leading-relaxed break-words whitespace-pre-wrap">
                {displayContact}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyContact}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 px-3 py-1.5 text-xs font-bold text-amber-200 transition cursor-pointer"
                >
                  {copiedContact ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedContact ? "Copied Contact Info!" : "Copy Details"}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Please visit the campus offline helpdesk counter during working college hours for spot registration assistance and pass collections.
            </p>
          </div>

          {/* Ticket Retrieval / Payment Verification for existing users */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5 text-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">Already Registered or Paid Online?</p>
                <p className="text-slate-300 text-[11px]">Verify your payment status & resend your official ticket pass with QR code to your email.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-amber-400/15 hover:bg-amber-400/25 px-5 py-3 text-xs font-black uppercase tracking-wider text-amber-300 transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
            >
              <Ticket className="h-4 w-4" />
              <span>Verify & Resend Pass</span>
            </button>
          </div>
        </div>

        {/* Official Rudvay Tech Promotion Card */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-[#071d16] via-[#092b20] to-[#04120e] p-6 sm:p-8 text-white shadow-2xl space-y-6">
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-2xl" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-md bg-emerald-400/20 border border-emerald-400/40 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Technology Partner Showcase
              </div>

              {/* Exact user requested promotional wording */}
              <h2 className="editorial-title text-2xl sm:text-3xl font-extrabold text-white leading-snug">
                Do you want this type of portal for your events or any personalized websites, projects, custom softwares, mobile app development?
              </h2>

              <p className="text-sm sm:text-base font-bold text-emerald-200">
                Contact Rudvay Tech on WhatsApp at <span className="font-mono text-white underline decoration-emerald-400">8179645560</span>
              </p>
            </div>

            {/* Direct WhatsApp Call to Action Button */}
            <div className="shrink-0 flex flex-col sm:flex-row md:flex-col items-stretch gap-2.5">
              <a
                href="https://wa.me/918179645560?text=Hello%20Rudvay%20Tech%2C%20I%20am%20interested%20in%20a%20portal%20for%20our%20events%20%2F%20personalized%20websites%20%2F%20custom%20software%20%2F%20mobile%20apps."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 px-6 py-4 text-sm font-black uppercase tracking-wider text-black shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <MessageSquare className="h-5 w-5 fill-black" />
                <span>Chat on WhatsApp</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              <a
                href="tel:+918179645560"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/40 hover:bg-emerald-900/60 px-5 py-2.5 text-xs font-bold text-emerald-200 transition"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Call +91 8179645560</span>
              </a>
            </div>
          </div>
        </section>

        {/* Staff & Coordinator Quick Sign In Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0c1210] p-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Event Coordinator, Gate Staff, Food Counter or Cash Desk Staff?</span>
          </div>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
          >
            <LockKeyhole className="h-3.5 w-3.5 text-amber-300" />
            <span>Staff Portal Sign In</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}
