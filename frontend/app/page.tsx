"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";
import type { Event } from "@/lib/types";
import { registrationAvailability } from "@/lib/registration";
import { ArrowDownRight, ArrowUpRight, CalendarDays, MapPin, Ticket, Users } from "lucide-react";

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

  return (
    <div className="space-y-11">
      <section className="page-hero surface-grid grid min-h-[340px] items-end gap-8 p-7 md:grid-cols-[1.2fr_.8fr] md:p-12">
        <div className="relative z-10 max-w-2xl pb-2">
          <p className="eyebrow !text-[#e5c86f]">The campus calendar · 2026</p>
          <h1 className="editorial-title mt-5 text-5xl md:text-7xl">
            Make room<br />for <span className="italic text-[#e2bd55]">something</span><br />brilliant.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-[#e1ded3]">
            The talks, showcases, celebrations and competitions that bring our campus together. Find your next reason to show up.
          </p>
          <a href="#events" className="button-primary button-accent mt-7 w-fit !min-h-12">
            Browse upcoming events <ArrowDownRight className="h-4 w-4" />
          </a>
        </div>

        <div className="relative z-10 hidden justify-self-end pb-3 pr-3 md:block">
          <div className="relative grid h-56 w-56 place-items-center rounded-full border border-[#d7bb66]/55">
            <div className="absolute inset-4 rounded-full border border-[#d7bb66]/30" />
            <div className="absolute inset-10 rounded-full border border-dashed border-[#d7bb66]/40" />
            <div className="text-center">
              <span className="block font-serif text-6xl text-[#e5c86f]">{String(events.length).padStart(2, "0")}</span>
              <span className="mt-2 block text-[9px] font-bold uppercase tracking-[.2em] text-[#e1ded3]">On the calendar</span>
            </div>
            <span className="absolute -right-2 top-8 grid h-10 w-10 place-items-center rounded-full bg-[#d3a52b] text-[#17221e]">
              <Ticket className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-4 text-right text-[9px] font-bold uppercase tracking-[.18em] text-[#d8cba8]">Sphoorthy Engineering College</p>
        </div>
      </section>

      <section id="events" className="scroll-mt-28">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Find your people</p>
            <h2 className="editorial-title mt-2 text-3xl md:text-4xl">Coming up on campus</h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-slate-600">One calendar. Every idea, performance and moment worth being there for.</p>
        </div>

        {loading ? (
          <div className="panel p-10 text-center text-sm text-slate-500">Gathering the campus calendar…</div>
        ) : error ? (
          <div role="alert" className="panel border-rose-300 p-5 text-sm text-rose-800">{error}</div>
        ) : events.length === 0 ? (
          <div className="panel p-10 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-pink-700" />
            <p className="editorial-title mt-4 text-2xl">A little quiet before the next big thing.</p>
            <p className="mt-2 text-sm text-slate-600">There are no published events just yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event, index) => {
              const availability = registrationAvailability(event);
              return (
                <article className="event-card" key={event.id}>
                  <div className="event-poster flex flex-col justify-between p-5">
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <span className="border border-white/35 bg-black/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.15em]">{event.event_type}</span>
                      <span className={`inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[.08em] ${availability.open ? "text-[#f6e4a0]" : "text-white/70"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${availability.open ? "bg-[#e5c86f]" : "bg-white/45"}`} />
                        {availability.label}
                      </span>
                    </div>
                    <div className="relative z-10 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/65">Field note · {String(index + 1).padStart(2, "0")}</p>
                        <p className="editorial-title mt-2 max-w-[15ch] text-3xl">{event.title}</p>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block font-serif text-lg leading-tight text-[#f3dc92]">₹{event.first_year_ticket_price}</span>
                        <span className="block text-[8px] uppercase tracking-[.12em] text-white/60">year 1 · 26…</span>
                        <span className="mt-1 block font-serif text-lg leading-tight text-[#f3dc92]">₹{event.second_year_ticket_price}</span>
                        <span className="block text-[8px] uppercase tracking-[.12em] text-white/60">year 2 · 25…</span>
                        {event.other_ticket_price !== null && (
                          <>
                            <span className="mt-1 block font-serif text-base leading-tight text-[#f3dc92]">₹{event.other_ticket_price}</span>
                            <span className="block text-[8px] uppercase tracking-[.12em] text-white/60">other prefixes</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">{event.description || "A Sphoorthy campus event. Come curious; leave with a story."}</p>
                    <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-[11px] font-semibold text-slate-600">
                      <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-pink-700" />{new Date(event.start_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                      <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-blue-700" />{event.venue}</p>
                      <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-slate-500" />Capacity {event.capacity.toLocaleString()}</p>
                    </div>
                    <Link
                      href={`/events/${event.slug}`}
                      className={`button-primary mt-5 w-full ${availability.open ? "" : "!border-slate-300 !bg-transparent !text-slate-700 hover:!bg-slate-100"}`}
                    >
                      {availability.open ? "Event details & registration" : "See event details"}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <div className="flex items-center justify-between border-t border-slate-300 pt-5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">
        <span>Show up for something</span><span>01 — Campus life</span>
      </div>
    </div>
  );
}
