"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";
import type { Event } from "@/lib/types";
import { registrationAvailability } from "@/lib/registration";
import { ArrowUpRight, CalendarDays, Clock, MapPin, Sparkles, Ticket, Users, CheckCircle2 } from "lucide-react";

export default function StudentHomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await api.getOperationalEvents();
        setEvents(data.events);
      } catch (err: unknown) {
        setError(errorMessage(err, "We couldn't load the event calendar."));
      } finally {
        setLoading(false);
      }
    }
    void loadEvents();
  }, []);

  // Featured UDBHAV '26 Event or default first event
  const mainEvent = events.find((e) => e.slug === "freshers-2k26") || events[0];

  return (
    <div className="space-y-12">
      {/* College Logo Banner Header Bar */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-amber-200/60 bg-gradient-to-r from-slate-900 via-[#17221e] to-slate-900 p-5 text-white shadow-xl sm:flex-row sm:px-8">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-white p-2 shadow-inner">
            <img
              src="/college_logo.png"
              alt="Sphoorthy Engineering College (UGC Autonomous)"
              className="h-12 w-auto object-contain max-w-[280px] sm:max-w-[380px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 text-xs font-bold text-amber-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            Official Freshers Event Portal 2026
          </span>
        </div>
      </div>

      {/* Featured Event Hero Showcase Section */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1715] p-6 shadow-2xl md:p-10 text-white">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr]">
          {/* Left Column: Details & Call to Action */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-md bg-amber-400/20 border border-amber-400/40 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> UDBHAV '26 — FRESHERS CELEBRATION
            </div>

            <h1 className="editorial-title text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white">
              A New Beginning,<br />
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent italic">
                A New Journey.
              </span>
            </h1>

            <p className="max-w-xl text-sm sm:text-base leading-relaxed text-slate-300">
              Sphoorthy Engineering College welcomes all first-year and second-year students to the grandest annual Freshers celebration of the year! Secure your pass online today.
            </p>

            {/* Event Key Highlights */}
            <div className="grid gap-3 sm:grid-cols-2 pt-2 text-xs font-semibold text-slate-200">
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <CalendarDays className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Event Date</p>
                  <p className="text-white font-bold">31st October, 2026</p>
                  <p className="text-[10px] text-amber-300/80">(9:00 AM onwards)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <MapPin className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Venue</p>
                  <p className="text-white font-bold">SPHN GROUND</p>
                  <p className="text-[10px] text-slate-300">Main Campus</p>
                </div>
              </div>
            </div>

            {/* Pricing Badges */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="rounded-lg bg-amber-950/60 border border-amber-500/40 px-4 py-2 text-amber-200">
                <span className="block text-[9px] uppercase tracking-widest font-extrabold text-amber-400">First Year (Roll 26...)</span>
                <span className="font-serif text-2xl font-bold">₹500</span>
              </div>
              <div className="rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-4 py-2 text-emerald-200">
                <span className="block text-[9px] uppercase tracking-widest font-extrabold text-emerald-400">Second Year (Roll 25...)</span>
                <span className="font-serif text-2xl font-bold">₹600</span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <Link
                href={mainEvent ? `/events/${mainEvent.slug}` : "/events/freshers-2k26"}
                className="button-primary button-accent inline-flex items-center gap-3 !min-h-14 !px-8 text-sm font-extrabold uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all"
              >
                <Ticket className="h-5 w-5" /> Book Ticket & Reserve Pass
                <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Right Column: Featured Attached Poster Image Display */}
          <div className="relative group mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-400 to-emerald-500 opacity-30 blur-lg transition duration-500 group-hover:opacity-60" />
            <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-black shadow-2xl">
              <img
                src="/udbhav_poster.jpg"
                alt="UDBHAV '26 Freshers Celebration Poster - Sphoorthy Engineering College"
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 text-center">
                <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Official Event Poster</p>
                <p className="text-[10px] text-slate-300">UDBHAV '26 · Sphoorthy Engineering College</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campus Event List Section */}
      <section id="events" className="scroll-mt-28 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-4">
          <div>
            <p className="eyebrow">Sphoorthy Engineering College</p>
            <h2 className="editorial-title mt-1 text-3xl md:text-4xl">Campus Event Directory</h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-slate-600">
            Official ticketing & entry platform powered by Intelligent Security.
          </p>
        </div>

        {loading ? (
          <div className="panel p-10 text-center text-sm text-slate-500">Loading campus calendar events…</div>
        ) : error ? (
          <div role="alert" className="panel border-rose-300 p-5 text-sm text-rose-800">{error}</div>
        ) : events.length === 0 ? (
          <div className="panel p-10 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-amber-700" />
            <p className="editorial-title mt-4 text-2xl">A little quiet before the next big thing.</p>
            <p className="mt-2 text-sm text-slate-600">There are no active events published right now.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => {
              const availability = registrationAvailability(event);
              return (
                <article className="event-card group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md transition-all hover:-translate-y-1 hover:shadow-xl" key={event.id}>
                  {/* Poster Image Card Header */}
                  <div className="relative h-64 w-full overflow-hidden bg-slate-900">
                    <img
                      src="/udbhav_poster.jpg"
                      alt={event.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    
                    <div className="absolute top-3 inset-x-3 flex items-start justify-between gap-2">
                      <span className="rounded bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-400/30">
                        {event.event_type}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                        availability.open
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                          : availability.isUpcoming
                          ? "bg-amber-950/90 text-amber-300 border border-amber-400/60"
                          : "bg-slate-900/80 text-slate-300 border border-slate-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${availability.open ? "bg-emerald-400 animate-pulse" : availability.isUpcoming ? "bg-amber-400 animate-pulse" : "bg-slate-400"}`} />
                        {availability.label}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">SPHOORTHY CELEBRATION</p>
                      <h3 className="editorial-title text-2xl font-bold leading-snug">{event.title}</h3>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-5 space-y-4">
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {event.description || "Official Annual Freshers Celebration & Cultural Fest for Engineering Students - UDBHAV '26."}
                    </p>

                    {availability.isUpcoming && availability.exactOpenString && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 font-medium">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                          <Clock className="h-3.5 w-3.5 text-amber-600" /> Registration Opens Soon
                        </div>
                        <p className="mt-1 font-bold text-amber-950 text-[11px]">{availability.exactOpenString}</p>
                      </div>
                    )}

                    <div className="grid gap-2 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-700">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-600 shrink-0" />
                        {new Date(event.start_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                        {event.venue}
                      </p>
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500 shrink-0" />
                        Capacity {event.capacity.toLocaleString()} students
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">Fee Structure</span>
                        <span className="text-sm font-bold text-amber-700">₹{event.first_year_ticket_price} (Yr 1)</span>
                        <span className="text-xs text-slate-500 ml-1.5">/ ₹{event.second_year_ticket_price} (Yr 2)</span>
                      </div>

                      <Link
                        href={`/events/${event.slug}`}
                        className={`button-primary !min-h-10 !px-4 !text-xs ${availability.open ? "button-accent" : availability.isUpcoming ? "!border-amber-400 !bg-amber-100 !text-amber-950 hover:!bg-amber-200" : "!border-slate-300 !bg-transparent !text-slate-700 hover:!bg-slate-100"}`}
                      >
                        {availability.open ? "Register Now" : availability.isUpcoming ? "Opens Soon" : "Details"}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Trust & Institution Footer Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-4 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Verified Event Entry Pass System · Sphoorthy Engineering College</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">Campus Code: SPHN-2026</span>
      </div>
    </div>
  );
}
