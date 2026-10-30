"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/types";
import type { Event, ValidationResult } from "@/lib/types";
import {
  Utensils,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { QrCameraScanner } from "@/components/QrCameraScanner";
import { playFeedbackSound } from "@/lib/sound";

export default function FoodScannerPage() {
  return (
    <ProtectedRoute allowedRoles={["FOOD_STAFF"]}>
      <FoodScannerContent />
    </ProtectedRoute>
  );
}

function FoodScannerContent() {
  const { role, hasRole } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [foodLocation, setFoodLocation] = useState<string>("Counter A (Main)");
  const [eventError, setEventError] = useState<string | null>(null);

  const [inputCode, setInputCode] = useState<string>("");
  const [validating, setValidating] = useState<boolean>(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Sound and verification metrics
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sessionClaimed, setSessionClaimed] = useState<number>(0);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const isManagerOnly = hasRole(["EVENT_MANAGER"]) && !hasRole(["ADMIN", "SUPER_ADMIN"]);
        const data = isManagerOnly
          ? await api.adminListEvents()
          : await api.getOperationalEvents();
        const availableEvents = data.events.filter(
          (event) => ["PUBLISHED", "LIVE"].includes(event.status) && event.food_validation_enabled,
        );
        if (availableEvents.length > 0) {
          setEvents(availableEvents);
          const liveEvent = availableEvents.find((e) => e.status === "LIVE");
          setSelectedEventId(liveEvent ? liveEvent.id : availableEvents[0].id);
        }
      } catch (err: unknown) {
        setEventError(errorMessage(err, "Failed loading events."));
      }
    }
    loadEvents();
  }, [role]);

  const handleKeypadPress = (num: string) => {
    if (!validating && inputCode.length < 6) {
      setInputCode((prev) => prev + num);
    }
  };

  const handleClear = () => {
    setInputCode("");
    setResult(null);
    setRequestError(null);
  };

  const handleBackspace = () => {
    setInputCode((prev) => prev.slice(0, -1));
  };

  const executeFoodValidation = async (scannedQr?: string) => {
    if (validating || (!scannedQr && !inputCode)) return;
    if (!selectedEventId) {
      setResult({ status: "INVALID_TICKET", message: "No food-enabled events are available." });
      return;
    }

    setValidating(true);
    setRequestError(null);
    const startTime = performance.now();

    try {
      const res = await api.validateFood({
        event_id: selectedEventId,
        ...(scannedQr ? { qr_token: scannedQr } : { ticket_code: inputCode.trim() }),
        food_location: foodLocation,
      });

      const elapsedMs = Math.round(performance.now() - startTime);
      setLastLatencyMs(elapsedMs);
      setResult(res);
      setInputCode("");

      // Instant Audio & Haptic Feedback
      if (res.status === "VALID") {
        setSessionClaimed((prev) => prev + 1);
        if (soundEnabled) playFeedbackSound("valid");
        if (typeof navigator.vibrate === "function") navigator.vibrate([70, 40, 70]);
      } else if (res.status === "FOOD_ALREADY_CLAIMED") {
        if (soundEnabled) playFeedbackSound("already_used");
        if (typeof navigator.vibrate === "function") navigator.vibrate([240]);
      } else {
        if (soundEnabled) playFeedbackSound("invalid");
        if (typeof navigator.vibrate === "function") navigator.vibrate([120, 60, 120]);
      }
    } catch (err: unknown) {
      if (soundEnabled) playFeedbackSound("invalid");
      setRequestError(errorMessage(err, "Could not verify the ticket. Check the connection and retry."));
    } finally {
      setInputCode("");
      setValidating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {eventError && (
        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {eventError}
        </div>
      )}
      {!eventError && events.length === 0 && (
        <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold">
          No food-enabled events are available.
        </div>
      )}
      {requestError && (
        <div role="alert" className="border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          Verification could not be completed: {requestError} This does not confirm that the ticket is invalid. Retry when the scanner is connected.
        </div>
      )}

      {/* Header & Counter Selection */}
      <div className="page-hero flex flex-col justify-between gap-5 p-5 md:flex-row md:items-end md:p-7">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center border border-white/25 bg-white/10 text-[#e5c86f]">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow !text-[#e5c86f]">Food Entitlement Verification</p>
              <h1 className="editorial-title mt-1 text-3xl">Counter desk</h1>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/80">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 font-semibold text-blue-200 border border-blue-400/30">
              <Zap className="h-3 w-3 text-amber-400" />
              Claimed: <strong className="text-white text-xs">{sessionClaimed}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSessionClaimed(0)}
              title="Reset session claimed counter"
              className="text-white/60 hover:text-white inline-flex items-center gap-1 text-[10px]"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Reset
            </button>
            {lastLatencyMs !== null && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                ⚡ {lastLatencyMs}ms
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 grid w-full gap-3 sm:grid-cols-2 md:max-w-md">
          <div>
            <label className="field-label !text-white/60">Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="field-control"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label !text-white/60">Counter</label>
            <select
              value={foodLocation}
              onChange={(e) => setFoodLocation(e.target.value)}
              className="field-control"
            >
              <option value="Counter A (Main)">Counter A (Main)</option>
              <option value="Counter B (North)">Counter B (North)</option>
              <option value="VIP Food Counter">VIP Counter</option>
            </select>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Strict Entitlement Check</span>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              soundEnabled
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {soundEnabled ? "Sound ON" : "Muted"}
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Meal coupon details stay on screen until the next pass is scanned.
        </p>
      </div>

      {/* Validation Result Display - Details Stay Until Next Scan */}
      {result && (
        <div
          role="status"
          aria-live="assertive"
          className={`scan-result-card relative p-5 sm:p-6 rounded-3xl border-2 shadow-lg transition-all ${
            result.status === "VALID"
              ? "bg-blue-600 text-white border-blue-700 shadow-blue-900/10"
              : result.status === "FOOD_ALREADY_CLAIMED"
              ? "bg-amber-500 text-slate-950 border-amber-600 shadow-amber-900/10"
              : "bg-rose-600 text-white border-rose-700 shadow-rose-900/10"
          }`}
        >
          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-4 right-4 rounded-full p-1.5 bg-black/20 hover:bg-black/35 text-white/80 hover:text-white transition-all cursor-pointer"
            title="Clear coupon details"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            {result.status === "VALID" ? (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 border border-white/30 shrink-0">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
            ) : result.status === "FOOD_ALREADY_CLAIMED" ? (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black/20 border border-black/30 shrink-0">
                <AlertTriangle className="w-7 h-7 text-slate-950" />
              </div>
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 border border-white/30 shrink-0">
                <XCircle className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-85">
                {result.status === "VALID"
                  ? "Entitlement Approved"
                  : result.status === "FOOD_ALREADY_CLAIMED"
                  ? "Already Served"
                  : "Invalid Coupon"}
              </p>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                {result.status === "VALID"
                  ? "FOOD COUPON CLAIMED — SUCCESS"
                  : result.status === "FOOD_ALREADY_CLAIMED"
                  ? "FOOD COUPON ALREADY CLAIMED"
                  : "INVALID TICKET"}
              </h3>
            </div>
          </div>

          {result.student_name && (
            <div className="mt-4 pt-4 border-t border-white/25 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/15 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Attendee Name</p>
                <p className="text-lg font-black tracking-tight mt-0.5">{result.student_name}</p>
              </div>

              <div className="rounded-2xl bg-black/15 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Roll Number</p>
                <p className="text-lg font-black font-mono tracking-wider mt-0.5">{result.roll_number || "—"}</p>
              </div>

              {result.department && (
                <div className="rounded-2xl bg-black/15 p-3.5 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Department / Branch</p>
                  <p className="text-sm font-extrabold mt-0.5">{result.department}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-semibold opacity-90 pt-2 border-t border-white/20">
            <span>Ticket: {result.ticket_code || inputCode || (result.status === "INVALID_TICKET" ? "QR scan" : "")}</span>
            <span>Counter: {result.food_location || foodLocation}</span>
            {lastLatencyMs !== null && <span>⚡ {lastLatencyMs}ms</span>}
          </div>

          <p className="mt-2 text-center text-[11px] font-medium opacity-80">
            Details stay on screen. Point camera at the next coupon to verify the next attendee.
          </p>
        </div>
      )}

      {/* Keypad & Continuous Camera Scanner */}
      <div className="panel grid min-w-0 grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:p-7">
        <div className="min-w-0 md:col-span-2">
          <QrCameraScanner
            onScan={(decodedText) => void executeFoodValidation(decodedText)}
            scanEnabled={!validating}
            resetTrigger={result ? (result.ticket_code || result.status) : undefined}
          />
          {validating && (
            <div role="status" className="mt-3 flex items-center justify-center gap-2 bg-blue-50 py-2.5 px-3 rounded-xl border border-blue-200 text-xs font-bold text-blue-800">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span>Verifying meal coupon instantly…</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="eyebrow">Manual verification</p>
          <h2 className="editorial-title mt-2 text-2xl">Read the pass code</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">Enter the six digits from the attendee's official ticket.</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center sm:p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Enter 6-Digit Ticket Code
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 sm:gap-2">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className={`flex h-12 w-9 items-center justify-center rounded-xl border-2 font-mono text-xl font-black sm:h-14 sm:w-10 sm:text-2xl ${
                    inputCode[idx]
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {inputCode[idx] || ""}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 self-end">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleKeypadPress(num)}
              disabled={validating}
              className="keypad-btn"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={validating}
            className="keypad-btn !text-[10px] !font-extrabold"
          >
            CLEAR
          </button>
          <button
            onClick={() => handleKeypadPress("0")}
            className="keypad-btn"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={validating}
            className="keypad-btn !text-pink-700"
          >
            ⌫
          </button>
        </div>

        <button
          onClick={() => void executeFoodValidation()}
          disabled={validating || inputCode.length !== 6}
          className="button-primary button-accent col-span-1 w-full !min-h-[54px] disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
        >
          {validating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Validating Coupon...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-6 h-6" />
              <span>CLAIM FOOD COUPON</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
