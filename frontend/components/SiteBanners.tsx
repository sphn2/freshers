"use client";

import React, { useEffect, useState } from "react";
import { Wrench, AlertOctagon, Phone, Clock, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { BannerSettings } from "@/lib/types";

export default function SiteBanners() {
  const [banners, setBanners] = useState<BannerSettings | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchBanners = async () => {
      try {
        const data = await api.getPublicBanners();
        if (mounted) {
          setBanners(data);
        }
      } catch {
        // fail silently for banners
      }
    };

    void fetchBanners();

    // Check periodically for real-time banner toggles during deployments
    const interval = setInterval(fetchBanners, 25000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!banners) return null;

  const showMaintenance = Boolean(banners.maintenance_mode);
  const showClosed = Boolean(banners.registrations_closed);

  if (!showMaintenance && !showClosed) return null;

  return (
    <div className="relative z-40 w-full flex flex-col">
      {/* 1. Maintenance Mode Banner (Top Priority) */}
      {showMaintenance && (
        <aside
          role="alert"
          aria-live="assertive"
          className="relative overflow-hidden border-b border-amber-400/40 bg-gradient-to-r from-[#211704] via-[#332208] to-[#211704] px-4 py-2.5 text-amber-100 shadow-lg"
        >
          {/* Subtle Ambient Pulse */}
          <div className="pointer-events-none absolute -left-10 top-0 h-full w-24 bg-amber-400/10 blur-xl animate-pulse" />

          <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-2.5 sm:flex-row">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <Wrench className="h-4 w-4 animate-bounce" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
              </div>

              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <span className="font-bold text-amber-200 text-xs uppercase tracking-wider">
                    Website Under Maintenance
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                    <Clock className="h-3 w-3" /> Live in 10–15 mins
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-amber-100/90 italic font-medium">
                  &ldquo;{banners.maintenance_mode_text}&rdquo;
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="rounded-md bg-black/40 px-2.5 py-1 text-[11px] font-mono text-amber-300 border border-amber-400/20">
                System Upgrade in Progress
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* 2. Registrations Closed Banner */}
      {showClosed && (
        <aside
          role="status"
          aria-live="polite"
          className="relative overflow-hidden border-b border-rose-500/40 bg-gradient-to-r from-[#20080c] via-[#310c14] to-[#20080c] px-4 py-2.5 text-rose-100 shadow-md"
        >
          <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-2 sm:flex-row">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300 border border-rose-400/30">
                <AlertOctagon className="h-4 w-4 text-rose-400" />
              </div>
              <div>
                <span className="font-extrabold text-rose-200 text-xs uppercase tracking-wider mr-2">
                  Notice:
                </span>
                <span className="text-xs font-semibold text-rose-100">
                  {banners.registrations_closed_text}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <a
                href="tel:+918179645560"
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 px-3 py-1 text-xs font-bold text-rose-200 border border-rose-400/30 transition-colors"
              >
                <Phone className="h-3 w-3 text-rose-400" />
                <span>Contact Organizing Team</span>
              </a>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
