"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";
import type { PaymentOrder } from "@/lib/types";
import { CreditCard, ShieldCheck, AlertCircle, Loader2, Ticket } from "lucide-react";

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error?: {
    description?: string;
  };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  prefill: { name: string; email: string };
  notes: { registration_id: string };
  theme: { color: string };
  modal: { ondismiss: () => void };
}

interface RazorpayInstance {
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => {
      const loaded = Boolean(window.Razorpay);
      if (!loaded) razorpayScriptPromise = null;
      resolve(loaded);
    };
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

export default function PaymentCheckoutPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | undefined>();

  useEffect(() => {
    async function initCheckout() {
      try {
        const token = new URLSearchParams(window.location.hash.slice(1)).get("access_token") || undefined;
        setRegistrationToken(token);
        void loadRazorpayScript();
        if (token) {
          void api.sendPaymentLinkEmail(registrationId, token).catch((err: unknown) => {
            setEmailError(errorMessage(err, "Payment link email could not be sent."));
          });
        }
        const data = await api.createPaymentOrder(registrationId, token);
        if (data.already_paid && data.ticket_id) {
          router.push(
            `/tickets/${data.ticket_id}${token ? `#access_token=${encodeURIComponent(token)}` : ""}`,
          );
          return;
        }
        setOrder(data);
      } catch (err: unknown) {
        setError(errorMessage(err, "Failed initializing payment order."));
      } finally {
        setLoading(false);
      }
    }
    initCheckout();
  }, [registrationId, router]);

  const handleRazorpayPayment = async () => {
    setError(null);
    if (!order) {
      setError("Payment order is unavailable. Please refresh and try again.");
      return;
    }
    setProcessing(true);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
      }
      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        throw new Error("Razorpay SDK did not initialize. Please refresh and try again.");
      }

      await new Promise<void>((resolve, reject) => {
        const rzpOptions: RazorpayOptions = {
          key: order.key_id,
          amount: Math.round(order.amount * 100),
          currency: order.currency || "INR",
          name: "Sphoorthy Events",
          description: "Event Registration Ticket",
          order_id: order.order_id,
          handler: async function (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) {
            try {
              const verifyRes = await api.verifyPayment({
                registration_id: registrationId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }, registrationToken);

              if (verifyRes.ticket_id) {
                router.push(
                  `/tickets/${verifyRes.ticket_id}${registrationToken ? `#access_token=${encodeURIComponent(registrationToken)}` : ""}`,
                );
                resolve();
              } else {
                reject(new Error("Payment verified but ticket generation failed."));
              }
            } catch (err: unknown) {
              reject(new Error(errorMessage(err, "Server-side payment verification failed.")));
            }
          },
          prefill: {
            name: "",
            email: "",
          },
          notes: {
            registration_id: registrationId,
          },
          theme: {
            color: "#245d4e",
          },
          modal: {
            ondismiss: function () {
              reject(new Error("Payment cancelled by user."));
            },
          },
        };

        const rzp = new Razorpay(rzpOptions);
        rzp.on("payment.failed", function (response) {
          reject(new Error(response.error?.description || "Payment failed."));
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg = errorMessage(err, "Payment processing failed.");
      if (!msg.includes("cancelled")) {
        setError(msg);
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-pink-600" />
        <span>Initializing Razorpay Gateway...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="page-hero surface-grid flex items-end justify-between gap-5 p-6 md:p-8">
        <div className="relative z-10">
          <p className="eyebrow !text-[#e5c86f]">Ticket office · Secure payment</p>
          <h1 className="editorial-title mt-3 text-3xl md:text-4xl">Complete your booking</h1>
          <p className="mt-2 text-xs text-white/65">Your digital entry pass is issued after payment is verified.</p>
        </div>
        <CreditCard className="relative z-10 mb-1 hidden h-8 w-8 text-[#e5c86f] sm:block" aria-hidden="true" />
      </div>

      <div className="panel space-y-5 p-5 md:p-7">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4 text-xs font-bold uppercase tracking-[.1em] text-slate-700">
          <ShieldCheck className="h-4 w-4 text-blue-700" />
          Razorpay secure checkout
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {emailError && (
          <p role="status" className="border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
            {emailError} You can still complete payment here.
          </p>
        )}

        {/* Order Details */}
        <div className="space-y-3 border border-slate-200 bg-white p-4 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Order Reference</span>
            <span className="text-slate-900 font-mono font-bold text-[11px]">{order?.order_id}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500 font-medium">Registration ID</span>
            <span className="text-slate-900 font-mono font-bold text-[11px]">
              {registrationId.slice(0, 8)}...
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500 font-medium">Payment Gateway</span>
            <span className="text-blue-600 font-bold">Razorpay</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
            <span className="text-slate-900 font-bold">Total amount</span>
            <span className="metric-value text-xl text-blue-700">₹{order?.amount} INR</span>
          </div>
        </div>

        {/* What You Get */}
        <div className="border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2 text-xs text-yellow-900 font-bold mb-1.5">
            <Ticket className="w-4 h-4 text-yellow-700" />
            <span>Ticket Pass Inclusion:</span>
          </div>
          <ul className="text-xs text-yellow-800 space-y-1 pl-6 list-disc font-medium">
            <li>Official digital event ticket</li>
            <li>Opaque QR code for gate scanning</li>
            <li>6-digit manual fallback entry code</li>
            <li>Confirmation email with gate instructions</li>
          </ul>
        </div>

        {/* Pay Button */}
        <button
          onClick={handleRazorpayPayment}
          disabled={processing || !order}
          className="button-primary button-accent w-full !min-h-[54px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Payment...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Pay ₹{order?.amount} via Razorpay</span>
            </>
          )}
        </button>

        <p className="text-center text-[10px] leading-5 text-slate-500">
          Payment details are processed by Razorpay. The server verifies the payment signature before issuing a ticket.
        </p>
      </div>
    </div>
  );
}
