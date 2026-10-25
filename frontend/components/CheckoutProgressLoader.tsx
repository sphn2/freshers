"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, Lock, Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";

export type LoaderVariant =
  | "registration"
  | "preparing"
  | "launching"
  | "verifying_payment"
  | "checking_status";

interface Step {
  id: number;
  title: string;
  detail: string;
}

const VARIANT_CONFIGS: Record<
  LoaderVariant,
  {
    badgeText: string;
    badgeIcon: "sparkles" | "check" | "refresh" | "shield";
    rightText: string;
    defaultTitle: string;
    defaultSubtitle: string;
    initialStep: number;
    initialProgress: number;
    steps: Step[];
    schedule: { delay: number; step: number; progress: number }[];
    theme: "amber" | "emerald";
  }
> = {
  registration: {
    badgeText: "Sphoorthy Fresher's Desk",
    badgeIcon: "sparkles",
    rightText: "Bank-Grade SSL",
    defaultTitle: "Securing Your Booking...",
    defaultSubtitle: "Please wait while we initialize your registration and payment window.",
    initialStep: 0,
    initialProgress: 20,
    theme: "amber",
    steps: [
      {
        id: 1,
        title: "Verifying Student Directory...",
        detail: "Matching roll number with official college records",
      },
      {
        id: 2,
        title: "Reserving Event Entry Pass...",
        detail: "Allocating fresher's party seat & generating ticket code",
      },
      {
        id: 3,
        title: "Creating Secure Banking Order...",
        detail: "Encrypting booking session with 256-bit SSL connection",
      },
      {
        id: 4,
        title: "Redirecting to Checkout Desk...",
        detail: "Preparing payment options and order summary",
      },
    ],
    schedule: [
      { delay: 2000, step: 1, progress: 48 },
      { delay: 4200, step: 2, progress: 74 },
      { delay: 6500, step: 3, progress: 94 },
    ],
  },
  preparing: {
    badgeText: "Sphoorthy Checkout",
    badgeIcon: "shield",
    rightText: "256-Bit SSL",
    defaultTitle: "Preparing Your Booking & Order...",
    defaultSubtitle: "Setting up secure payment gateway and ticket summary.",
    initialStep: 0,
    initialProgress: 30,
    theme: "amber",
    steps: [
      {
        id: 1,
        title: "Retrieving Registration Details...",
        detail: "Matching student credentials with event directory",
      },
      {
        id: 2,
        title: "Calculating Ticket & Pricing...",
        detail: "Applying authorized category ticket price",
      },
      {
        id: 3,
        title: "Loading Checkout Portal...",
        detail: "Securing 256-bit encrypted payment session",
      },
    ],
    schedule: [
      { delay: 1000, step: 1, progress: 65 },
      { delay: 2200, step: 2, progress: 92 },
    ],
  },
  launching: {
    badgeText: "Payment Gateway",
    badgeIcon: "shield",
    rightText: "Bank-Grade SSL",
    defaultTitle: "Opening Payment Gateway...",
    defaultSubtitle: "Preparing Razorpay checkout modal for UPI, Google Pay & Cards.",
    initialStep: 0,
    initialProgress: 35,
    theme: "amber",
    steps: [
      {
        id: 1,
        title: "Securing Order Parameters...",
        detail: "Validating registration credentials with banking backend",
      },
      {
        id: 2,
        title: "Initializing Gateway Handshake...",
        detail: "Establishing encrypted 256-bit gateway tunnel",
      },
      {
        id: 3,
        title: "Opening Payment Window...",
        detail: "Preparing UPI, Google Pay, PhonePe & Card checkout",
      },
    ],
    schedule: [
      { delay: 900, step: 1, progress: 68 },
      { delay: 1800, step: 2, progress: 95 },
    ],
  },
  verifying_payment: {
    badgeText: "Payment Confirmed",
    badgeIcon: "check",
    rightText: "Official Digital Pass",
    defaultTitle: "Payment Received Successfully!",
    defaultSubtitle: "Issuing your official fresher's party entry pass & digital ticket...",
    initialStep: 2, // Steps 0 & 1 are already confirmed completed!
    initialProgress: 85,
    theme: "emerald",
    steps: [
      {
        id: 1,
        title: "Payment Received & Captured",
        detail: "Authoritative gateway confirmation verified with bank",
      },
      {
        id: 2,
        title: "Reserving Fresher's Pass",
        detail: "Official seat confirmed in student event directory",
      },
      {
        id: 3,
        title: "Generating Digital QR Pass...",
        detail: "Signing 256-bit tamper-proof entry credentials",
      },
      {
        id: 4,
        title: "Issuing Official Ticket...",
        detail: "Redirecting to your digital entry pass & party ticket",
      },
    ],
    schedule: [
      { delay: 700, step: 2, progress: 92 },
      { delay: 1500, step: 3, progress: 98 },
    ],
  },
  checking_status: {
    badgeText: "Bank Verification",
    badgeIcon: "refresh",
    rightText: "Gateway Sync",
    defaultTitle: "Verifying Payment with Bank...",
    defaultSubtitle: "Checking real-time transaction confirmation with payment gateway...",
    initialStep: 0,
    initialProgress: 35,
    theme: "amber",
    steps: [
      {
        id: 1,
        title: "Connecting to Banking Server...",
        detail: "Contacting payment gateway for live transaction state",
      },
      {
        id: 2,
        title: "Matching Order & Payment ID...",
        detail: "Cross-referencing capture records with banking system",
      },
      {
        id: 3,
        title: "Synchronizing Ticket Record...",
        detail: "Retrieving official entry pass and QR token",
      },
    ],
    schedule: [
      { delay: 1300, step: 1, progress: 70 },
      { delay: 2600, step: 2, progress: 94 },
    ],
  },
};

