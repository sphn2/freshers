"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, Lock, Sparkles, Loader2, AlertCircle } from "lucide-react";

interface Step {
  id: number;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
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
    title: "Opening Razorpay Gateway...",
    detail: "Preparing UPI, Google Pay & Card checkout modal",
  },
];

interface CheckoutProgressLoaderProps {
  isOverlay?: boolean;
  message?: string;
}

export default function CheckoutProgressLoader({
  isOverlay = false,
  message,
}: CheckoutProgressLoaderProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(20);

  useEffect(() => {
    // Transition steps at intervals matching real network/API progression
    const timers = [
      setTimeout(() => {
        setCurrentStepIndex(1);
        setProgressPercent(45);
      }, 2400),
      setTimeout(() => {
        setCurrentStepIndex(2);
        setProgressPercent(72);
      }, 5200),
      setTimeout(() => {
        setCurrentStepIndex(3);
        setProgressPercent(94);
      }, 8200),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const containerClasses = isOverlay
    ? "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
    : "min-h-[65vh] flex items-center justify-center p-4";

  return (
    <div className={containerClasses}>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-b from-[#14231d] via-[#101b17] to-[#0c1411] p-6 text-white shadow-2xl shadow-emerald-950/60 md:p-8">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />

        {/* Header Eyebrow */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/20">
            <Sparkles className="h-3 w-3 text-amber-300" />
            <span>Sphoorthy Fresher's Desk</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Bank-Grade SSL</span>
          </div>
        </div>

        {/* Main Status Headline */}
        <div className="relative z-10 my-5 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 border border-amber-400/30 mb-3 shadow-inner">
            <Loader2 className="h-7 w-7 animate-spin text-[#e5c86f]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
            {message || "Securing Your Booking..."}
          </h2>
          <p className="mt-1 text-xs text-amber-100/70">
            Please wait while we initialize your registration and payment window.
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
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-300 transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Milestone Steps List */}
        <div className="relative z-10 space-y-3 rounded-2xl border border-white/5 bg-black/30 p-4 backdrop-blur-sm">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 transition-all duration-300 ${
                  isCurrent
                    ? "opacity-100 scale-[1.01]"
                    : isCompleted
                    ? "opacity-90"
                    : "opacity-40"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-emerald-950/50" />
                  ) : isCurrent ? (
                    <div className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
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
                          ? "text-amber-200"
                          : isCompleted
                          ? "text-emerald-300"
                          : "text-slate-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    {isCurrent && (
                      <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-400/30">
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
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-300/90">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Do not refresh or click the back button</span>
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
