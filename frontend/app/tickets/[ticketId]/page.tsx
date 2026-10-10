"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Printer, RefreshCw, TicketCheck } from "lucide-react";
import { errorMessage } from "@/lib/types";
import type { Ticket as TicketData } from "@/lib/types";

export default function DigitalTicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTicket() {
      try {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const registrationToken = params.get("access_token") || undefined;
        const ticketToken = params.get("ticket_token") || undefined;
        const data = await api.getTicket(ticketId, registrationToken, ticketToken);
        setTicket(data.ticket);
      } catch (err: unknown) {
        setError(errorMessage(err, "Failed loading ticket."));
      } finally {
        setLoading(false);
      }
    }
    loadTicket();
  }, [ticketId]);

  const handleResendEmail = async () => {
    setMessage(null);
    setError(null);
    setResending(true);
    try {
      await api.resendTicket(ticketId);
      setMessage("Digital ticket email resent successfully!");
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed resending email."));
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 font-medium">Loading digital ticket pass...</div>;
  }

  if (error || !ticket) {
    return (
      <div role="alert" className="mx-auto my-12 max-w-md border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-800">
        {error || "Ticket not found."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Success Notification Banner */}
      {message && (
        <div role="status" className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Main Ticket Card */}
      <div className="ticket-pass panel relative overflow-hidden">
        {/* Ticket Header */}
        <div className="relative border-b border-slate-200 bg-[#17221e] p-6 text-center text-white">
          <div className="mx-auto mb-3 w-fit rounded-lg bg-white/95 p-1.5 shadow-md">
            <img src="/college_logo.png" alt="Sphoorthy Engineering College" className="h-8 sm:h-9 w-auto object-contain" />
          </div>
          <div className="flex items-center justify-center gap-2 text-[9px] font-extrabold uppercase tracking-[.2em] text-white/70">
            <TicketCheck className="h-3.5 w-3.5 text-[#e5c86f]" /> Official entry pass
          </div>
          <h1 className="editorial-title mt-2 text-3xl leading-tight">
            {ticket.event_title}
          </h1>
        </div>

        <div className="space-y-6 p-5 md:p-7">
          {/* QR Code Container */}
          <div className="mx-auto flex h-52 w-52 items-center justify-center border border-slate-200 bg-white p-4">
            <QRCodeSVG aria-label="Unique ticket QR code" value={ticket.qr_token || ticket.id} size={176} level="H" />
          </div>

          {/* Prominent 6-Digit Manual Code */}
          <div className="space-y-1 border border-amber-300 bg-amber-50 p-4 text-center">
            <div className="text-[9px] font-extrabold uppercase tracking-[.16em] text-amber-900">
              6-digit manual entry code
            </div>
            <div className="metric-value select-all text-4xl tracking-[.2em] text-amber-950">
              {ticket.ticket_code}
            </div>
            <p className="text-[10px] text-amber-900/80">
              Show this code if the QR scanner is unavailable.
            </p>
          </div>

          {/* Attendee Details Table */}
          <div className="space-y-2.5 border border-slate-200 bg-white p-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Attendee Name</span>
              <span className="text-slate-900 font-bold">{ticket.student_name}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-2">
              <span className="text-slate-500 font-medium">Roll Number</span>
              <span className="text-pink-600 font-mono font-bold">{ticket.roll_number}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-2">
              <span className="text-slate-500 font-medium">Department</span>
              <span className="text-slate-900 font-bold">{ticket.department}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-2">
              <span className="text-slate-500 font-medium">Venue</span>
              <span className="text-slate-800 font-bold truncate max-w-[180px]">{ticket.venue}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-2">
              <span className="text-slate-500 font-medium">Gate Status</span>
              <span
                className={`font-black px-2.5 py-0.5 rounded-md text-[10px] ${
                  ticket.status === "GATE_VALIDATED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {ticket.status === "GATE_VALIDATED" ? "ENTRY VALIDATED" : "ISSUED / UNUSED"}
              </span>
            </div>
            {ticket.food_status && (
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-medium">Food Coupon</span>
                <span
                  className={`font-black px-2.5 py-0.5 rounded-md text-[10px] ${
                    ticket.food_status === "CLAIMED"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {ticket.food_status}
                </span>
              </div>
            )}
            {ticket.issued_by && (
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-medium">Issued By</span>
                <span className="text-slate-900 font-bold">{ticket.issued_by}</span>
              </div>
            )}
          </div>
        </div>

        {/* Resend Email Button */}
        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200 bg-[#f7f4ec] p-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-10 items-center gap-2 border border-slate-300 px-3 text-[10px] font-bold text-slate-700 hover:bg-white"
          >
            <Printer className="h-3.5 w-3.5" /> Print pass
          </button>
          {user && (
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="inline-flex min-h-10 items-center gap-2 px-3 text-[10px] font-bold text-blue-700 hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
              <span>Resend Ticket Pass to Email</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
