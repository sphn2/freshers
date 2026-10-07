"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/types";
import type { Event, ValidationResult } from "@/lib/types";
import { Utensils, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { QrCameraScanner } from "@/components/QrCameraScanner";

export default function FoodScannerPage() {
  return (
    <ProtectedRoute allowedRoles={["FOOD_STAFF", "ADMIN", "EVENT_MANAGER"]}>
      <FoodScannerContent />
    </ProtectedRoute>
  );
}

function FoodScannerContent() {
  const { role } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [foodLocation, setFoodLocation] = useState<string>("Counter A (Main)");
  const [eventError, setEventError] = useState<string | null>(null);

  const [inputCode, setInputCode] = useState<string>("");
  const [validating, setValidating] = useState<boolean>(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (!result || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(result.status === "VALID" ? [90, 45, 90] : [220]);
  }, [result]);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = role === "EVENT_MANAGER"
          ? await api.adminListEvents()
          : await api.getOperationalEvents();
        const availableEvents = data.events.filter(
          (event) => ["PUBLISHED", "LIVE"].includes(event.status) && event.food_validation_enabled,
        );
        if (availableEvents.length > 0) {
          setEvents(availableEvents);
          setSelectedEventId(availableEvents[0].id);
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
    setResult(null);

    try {
      const res = await api.validateFood({
        event_id: selectedEventId,
        ...(scannedQr ? { qr_token: scannedQr } : { ticket_code: inputCode.trim() }),
        food_location: foodLocation,
      });

      setResult(res);
      setInputCode("");
    } catch (err: unknown) {
      setResult({
        status: "INVALID_TICKET",
        message: errorMessage(err, "Invalid ticket or entitlement error."),
      });
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
      {/* Header & Counter Selection */}
      <div className="page-hero flex flex-col justify-between gap-5 p-5 md:flex-row md:items-end md:p-7">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center border border-white/25 bg-white/10 text-[#e5c86f]">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow !text-[#e5c86f]">Food entitlement</p>
              <h1 className="editorial-title mt-1 text-3xl">Counter desk</h1>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/65">Confirm every meal coupon once. One ticket, one serving.</p>
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

      {/* Validation Result Display */}
      {result && (
        <div
          role="status"
          aria-live="assertive"
          className={`scan-result-flash p-5 rounded-3xl border-2 text-center space-y-2 shadow-sm ${
            result.status === "VALID"
              ? "bg-blue-600 text-white border-blue-700"
              : result.status === "FOOD_ALREADY_CLAIMED"
              ? "bg-amber-500 text-slate-950 border-amber-600"
              : "bg-rose-600 text-white border-rose-700"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {result.status === "VALID" ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : result.status === "FOOD_ALREADY_CLAIMED" ? (
              <AlertTriangle className="w-8 h-8" />
            ) : (
              <XCircle className="w-8 h-8" />
            )}
            <h3 className="text-xl font-black tracking-tight uppercase">
              {result.status === "VALID"
                ? "FOOD COUPON CLAIMED — SUCCESS"
                : result.status === "FOOD_ALREADY_CLAIMED"
                ? "FOOD COUPON ALREADY CLAIMED"
                : "INVALID TICKET"}
            </h3>
          </div>

          {result.student_name && (
            <div className="text-sm font-bold pt-1 border-t border-white/20">
              {result.student_name} ({result.roll_number}) — {result.department}
            </div>
          )}

          <div className="text-xs font-mono font-semibold opacity-90">
            Ticket: {result.ticket_code || inputCode || (result.status === "INVALID_TICKET" ? "QR scan" : "")} | Counter: {result.food_location || foodLocation}
          </div>

          <button
            onClick={() => setResult(null)}
            className="px-6 py-2.5 bg-black/20 hover:bg-black/30 text-current font-black text-xs rounded-xl uppercase tracking-wider mt-2 transition"
          >
            Scan Next Student
          </button>
        </div>
      )}

      {/* Keypad Scanner */}
      <div className="panel grid min-w-0 grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:p-7">
        <div className="min-w-0 md:col-span-2">
          <QrCameraScanner
            onScan={(decodedText) => void executeFoodValidation(decodedText)}
            scanEnabled={!validating}
          />
          {validating && (
            <p role="status" className="mt-3 bg-blue-50 px-3 py-2 text-center text-xs font-bold text-blue-800">
              Checking food coupon…
            </p>
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
