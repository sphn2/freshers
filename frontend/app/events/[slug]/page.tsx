"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";
import type { Event, BannerSettings } from "@/lib/types";
import { registrationAvailability } from "@/lib/registration";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, CircleAlert, Clock, ExternalLink, Lock, MapPin, RefreshCw, ShieldCheck, Ticket, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import RulesModal from "@/components/RulesModal";
import VerifyPaymentModal from "@/components/VerifyPaymentModal";
import CheckoutProgressLoader from "@/components/CheckoutProgressLoader";

export default function EventRegistrationPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<"idle" | "searching" | "verified" | "not_found">("idle");
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [bannerSettings, setBannerSettings] = useState<BannerSettings | null>(null);
  const college = "Sphoorthy Engineering College";

  useEffect(() => {
    void api.getPublicBanners().then(setBannerSettings).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      try {
        let cleanSlug = slug;
        try {
          cleanSlug = decodeURIComponent(decodeURIComponent(slug));
        } catch {
          cleanSlug = decodeURIComponent(slug);
        }
        setEvent(await api.getEventBySlug(cleanSlug));
      } catch (err: unknown) {
        setError(errorMessage(err, "Failed loading event."));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [slug]);



  // Autofill student data from directory when roll number changes
  useEffect(() => {
    if (!event || !event.allow_autofill) return;

    const trimmed = rollNumber.trim().toUpperCase();
    if (trimmed.length < 5) {
      setAutofillStatus("idle");
      setAutofillError(null);
      setFullName("");
      return;
    }

    const timer = setTimeout(async () => {
      setAutofillStatus("searching");
      setAutofillError(null);
      try {
        const res = await api.autofillStudent(event.id, trimmed);
        if (res.found && res.full_name) {
          setFullName(res.full_name);
          if (res.department) setDepartment(res.department);
          if (res.phone && !phone) setPhone(res.phone);
          if (res.email && !email) setEmail(res.email);
          setAutofillStatus("verified");
          setAutofillError(null);
        } else {
          setFullName("");
          setAutofillStatus("not_found");
          setAutofillError(res.message || "Roll number not found in verified student directory.");
        }
      } catch (err: unknown) {
        setFullName("");
        setAutofillStatus("not_found");
        setAutofillError(errorMessage(err, "Roll number not found in approved college directory."));
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [rollNumber, event?.id, event?.allow_autofill]);

  // Step 1: When student clicks Form Submit, trigger the Rules Modal
  const handleFormSubmit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!event || !registrationAvailability(event).open) return;
    setError(null);
    setNotice(null);
    setShowRulesModal(true);
  };

  // Step 2: When student accepts Rules Modal & clicks "I AGREE & PROCEED TO PAYMENT"
  const handleConfirmRulesAndRegister = async () => {
    if (!event || !registrationAvailability(event).open) return;
    setSubmitting(true);
    try {
      const response = await api.registerStudent(event.id, {
        full_name: fullName,
        roll_number: rollNumber,
        email,
        phone,
        department,
        college,
      });
      const registration = response.registration;
      const paymentToken = response.payment_token;
      if (!paymentToken) {
        throw new Error("A secure booking link could not be created. Please submit again.");
      }
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`reg_token_${registration.id}`, paymentToken);
          localStorage.setItem(`reg_token_${registration.id}`, paymentToken);
          if (registration.ticket_id) {
            sessionStorage.setItem(`ticket_token_${registration.ticket_id}`, paymentToken);
            localStorage.setItem(`ticket_token_${registration.ticket_id}`, paymentToken);
          }
        } catch {}
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }

      const encodedToken = encodeURIComponent(paymentToken);
      const targetPath = (registration.status === "PAID" || registration.ticket_price === 0)
        ? (registration.ticket_id ? `/tickets/${registration.ticket_id}?token=${encodedToken}#access_token=${encodedToken}` : `/checkout/${registration.id}?token=${encodedToken}#access_token=${encodedToken}`)
        : `/checkout/${registration.id}?token=${encodedToken}#access_token=${encodedToken}`;

      router.push(targetPath, { scroll: true });
    } catch (err: unknown) {
      setError(errorMessage(err, "Registration failed. Please try again."));
      setShowRulesModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="panel p-12 text-center text-sm text-slate-600">Loading the event details…</div>;
  if (!event) {
    return (
      <div className="panel mx-auto max-w-2xl p-10 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-rose-700" />
        <h1 className="editorial-title mt-4 text-3xl">We couldn't find that event.</h1>
        <Link href="/" className="button-primary mx-auto mt-6 w-fit">Back to the calendar <ArrowLeft className="h-4 w-4" /></Link>
      </div>
    );
  }

  const availability = registrationAvailability(event);
  const normalizedRollNumber = rollNumber.trim().toUpperCase();
  const ticketPrice = normalizedRollNumber.startsWith("26")
    ? event.first_year_ticket_price
    : normalizedRollNumber.startsWith("25")
      ? event.second_year_ticket_price
      : event.other_ticket_price;

  return (
    <>
      {submitting && <CheckoutProgressLoader isOverlay variant="registration" message="Creating Your Registration..." />}
      <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-600 hover:text-pink-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Campus calendar
      </Link>

      <section className="page-hero surface-grid grid gap-8 p-7 md:grid-cols-[1fr_280px] md:p-10">
        <div className="relative z-10">
          <div className="bg-white/95 p-2 rounded-lg w-fit mb-4 shadow-md">
            <img src="/college_logo.png" alt="Sphoorthy Engineering College" className="h-10 w-auto object-contain" />
          </div>
          <p className="eyebrow !text-[#e5c86f]">{event.event_type} · campus event</p>
          <h1 className="editorial-title mt-3 max-w-3xl text-4xl md:text-6xl">{event.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e1ded3]">{event.description || "An event from the Sphoorthy campus community."}</p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#e3dece]">
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#e5c86f]" />{new Date(event.start_time).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</span>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#e5c86f]" />{event.venue}</span>
          </div>
        </div>
        <div className="relative z-10 flex flex-col justify-between border-t border-white/20 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.17em] text-white/60">Admission</p>
            <p className="editorial-title mt-1 text-4xl text-[#e5c86f]">₹{event.first_year_ticket_price}</p>
            <p className="mt-1 text-xs text-white/70">first year · roll starts 26</p>
            <p className="mt-2 text-xs text-white/70">₹{event.second_year_ticket_price} · second year · roll starts 25</p>
            {event.other_ticket_price !== null && (
              <p className="mt-2 text-xs text-white/70">Other roll prefixes · ₹{event.other_ticket_price}</p>
            )}
          </div>
          <div className="mt-7">
            <span className={`inline-flex items-center gap-2 border px-3 py-2 text-[9px] font-extrabold uppercase tracking-[.1em] ${availability.open ? "border-[#dbbd67]/60 text-[#f0d984]" : "border-white/20 text-white/70"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${availability.open ? "bg-[#e5c86f]" : "bg-white/45"}`} />
              {availability.label}
            </span>
            <p className="mt-3 max-w-[25ch] text-[10px] leading-5 text-white/60">{availability.explanation}</p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[.72fr_1.28fr]">
        <aside className="panel p-6 md:p-7">
          <div className="mb-5 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
            <img src="/udbhav_poster.jpg" alt="Official Event Poster" className="w-full h-auto object-cover" />
          </div>
          <p className="eyebrow">Before you book</p>
          <h2 className="editorial-title mt-3 text-2xl">Your place, made official.</h2>
          <ul className="mt-6 space-y-4 text-xs leading-5 text-slate-600">
            <li className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-pink-100 text-pink-800"><Check className="h-3 w-3" /></span>Use the name and roll number on your college records.</li>
            <li className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-pink-100 text-pink-800"><Check className="h-3 w-3" /></span>Your digital ticket and entry code will be sent after confirmation.</li>
            <li className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-pink-100 text-pink-800"><Check className="h-3 w-3" /></span>Keep your ticket handy on event day for quick entry.</li>
          </ul>
          <div className="mt-7 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">
              <span>Registration window</span><Ticket className="h-4 w-4 text-pink-700" />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-800">{new Date(event.registration_start).toLocaleDateString()} — {new Date(event.registration_end).toLocaleDateString()}</p>
          </div>
        </aside>

        <section className="panel p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div><p className="eyebrow">Attendee details</p><h2 className="editorial-title mt-2 text-3xl">Save your seat</h2></div>
            <div className="hidden h-11 w-11 place-items-center border border-slate-200 text-blue-700 sm:grid"><UserRoundCheck className="h-5 w-5" /></div>
          </div>

          {/* Helper Banner for students who already paid or had money debited */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50/90 p-3.5 text-xs text-amber-950 shadow-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>Money debited from bank or already paid?</strong> Verify live gateway status & dispatch your official ticket to your email.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 px-3.5 py-1.5 text-xs font-bold text-white transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
            >
              Verify Payment
            </button>
          </div>

          {!availability.open ? (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/90 p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">Registration Schedule</span>
                  <h3 className="text-xl font-bold text-amber-950">{availability.label}</h3>
                </div>
              </div>

              {availability.isUpcoming && availability.exactOpenString ? (
                <div className="rounded-lg border border-amber-300/80 bg-white p-4 space-y-2 shadow-inner">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Exact Opening Date & Time:</p>
                  <p className="font-serif text-2xl font-bold text-amber-950">{availability.exactOpenString}</p>
                  <p className="text-xs leading-relaxed text-slate-700 pt-1">
                    {availability.explanation} Keep your student roll number and details ready for fast registration.
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-amber-900">{availability.explanation}</p>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/80 text-xs">
                <span className="font-semibold text-amber-900">
                  Opening Window: {new Date(event.registration_start).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
                </span>
                <Link href="/" className="button-primary !min-h-10 !px-4 !text-[11px] button-accent">
                  Back to Campus Calendar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="mt-6 space-y-4">
              {bannerSettings?.maintenance_mode && (
                <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-xs font-semibold text-amber-950 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <CircleAlert className="h-4 w-4 text-amber-600" />
                    <span>Website Under Maintenance</span>
                  </div>
                  <p className="text-amber-800 italic font-normal">
                    &ldquo;{bannerSettings.maintenance_mode_text}&rdquo;
                  </p>
                  <p className="text-[11px] text-amber-700 font-medium pt-1">
                    Registrations are temporarily paused while we apply scheduled updates. Please check back shortly.
                  </p>
                </div>
              )}

              {bannerSettings?.registrations_closed && !bannerSettings?.maintenance_mode && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-950 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <CircleAlert className="h-4 w-4 text-rose-600" />
                    <span>Registrations Closed</span>
                  </div>
                  <p className="text-rose-800 font-normal">
                    {bannerSettings.registrations_closed_text}
                  </p>
                </div>
              )}

              {error && (
                <div role="alert" className="space-y-2 border border-rose-300 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CircleAlert className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {(error.toLowerCase().includes("confirmed ticket") ||
                    error.toLowerCase().includes("payment was already received") ||
                    error.toLowerCase().includes("already exists")) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowVerifyModal(true)}
                        className="inline-flex items-center gap-1.5 rounded bg-amber-800 hover:bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verify Payment & Resend Ticket to Email
                      </button>
                    </div>
                  )}
                </div>
              )}
              {notice && <div role="status" className="border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{notice}</div>}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="roll-number" className="field-label">College roll number</label>
                  {event.allow_autofill && (
                    <span className="text-[10px] font-bold text-pink-700 uppercase tracking-wider">
                      Auto-Verifies Identity
                    </span>
                  )}
                </div>
                <input
                  id="roll-number"
                  className="field-control font-mono uppercase"
                  autoComplete="off"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                  placeholder="26... (first year) or 25... (second year)"
                />

                {/* Directory verification status indicators */}
                {event.allow_autofill && rollNumber.trim().length >= 5 && (
                  <div className="mt-2">
                    {autofillStatus === "searching" && (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-pink-600 shrink-0" />
                        <span>Searching college directory records…</span>
                      </div>
                    )}
                    {autofillStatus === "verified" && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/90 px-3 py-2 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Verified student: <strong>{fullName}</strong> ({department}) · Locked for ticket accuracy</span>
                      </div>
                    )}
                    {autofillStatus === "not_found" && (
                      <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                        <CircleAlert className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>{autofillError || "Roll number not found in student directory. Only approved students can register."}</span>
                      </div>
                    )}
                  </div>
                )}

                {rollNumber && ticketPrice === null && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">
                    This roll-number prefix has no configured fee. Contact event staff to confirm eligibility.
                  </p>
                )}
                {ticketPrice !== null && (
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    {normalizedRollNumber.startsWith("26") ? "First-year" : "Second-year"} admission: ₹{ticketPrice}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="full-name" className="field-label">Full name</label>
                    {event.allow_autofill && (
                      <span className="text-[10px] font-bold text-slate-500 inline-flex items-center gap-1">
                        <Lock className="h-3 w-3 text-slate-400" /> Auto-filled
                      </span>
                    )}
                  </div>
                  {event.allow_autofill ? (
                    <input
                      id="full-name"
                      className="field-control !bg-slate-100 !text-slate-800 font-semibold cursor-not-allowed border-slate-200"
                      readOnly
                      tabIndex={-1}
                      value={fullName}
                      placeholder={autofillStatus === "searching" ? "Searching directory…" : "Auto-filled from roll number"}
                    />
                  ) : (
                    <input
                      id="full-name"
                      className="field-control"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As on your student ID"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="email" className="field-label">Your Mail</label>
                    <span className="text-[10px] font-semibold text-pink-700">Receives ticket</span>
                  </div>
                  <input
                    id="email"
                    type="email"
                    className="field-control"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="field-label">Mobile number</label>
                  <input
                    id="phone"
                    type="tel"
                    className="field-control"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="department" className="field-label">Department</label>
                    {event.allow_autofill && (
                      <span className="text-[10px] font-bold text-slate-500 inline-flex items-center gap-1">
                        <Lock className="h-3 w-3 text-slate-400" /> Auto-filled
                      </span>
                    )}
                  </div>
                  {event.allow_autofill ? (
                    <input
                      id="department"
                      className="field-control !bg-slate-100 !text-slate-800 font-semibold cursor-not-allowed border-slate-200"
                      readOnly
                      tabIndex={-1}
                      value={department}
                      placeholder="Auto-filled"
                    />
                  ) : (
                    <select
                      id="department"
                      className="field-control"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="CSE-CS">CSE-CS</option>
                      <option value="CSE - AIML">CSE - AIML</option>
                      <option value="CSE - DS">CSE - DS</option>
                      <option value="CIVIL">CIVIL</option>
                    </select>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="college" className="field-label">Institution</label>
                  <input id="college" className="field-control !bg-slate-100 font-medium" readOnly value={college} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 shadow-sm">
                <label htmlFor="accept-privacy" className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    id="accept-privacy"
                    type="checkbox"
                    required
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500 accent-pink-600 shrink-0"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed font-medium">
                    I have read and agree to the{" "}
                    <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-pink-700 hover:underline inline-flex items-center gap-0.5">
                      Terms & Conditions <ExternalLink className="h-3 w-3" />
                    </Link>{", "}
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-pink-700 hover:underline inline-flex items-center gap-0.5">
                      Privacy Policy <ExternalLink className="h-3 w-3" />
                    </Link>{", and "}
                    <Link href="/refund-policy" target="_blank" rel="noopener noreferrer" className="font-bold text-pink-700 hover:underline inline-flex items-center gap-0.5">
                      Refund Policy <ExternalLink className="h-3 w-3" />
                    </Link>{" "}
                    and confirm my student details are accurate.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={
                  submitting ||
                  ticketPrice === null ||
                  !acceptedPrivacy ||
                  (event.allow_autofill && autofillStatus !== "verified") ||
                  Boolean(bannerSettings?.maintenance_mode) ||
                  Boolean(bannerSettings?.registrations_closed)
                }
                className="button-primary button-accent mt-2 w-full !min-h-[52px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {submitting
                  ? "Securing your registration…"
                  : bannerSettings?.maintenance_mode
                    ? "Website Under Maintenance · Paused"
                    : bannerSettings?.registrations_closed
                      ? "Registrations Closed · Contact Committee"
                      : event.allow_autofill && autofillStatus === "searching"
                        ? "Verifying college directory…"
                        : event.allow_autofill && autofillStatus === "not_found"
                          ? "Enter a valid directory roll number"
                          : event.allow_autofill && autofillStatus === "idle"
                            ? "Enter roll number to auto-fill details"
                            : `Continue · ${ticketPrice === null ? "Select an eligible roll number" : ticketPrice > 0 ? `₹${ticketPrice}` : "Free admission"}`}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-center text-[10px] leading-5 text-slate-500">Your information is used to create and verify your event ticket.</p>
            </form>
          )}
        </section>
      </div>

      {/* Rules and Regulations Popup Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        onConfirm={handleConfirmRulesAndRegister}
        submitting={submitting}
      />

      {/* Verify Payment & Resend Ticket Modal */}
      <VerifyPaymentModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
      />
    </div>
  </>
  );
}