interface CheckoutProgressLoaderProps {
  isOverlay?: boolean;
  variant?: LoaderVariant;
  message?: string;
  submessage?: string;
}

export default function CheckoutProgressLoader({
  isOverlay = false,
  variant = "registration",
  message,
  submessage,
}: CheckoutProgressLoaderProps) {
  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.registration;
  const [currentStepIndex, setCurrentStepIndex] = useState(config.initialStep);
  const [progressPercent, setProgressPercent] = useState(config.initialProgress);

  useEffect(() => {
    setCurrentStepIndex(config.initialStep);
    setProgressPercent(config.initialProgress);

    const timers = config.schedule.map((item) =>
      setTimeout(() => {
        setCurrentStepIndex(item.step);
        setProgressPercent(item.progress);
      }, item.delay),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [variant, config]);

  const isEmerald = config.theme === "emerald";

  const containerClasses = isOverlay
    ? "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    : "min-h-[65vh] flex items-center justify-center p-4";

  return (
    <div className={containerClasses}>
      <div
        className={`relative w-full max-w-md overflow-hidden rounded-3xl p-6 text-white shadow-2xl md:p-8 transition-colors duration-500 ${
          isEmerald
            ? "border border-emerald-400/50 bg-gradient-to-b from-[#0e2a1e] via-[#0b1f16] to-[#07130e] shadow-emerald-950/80"
            : "border border-amber-300/40 bg-gradient-to-b from-[#14231d] via-[#101b17] to-[#0c1411] shadow-emerald-950/60"
        }`}
      >
        {/* Ambient Top Glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full blur-3xl ${
            isEmerald ? "bg-emerald-400/25" : "bg-amber-400/15"
          }`}
        />

        {/* Header Eyebrow */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border ${
              isEmerald
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                : "bg-amber-400/10 text-amber-300 border-amber-400/20"
            }`}
          >
            {config.badgeIcon === "check" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : config.badgeIcon === "refresh" ? (
              <RefreshCw className="h-3 w-3 animate-spin text-amber-300" />
            ) : config.badgeIcon === "shield" ? (
              <ShieldCheck className="h-3 w-3 text-amber-300" />
            ) : (
              <Sparkles className="h-3 w-3 text-amber-300" />
            )}
            <span>{config.badgeText}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>{config.rightText}</span>
          </div>
        </div>

        {/* Main Status Headline */}
        <div className="relative z-10 my-5 text-center">
          {isEmerald ? (
            <div className="relative inline-flex items-center justify-center mb-3">
              <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-emerald-400/25" />
              <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-400/40 shadow-lg shadow-emerald-950/60">
                <CheckCircle2 className="h-8 w-8 text-emerald-300 animate-in zoom-in-75 duration-300" />
              </div>
            </div>
          ) : (
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 border border-amber-400/30 mb-3 shadow-inner">
              <Loader2 className="h-7 w-7 animate-spin text-[#e5c86f]" />
            </div>
          )}

          <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
            {message || config.defaultTitle}
          </h2>
          <p className="mt-1 text-xs text-amber-100/75 max-w-sm mx-auto">
            {submessage || config.defaultSubtitle}
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative z-10 mb-6 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-amber-200/90">
            <span>Overall Progress</span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 p-[1px]">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${
                isEmerald
                  ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
                  : "bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-300"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Milestone Steps List */}
        <div className="relative z-10 space-y-3 rounded-2xl border border-white/5 bg-black/30 p-4 backdrop-blur-sm">
          {config.steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 transition-all duration-300 ${
                  isCurrent
                    ? "opacity-100 scale-[1.01]"
                    : isCompleted
                    ? "opacity-95"
                    : "opacity-40"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-emerald-950/50" />
                  ) : isCurrent ? (
                    <div className="relative flex h-4 w-4 items-center justify-center">
                      <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                          isEmerald ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                      <span
                        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                          isEmerald ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                    </div>
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-white/30" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold leading-tight ${
                        isCurrent
                          ? isEmerald
                            ? "text-emerald-200"
                            : "text-amber-200"
                          : isCompleted
                          ? "text-emerald-300"
                          : "text-slate-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    {isCurrent && (
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                          isEmerald
                            ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/30"
                            : "bg-amber-400/20 text-amber-300 border-amber-400/30"
                        }`}
                      >
                        IN PROGRESS
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-300/80">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Anti-Bounce & Security Footer Note */}
        <div className="relative z-10 mt-5 space-y-2 border-t border-white/10 pt-4 text-center">
          <div
            className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold ${
              isEmerald ? "text-emerald-300/95" : "text-amber-300/90"
            }`}
          >
            <AlertCircle
              className={`h-3.5 w-3.5 shrink-0 ${
                isEmerald ? "text-emerald-400" : "text-amber-400"
              }`}
            />
            <span>
              {isEmerald
                ? "Please do not refresh. Loading your entry ticket pass..."
                : "Do not refresh or click the back button"}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <Lock className="h-3 w-3 text-slate-400" />
            <span>256-Bit SSL Encrypted Booking Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
