"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/types";
import type { Event, ValidationResult } from "@/lib/types";
import {
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
  RotateCcw,
} from "lucide-react";
import { QrCameraScanner } from "@/components/QrCameraScanner";
import { playFeedbackSound } from "@/lib/sound";

export default function GateScannerPage() {
  return (
    <ProtectedRoute allowedRoles={["GATE_STAFF"]}>
      <GateScannerContent />
    </ProtectedRoute>
  );
}

function GateScannerContent() {
  const { role, hasRole } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [gateLocation, setGateLocation] = useState<string>("Gate 1 Main");
  const [eventError, setEventError] = useState<string | null>(null);

  const [inputCode, setInputCode] = useState<string>("");
  const [validating, setValidating] = useState<boolean>(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Flash Validation Options
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sessionAdmitted, setSessionAdmitted] = useState<number>(0);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadEvents() {
      try {
        const isManagerOnly = hasRole(["EVENT_MANAGER"]) && !hasRole(["ADMIN", "SUPER_ADMIN"]);
        const data = isManagerOnly
          ? await api.adminListEvents()
          : await api.getOperationalEvents();
        const availableEvents = data.events.filter(
          (event) => ["PUBLISHED", "LIVE"].includes(event.status) && event.gate_validation_enabled,
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
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    setInputCode("");
    setResult(null);
    setRequestError(null);
  };

  const handleBackspace = () => {
    setInputCode((prev) => prev.slice(0, -1));
  };

  const executeValidation = async (scannedQr?: string) => {
    if (validating || (!scannedQr && !inputCode)) return;
    if (!selectedEventId) {
      setResult({ status: "INVALID_TICKET", message: "No gate-enabled events are available." });
      return;
    }

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    setValidating(true);
    setRequestError(null);
    const startTime = performance.now();

    try {
      const res = await api.validateGate({
        event_id: selectedEventId,
        ...(scannedQr ? { qr_token: scannedQr } : { ticket_code: inputCode.trim() }),
        gate_location: gateLocation,
      });

      const elapsedMs = Math.round(performance.now() - startTime);
      setLastLatencyMs(elapsedMs);
      setResult(res);
      setInputCode("");

      // Instant Audio & Haptic Feedback
      if (res.status === "VALID") {
        setSessionAdmitted((prev) => prev + 1);
        if (soundEnabled) playFeedbackSound("valid");
        if (typeof navigator.vibrate === "function") navigator.vibrate([70, 40, 70]);

        if (autoAdvance) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            setResult(null);
          }, 1400);
        }
      } else if (res.status === "ALREADY_USED") {
        if (soundEnabled) playFeedbackSound("already_used");
        if (typeof navigator.vibrate === "function") navigator.vibrate([240]);

        if (autoAdvance) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            setResult(null);
          }, 3200);
        }
      } else {
        if (soundEnabled) playFeedbackSound("invalid");
        if (typeof navigator.vibrate === "function") navigator.vibrate([120, 60, 120]);

        if (autoAdvance) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            setResult(null);
          }, 3200);
        }
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
          No gate-enabled events are available.
        </div>
      )}
      {requestError && (
        <div role="alert" className="border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          Verification could not be completed: {requestError} This does not confirm that the ticket is invalid. Retry when the scanner is connected.
        </div>
      )}

      {/* Header & Gate Selection */}
      <div className="page-hero flex flex-col justify-between gap-5 p-5 md:flex-row md:items-end md:p-7">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center border border-white/25 bg-white/10 text-[#e5c86f]">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow !text-[#e5c86f]">Entry validation</p>
              <h1 className="editorial-title mt-1 text-3xl">Gate desk</h1>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/80">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-200 border border-emerald-400/30">
              <Zap className="h-3 w-3 text-emerald-400" />
              Admitted: <strong className="text-white text-xs">{sessionAdmitted}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSessionAdmitted(0)}
              title="Reset session admitted counter"
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
            <label className="field-label !text-white/60">Gate</label>
            <select
              value={gateLocation}
              onChange={(e) => setGateLocation(e.target.value)}
              className="field-control"
            >
              <option value="Gate 1 Main">Gate 1 Main</option>
              <option value="Gate 2 East">Gate 2 East</option>
              <option value="Auditorium VIP Gate">VIP Gate</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flash Validation Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoAdvance((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              autoAdvance
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Zap className={`h-3.5 w-3.5 ${autoAdvance ? "text-amber-600 fill-amber-500" : ""}`} />
            {autoAdvance ? "Flash Auto-Advance ON" : "Manual Advance"}
          </button>

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
          Continuous camera scanning active. Point camera at pass for instant validation.
        </p>
      </div>

      {/* Validation Result Display (Flash Notification Banner) */}
      {result && (
        <div
          role="status"
          aria-live="assertive"
          className={`scan-result-flash p-5 rounded-3xl border-2 text-center space-y-2 shadow-lg transition-all animate-in fade-in zoom-in-95 duration-150 ${
            result.status === "VALID"
              ? "bg-emerald-600 text-white border-emerald-700"
              : result.status === "ALREADY_USED"
              ? "bg-amber-500 text-slate-950 border-amber-600"
              : "bg-rose-600 text-white border-rose-700"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {result.status === "VALID" ? (
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            ) : result.status === "ALREADY_USED" ? (
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            ) : (
              <XCircle className="w-8 h-8 animate-pulse" />
            )}
            <h3 className="text-xl font-black tracking-tight uppercase">
              {result.status === "VALID"
                ? "ENTRY ALLOWED — VALID"
                : result.status === "ALREADY_USED"
                ? "ALREADY USED — DENY ENTRY"
                : "INVALID TICKET — DENY ENTRY"}
            </h3>
          </div>

          {result.student_name && (
            <div className="text-sm font-bold pt-1 border-t border-white/20">
              {result.student_name} ({result.roll_number}) — {result.department}
            </div>
          )}

          <div className="text-xs font-mono font-semibold opacity-90">
            Ticket: {result.ticket_code || inputCode || (result.status === "INVALID_TICKET" ? "QR scan" : "")} | Gate: {result.gate_location || gateLocation}
            {lastLatencyMs !== null && ` | Flash: ${lastLatencyMs}ms`}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                setResult(null);
                setInputCode("");
              }}
              className="w-full max-w-sm py-2.5 bg-black/25 hover:bg-black/40 text-white font-black text-xs rounded-xl uppercase tracking-wider shadow-sm border border-white/20 transition-all cursor-pointer"
            >
              {autoAdvance && result.status === "VALID"
                ? "⚡ Auto-advancing (or tap to clear)"
                : "⚡ SCAN NEXT STUDENT"}
            </button>
          </div>
        </div>
      )}

      {/* Keypad & Continuous Camera Scanner */}
      <div className="panel grid min-w-0 grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:p-7">
        <div className="min-w-0 md:col-span-2">
          <QrCameraScanner
            onScan={(decodedText) => void executeValidation(decodedText)}
            scanEnabled={!validating}
            resetTrigger={result ? (result.ticket_code || result.status) : undefined}
          />
          {validating && (
            <div role="status" className="mt-3 flex items-center justify-center gap-2 bg-blue-50 py-2.5 px-3 rounded-xl border border-blue-200 text-xs font-bold text-blue-800">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span>Verifying ticket instantly…</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="eyebrow">Manual check-in</p>
          <h2 className="editorial-title mt-2 text-2xl">Enter the pass code</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">Read the 6-digit number from the student's pass.</p>
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
          onClick={() => void executeValidation()}
          disabled={validating || inputCode.length !== 6}
          className="button-primary button-accent col-span-1 w-full !min-h-[54px] disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
        >
          {validating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Validating Gate Ticket...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-6 h-6" />
              <span>VERIFY GATE ENTRY</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
