"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Clock, Sparkles, Ticket, X, Zap } from "lucide-react";
import type { BannerSettings } from "@/lib/types";

interface RegistrationPopupModalProps {
  banners: BannerSettings;
  onBookClick?: () => void;
}

export default function RegistrationPopupModal({ banners, onBookClick }: RegistrationPopupModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  // Format closing deadline into bold and clear human-readable string
  const formatClosingDeadline = (rawDeadline: string) => {
    if (!rawDeadline) return "Soon (Limited Passes Remaining)";
    try {
      const date = new Date(rawDeadline);
      if (isNaN(date.getTime())) return rawDeadline; // If already a custom text string
      return date.toLocaleString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " IST";
    } catch {
      return rawDeadline;
    }
  };

  useEffect(() => {
    // Only display if popup_enabled is true and registrations are NOT already closed
    if (!banners.popup_enabled || banners.registrations_closed) {
      setIsOpen(false);
      return;
    }

    // Check if user dismissed it in this browser session
    const dismissed = sessionStorage.getItem("sphn_reg_popup_dismissed");
    if (!dismissed) {
      // Small timeout for smooth entry animation after page load
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [banners.popup_enabled, banners.registrations_closed]);

  // Live Countdown calculation if closing_time is a valid date
  useEffect(() => {
    if (!banners.popup_closing_time) {
      setTimeLeft(null);
      return;
    }

    const targetDate = new Date(banners.popup_closing_time).getTime();
    if (isNaN(targetDate)) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [banners.popup_closing_time]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("sphn_reg_popup_dismissed", "true");
  };

  const handleAction = () => {
    handleClose();
    if (onBookClick) {
      onBookClick();
    } else {
      const target = document.getElementById("events");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  if (!banners.popup_enabled || banners.registrations_closed) {
    return null;
  }

  return (
    <>
      {/* Floating reopen badge if user previously dismissed */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 px-4 py-2 text-xs font-black text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
        >
          <Zap className="h-4 w-4 text-amber-200 fill-amber-200" />
          <span>⚡ Registrations Closing Soon Notice</span>
        </button>
      )}

      {/* Main Popup Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300"
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-[#1c180e] via-[#120f09] to-[#0c0a07] text-white shadow-[0_0_50px_rgba(245,158,11,0.25)] p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Ambient Background Glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-rose-500/15 blur-3xl" />

            {/* Top Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close urgency notice"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header Badge */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-300 shadow-sm animate-pulse">
                <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
                Urgent Registration Notice
              </span>
            </div>

            {/* Bold Headline */}
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-tight">
                {banners.popup_title || "⚡ HURRY UP! REGISTRATIONS CLOSING SOON!"}
              </h2>
              <p className="text-sm sm:text-base text-amber-100/90 leading-relaxed font-medium">
                {banners.popup_message || "Online registrations will officially close on the specified date & time. Grab your ticket pass now before slots are full!"}
              </p>
            </div>

            {/* Prominent Closing Deadline Box */}
            <div className="rounded-xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-950/70 via-black/80 to-amber-950/70 p-4 sm:p-5 shadow-inner space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-extrabold uppercase text-[11px] tracking-widest">
                <Clock className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                <span>Registrations Will Close On:</span>
              </div>
              
              <div className="font-serif text-xl sm:text-2xl font-black text-amber-200 tracking-wide">
                {formatClosingDeadline(banners.popup_closing_time)}
              </div>

              {/* Live Countdown Grid if available */}
              {timeLeft && (
                <div className="pt-2 border-t border-amber-500/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80 mb-2">
                    Time Remaining:
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-black/60 border border-amber-400/30 p-2">
                      <span className="block text-xl font-mono font-bold text-white">{timeLeft.days}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Days</span>
                    </div>
                    <div className="rounded-lg bg-black/60 border border-amber-400/30 p-2">
                      <span className="block text-xl font-mono font-bold text-white">{String(timeLeft.hours).padStart(2, "0")}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Hours</span>
                    </div>
                    <div className="rounded-lg bg-black/60 border border-amber-400/30 p-2">
                      <span className="block text-xl font-mono font-bold text-white">{String(timeLeft.minutes).padStart(2, "0")}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Mins</span>
                    </div>
                    <div className="rounded-lg bg-black/60 border border-amber-400/30 p-2">
                      <span className="block text-xl font-mono font-bold text-amber-400">{String(timeLeft.seconds).padStart(2, "0")}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Secs</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Offline Details Callout if available */}
            {banners.offline_contact_details && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300 space-y-1">
                <span className="font-bold text-amber-300 text-[10px] uppercase tracking-wider block">
                  Need Help or Spot Registration Info?
                </span>
                <p className="text-slate-200 font-medium">
                  {banners.offline_contact_details}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleAction}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 px-6 py-4 text-sm font-black uppercase tracking-wider text-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Ticket className="h-4 w-4" />
                <span>Book Ticket Now</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-5 py-4 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
              >
                Got It, Thanks
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
