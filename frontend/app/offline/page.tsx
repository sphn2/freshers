"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/auth";
import { errorMessage } from "@/lib/types";
import type { CollectorSummary, Event, OfflineRegistrationResult } from "@/lib/types";
import { registrationAvailability } from "@/lib/registration";
import { Banknote, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

export default function OfflineCollectorPage() {
  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "EVENT_MANAGER", "OFFLINE_COLLECTOR"]}>
      <OfflineCollectorContent />
    </ProtectedRoute>
  );
}

function OfflineCollectorContent() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [summary, setSummary] = useState<CollectorSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Form State
  const [rollNumber, setRollNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OfflineRegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
  const normalizedRollNumber = rollNumber.trim().toUpperCase();
  const expectedAmount = selectedEvent
    ? normalizedRollNumber.startsWith("26")
      ? selectedEvent.first_year_ticket_price
      : normalizedRollNumber.startsWith("25")
        ? selectedEvent.second_year_ticket_price
        : selectedEvent.other_ticket_price
    : null;

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await api.getOperationalEvents();
        const offlineEvents = data.events.filter((event) => event.allow_offline);
        if (offlineEvents.length > 0) {
          setEvents(offlineEvents);
          setSelectedEventId(offlineEvents[0].id);
        }
      } catch (err: unknown) {
        setError(errorMessage(err, "Failed loading events."));
      }
    }
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadSummary();
    }
  }, [selectedEventId]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    setSummary(null);
    try {
      const s = await api.getCollectorSummary(selectedEventId);
      setSummary(s);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed loading collection summary."));
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!selectedEventId || expectedAmount === null) {
      setError("Enter an eligible roll number with a configured event fee.");
      return;
    }
    if (pin.length !== 6) {
      setError("Please enter your 6-digit authorization PIN.");
      return;
    }
    setSubmitting(true);

    try {
      const payload = {
        event_id: selectedEventId,
        roll_number: rollNumber.trim().toUpperCase(),
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department,
        amount_paid: expectedAmount,
        pin: pin.trim(),
        receipt_number: receiptNumber.trim() || undefined,
      };

      const res = await api.registerOfflineCash(payload);
      setResult(res);

      // Reset Form
      setRollNumber("");
      setFullName("");
      setEmail("");
      setPhone("");
      setReceiptNumber("");
      setPin("");
      loadSummary();
    } catch (err: unknown) {
      setError(errorMessage(err, "Offline cash registration failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header & Collector Summary */}
      <div className="page-hero surface-grid flex flex-col justify-between gap-6 p-6 md:flex-row md:items-end md:p-8">
        <div className="relative z-10">
          <p className="eyebrow !text-[#e5c86f]">In-person registration</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-white/25 bg-white/10 text-[#e5c86f]">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="editorial-title text-3xl md:text-4xl">Cash desk</h1>
              <p className="mt-1 text-[11px] text-white/65">Record payment. Issue a verified digital pass.</p>
            </div>
          </div>
        </div>

        {/* Event Selection & KPI Summary */}
        <div className="relative z-10 grid w-full gap-3 sm:grid-cols-3 md:max-w-xl">
          <div className="md:col-span-1">
            <label className="field-label !text-white/60">Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="field-control"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} (26… ₹{e.first_year_ticket_price} / 25… ₹{e.second_year_ticket_price}{e.other_ticket_price !== null ? ` / other ₹${e.other_ticket_price}` : ""})
                </option>
              ))}
            </select>
          </div>

          <div className="border border-white/20 bg-white/5 p-3">
            <div className="text-[9px] font-bold uppercase tracking-[.12em] text-white/55">Cash collected</div>
            <div className="metric-value mt-1 text-2xl text-[#e5c86f]">
              ₹{loadingSummary ? "Loading..." : summary?.total_cash || 0}
            </div>
          </div>

          <div className="border border-white/20 bg-white/5 p-3">
            <div className="text-[9px] font-bold uppercase tracking-[.12em] text-white/55">Passes issued</div>
            <div className="metric-value mt-1 text-2xl text-white">
              {loadingSummary ? "Loading..." : `${summary?.total_count || 0} Pass(es)`}
            </div>
          </div>
        </div>
      </div>

      {/* Success Receipt Banner */}
      {result && (
        <div role="status" className="border border-emerald-300 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>OFFLINE CASH REGISTRATION SUCCESSFUL!</span>
          </div>
          <div className="text-xs text-emerald-900 space-y-1 font-medium">
            <div>
              Ticket Issued: <strong className="font-mono text-pink-600 text-sm">{result.ticket_code}</strong>
            </div>
            <div>Student: {result.student_name}</div>
            <div>Amount Collected: ₹{result.amount_paid} Cash</div>
          </div>
        </div>
      )}

      {/* Registration Form */}
      {selectedEvent && !registrationAvailability(selectedEvent).open && (
        <div role="status" className="border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          <strong>{registrationAvailability(selectedEvent).label}.</strong> {registrationAvailability(selectedEvent).explanation} New cash registrations are paused.
        </div>
      )}
      {!selectedEventId && <div className="panel p-5 text-sm text-slate-600">No offline-enabled events are available at this time.</div>}

      <form onSubmit={handleSubmit} hidden={!selectedEventId} className="offline-form panel space-y-5 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div><p className="eyebrow">Attendee intake</p><h2 className="editorial-title mt-2 text-3xl">New registration</h2></div>
          <ShieldCheck className="h-5 w-5 text-blue-700" />
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Roll number *</label>
            <input
              type="text"
              required
              placeholder="26… (first year) or 25… (second year)"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
              className="field-control font-mono uppercase"
            />
          </div>

          <div>
            <label className="field-label">Full name *</label>
            <input
              type="text"
              required
              placeholder="Student Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="field-control"
            />
          </div>

          <div>
            <label className="field-label">Email address *</label>
            <input
              type="email"
              required
              placeholder="student@sphoorthy.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-control"
            />
          </div>

          <div>
            <label className="field-label">Mobile phone *</label>
            <input
              type="tel"
              required
              placeholder="10-digit phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field-control"
            />
          </div>

          <div>
            <label className="field-label">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="field-control"
            >
              <option value="CSE">CSE</option>
              <option value="AIML">AIML</option>
              <option value="DATA SCIENCE">Data Science</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="MECHANICAL">Mechanical</option>
              <option value="CIVIL">Civil</option>
            </select>
          </div>

          <div>
            <label className="field-label">Required cash amount (₹) · based on roll prefix</label>
              <input
                type="number"
                readOnly
                value={expectedAmount ?? ""}
                className="field-control !bg-slate-100 !font-bold"
              />
            {expectedAmount === null && rollNumber && (
              <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">
                This roll-number prefix has no configured fee.
              </p>
            )}
          </div>

          <div>
            <label className="field-label">Physical receipt no. (optional)</label>
            <input
              type="text"
              placeholder="e.g. SPHN-CASH-1002"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="field-control font-mono"
            />
          </div>

          <div>
            <label className="field-label">Authorization PIN (6 digits) *</label>
            <input
              type="password"
              required
              minLength={6}
              maxLength={6}
              pattern="\d{6}"
              inputMode="numeric"
              placeholder="Enter 6-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="field-control font-mono tracking-widest text-center"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !selectedEventId || !selectedEvent || !registrationAvailability(selectedEvent).open || expectedAmount === null}
          className="button-primary button-accent w-full !min-h-[54px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Spot Payment...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>COLLECT CASH & ISSUE DIGITAL TICKET</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
