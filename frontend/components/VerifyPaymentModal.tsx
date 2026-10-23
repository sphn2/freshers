"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";
import { X, ShieldCheck, Mail, Loader2, CheckCircle2, AlertCircle, RefreshCw, Lock } from "lucide-react";

interface VerifyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRollNumber?: string;
}

export default function VerifyPaymentModal({
  isOpen,
  onClose,
  initialRollNumber = "",
}: VerifyPaymentModalProps) {
  const [rollNumber, setRollNumber] = useState(initialRollNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: "SUCCESS" | "PENDING" | "NOT_FOUND";
    message: string;
    masked_email?: string;
    student_name?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoll = rollNumber.trim().toUpperCase();
    if (!cleanRoll || cleanRoll.length < 4) {
      setError("Please enter a valid student roll number.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.reconcileAndResend(cleanRoll);
      setResult(res);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not verify payment status. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-amber-200/80 space-y-5 animate-scaleUp">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pr-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
            Official Payment Verification
          </div>
          <h2 className="font-serif text-2xl font-extrabold text-slate-900">
            Verify Payment & Resend Ticket Pass
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            If your bank or UPI app debited money, our system will check directly with the payment gateway (Razorpay/Cashfree) and dispatch your entry pass.
          </p>
        </div>

        {/* Security Notice Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
          <Lock className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-800">Security Protected:</strong> Your digital ticket and QR entry code are dispatched <strong>strictly to your registered private email</strong>. No one else can view or steal your event pass.
          </span>
        </div>

        {/* Result: SUCCESS */}
        {result?.status === "SUCCESS" && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Payment Verified & Ticket Emailed!</span>
            </div>
            <p className="text-xs leading-relaxed text-emerald-800">
              {result.student_name ? `Hello ${result.student_name}! ` : ""}
              {result.message}
            </p>
            {result.masked_email && (
              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 flex items-center gap-2 text-xs font-mono font-semibold text-emerald-900">
                <Mail className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Delivered to: <strong>{result.masked_email}</strong></span>
              </div>
            )}
            <p className="text-[11px] text-emerald-700 font-medium">
              Tip: If you do not see it in your Inbox within 1 minute, please check your <strong>Spam / Promotions</strong> folder.
            </p>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="button-primary button-accent w-full !min-h-[40px] text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Result: PENDING or NOT_FOUND */}
        {result && result.status !== "SUCCESS" && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{result.status === "NOT_FOUND" ? "Registration Not Found" : "Awaiting Bank Confirmation"}</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-800">
              {result.message}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-amber-900 font-bold underline hover:text-amber-950 pt-1"
            >
              Try another roll number
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search Input Form (shown if no success result yet) */}
        {result?.status !== "SUCCESS" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="modal-roll" className="block text-xs font-bold text-slate-800">
                Student College Roll Number <span className="text-rose-600">*</span>
              </label>
              <input
                id="modal-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 26N81A6216"
                disabled={loading}
                className="input-text w-full font-mono uppercase font-bold text-sm"
                autoComplete="off"
                required
              />
              <p className="text-[10px] text-slate-500">
                Enter your exact Sphoorthy Engineering College roll number.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !rollNumber.trim()}
              className="button-primary button-accent w-full !min-h-[46px] flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking with Payment Gateway...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Verify Payment & Resend Ticket Pass</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
