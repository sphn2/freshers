"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";
import type { PaymentOrder } from "@/lib/types";
import { CreditCard, ShieldCheck, AlertCircle, Loader2, Ticket, FileText, Info, X, RefreshCw } from "lucide-react";
import RulesModal from "@/components/RulesModal";
import CheckoutProgressLoader from "@/components/CheckoutProgressLoader";

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
  key?: string;
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

interface CashfreeSDK {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
  }) => Promise<{ error?: { message: string }; paymentDetails?: unknown; redirect?: boolean }>;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    Cashfree?: (config: { mode: "sandbox" | "production" }) => CashfreeSDK;
  }
}

let razorpayScriptPromise: Promise<boolean> | null = null;
function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
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

let cashfreeScriptPromise: Promise<boolean> | null = null;
function loadCashfreeScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Cashfree) return Promise.resolve(true);
  if (cashfreeScriptPromise) return cashfreeScriptPromise;

  cashfreeScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => {
      const loaded = Boolean(window.Cashfree);
      if (!loaded) cashfreeScriptPromise = null;
      resolve(loaded);
    };
    script.onerror = () => {
      cashfreeScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return cashfreeScriptPromise;
}

function getRegistrationToken(registrationId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const searchToken = searchParams.get("token") || searchParams.get("access_token");
    if (searchToken) {
      sessionStorage.setItem(`reg_token_${registrationId}`, searchToken);
      localStorage.setItem(`reg_token_${registrationId}`, searchToken);
      return searchToken;
    }

    const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);
    const hashToken = hashParams.get("access_token") || hashParams.get("token");
    if (hashToken) {
      sessionStorage.setItem(`reg_token_${registrationId}`, hashToken);
      localStorage.setItem(`reg_token_${registrationId}`, hashToken);
      return hashToken;
    }

    const sessionToken = sessionStorage.getItem(`reg_token_${registrationId}`);
    if (sessionToken) return sessionToken;

    const localToken = localStorage.getItem(`reg_token_${registrationId}`);
    if (localToken) return localToken;
  } catch {}
  return undefined;
}

export default function PaymentCheckoutPage() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | undefined>();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);

  useEffect(() => {
    async function initCheckout() {
      try {
        const token = getRegistrationToken(registrationId);
        setRegistrationToken(token);

        // Check for return redirect from Cashfree or PhonePe
        if (typeof window !== "undefined") {
          const searchParams = new URLSearchParams(window.location.search);
          const callbackOrderId = searchParams.get("order_id");
          const callbackGateway = searchParams.get("gateway")?.toUpperCase();

          if (callbackOrderId && (callbackGateway === "PHONEPE" || callbackGateway === "CASHFREE")) {
            setProcessing(true);
            try {
              const verifyRes = await api.verifyPayment(
                {
                  registration_id: registrationId,
                  order_id: callbackOrderId,
                  gateway: callbackGateway,
                },
                token,
              );
              if (verifyRes.ticket_id) {
                if (token) {
                  try {
                    sessionStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, token);
                    localStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, token);
                  } catch {}
                }
                const enc = token ? encodeURIComponent(token) : "";
                router.push(
                  `/tickets/${verifyRes.ticket_id}${token ? `?token=${enc}#access_token=${enc}` : ""}`,
                  { scroll: true },
                );
                return;
              }
            } catch (err: unknown) {
              setError(errorMessage(err, `Verifying ${callbackGateway} payment returned an error.`));
            } finally {
              setProcessing(false);
            }
          }
        }

        void loadRazorpayScript();
        void loadCashfreeScript();

        try {
          const data = await api.createPaymentOrder(registrationId, token);
          if (data.already_paid && data.ticket_id) {
            if (token) {
              try {
                sessionStorage.setItem(`ticket_token_${data.ticket_id}`, token);
                localStorage.setItem(`ticket_token_${data.ticket_id}`, token);
              } catch {}
            }
            const enc = token ? encodeURIComponent(token) : "";
            router.push(
              `/tickets/${data.ticket_id}${token ? `?token=${enc}#access_token=${enc}` : ""}`,
              { scroll: true },
            );
            return;
          }
          setOrder(data);
        } catch (err: unknown) {
          setError((prev) => prev || errorMessage(err, "Failed initializing payment order."));
        }
      } catch (err: unknown) {
        setError(errorMessage(err, "Failed initializing payment order."));
      } finally {
        setLoading(false);
      }
    }
    initCheckout();
  }, [registrationId, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [loading]);

  const handleOpenRulesModal = () => {
    if (!order) {
      setError("Payment order is unavailable. Please refresh and try again.");
      return;
    }
    setError(null);
    setShowRulesModal(true);
  };

  const handleProceedToPayment = async () => {
    setShowRulesModal(false);
    setError(null);
    if (!order) return;
    setProcessing(true);

    try {
      const activeGateway = (order.gateway || "RAZORPAY").toUpperCase();

      if (activeGateway === "PHONEPE") {
        if (!order.redirect_url) {
          throw new Error("PhonePe payment URL was not generated. Please retry.");
        }
        window.location.href = order.redirect_url;
        return;
      }

      if (activeGateway === "CASHFREE") {
        const loaded = await loadCashfreeScript();
        if (!loaded || !window.Cashfree) {
          throw new Error("Cashfree SDK failed to load. Please check your internet connection.");
        }
        if (!order.payment_session_id) {
          throw new Error("Cashfree payment session was not generated. Please retry.");
        }
        const cashfree = window.Cashfree({
          mode: order.environment === "production" ? "production" : "sandbox",
        });
        const checkoutResult = await cashfree.checkout({
          paymentSessionId: order.payment_session_id,
          redirectTarget: "_modal",
        });
        if (checkoutResult?.error) {
          const msg = checkoutResult.error.message || "Payment cancelled.";
          if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("closed")) {
            setError(msg);
          }
          return;
        }

        // If modal was completed or payment details returned, verify immediately
        try {
          const verifyRes = await api.verifyPayment(
            {
              registration_id: registrationId,
              order_id: order.order_id,
              gateway: "CASHFREE",
            },
            registrationToken,
          );
          if (verifyRes.ticket_id) {
            if (registrationToken) {
              try {
                sessionStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, registrationToken);
                localStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, registrationToken);
              } catch {}
            }
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            }
            const enc = registrationToken ? encodeURIComponent(registrationToken) : "";
            router.push(
              `/tickets/${verifyRes.ticket_id}${registrationToken ? `?token=${enc}#access_token=${enc}` : ""}`,
              { scroll: true },
            );
            return;
          }
        } catch (err: unknown) {
          setError(errorMessage(err, "Payment could not be verified. If debited, please refresh this page."));
        }
        return;
      }

      // Razorpay
      if (activeGateway === "RAZORPAY") {
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
            description: "Fresher's Party Entry Ticket",
            order_id: order.order_id,
            handler: async function (response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }) {
              try {
                const verifyRes = await api.verifyPayment(
                  {
                    registration_id: registrationId,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    gateway: "RAZORPAY",
                  },
                  registrationToken,
                );

                if (verifyRes.ticket_id) {
                  if (registrationToken) {
                    try {
                      sessionStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, registrationToken);
                      localStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, registrationToken);
                    } catch {}
                  }
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                  }
                  const enc = registrationToken ? encodeURIComponent(registrationToken) : "";
                  router.push(
                    `/tickets/${verifyRes.ticket_id}${registrationToken ? `?token=${enc}#access_token=${enc}` : ""}`,
                    { scroll: true },
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
        return;
      }

      throw new Error(`Unsupported payment gateway: '${activeGateway || "NONE"}'`);
    } catch (err: unknown) {
      const msg = errorMessage(err, "Payment processing failed.");
      if (!msg.includes("cancelled")) {
        setError(msg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const callbackGateway = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("gateway")?.toUpperCase()
    : null;
  const currentGateway = (order?.gateway || callbackGateway || "RAZORPAY").toUpperCase();
  const gatewayName =
    currentGateway === "CASHFREE"
      ? "Cashfree"
      : currentGateway === "PHONEPE"
        ? "PhonePe"
        : currentGateway === "RAZORPAY"
          ? "Razorpay"
          : "Secure Gateway";

  if (loading) {
    return <CheckoutProgressLoader message="Preparing Your Booking & Order..." />;
  }

  const basePrice = order?.ticket_price ?? order?.amount ?? 0;
  const feeAmount = order?.convenience_fee ?? 0;
  const showFeeRow = Boolean(order?.convenience_fee_enabled && feeAmount > 0);

  const handleCheckStatus = async () => {
    setProcessing(true);
    setError(null);
    try {
      const activeGateway = (order?.gateway || "RAZORPAY").toUpperCase();
      if (order?.order_id) {
        const verifyRes = await api.verifyPayment(
          {
            registration_id: registrationId,
            order_id: order.order_id,
            gateway: activeGateway,
          },
          registrationToken,
        );
        if (verifyRes.ticket_id) {
          if (registrationToken) {
            try {
              sessionStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, registrationToken);
              localStorage.setItem(`ticket_token_${verifyRes.ticket_id}`, registrationToken);
            } catch {}
          }
          const enc = registrationToken ? encodeURIComponent(registrationToken) : "";
          router.push(
            `/tickets/${verifyRes.ticket_id}${registrationToken ? `?token=${enc}#access_token=${enc}` : ""}`,
            { scroll: true },
          );
          return;
        }
      }

      // Re-init checkout which triggers backend gateway sync
      const data = await api.createPaymentOrder(registrationId, registrationToken);
      if (data.already_paid && data.ticket_id) {
        if (registrationToken) {
          try {
            sessionStorage.setItem(`ticket_token_${data.ticket_id}`, registrationToken);
            localStorage.setItem(`ticket_token_${data.ticket_id}`, registrationToken);
          } catch {}
        }
        const enc = registrationToken ? encodeURIComponent(registrationToken) : "";
        router.push(
          `/tickets/${data.ticket_id}${registrationToken ? `?token=${enc}#access_token=${enc}` : ""}`,
          { scroll: true },
        );
        return;
      }
      setError("Payment is still awaiting confirmation from your bank or payment gateway. If money was debited, please wait 1-2 minutes and click below to check again.");
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not verify payment yet. If debited, please wait a moment and try again."));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      {processing && <CheckoutProgressLoader isOverlay message="Connecting to Secure Gateway..." />}
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
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          {gatewayName} secure checkout
        </div>

        {error && (
          <div className="space-y-3">
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={processing}
              className="button-secondary w-full !min-h-[44px] text-center flex items-center justify-center gap-2 text-xs font-bold text-amber-900 border border-amber-300 bg-amber-50 hover:bg-amber-100 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${processing ? "animate-spin" : ""}`} />
              <span>Money debited? Click to verify payment & get ticket</span>
            </button>
            {!order && (
              <a
                href="/"
                className="button-primary button-accent w-full !min-h-[44px] text-center flex items-center justify-center gap-2 text-xs"
              >
                Return to Campus Calendar
              </a>
            )}
          </div>
        )}

        {/* Order Details Breakdown */}
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
            <span className="text-slate-500 font-medium">Ticket Price</span>
            <span className="text-slate-900 font-bold">₹{basePrice.toFixed(2)}</span>
          </div>
          {showFeeRow && (
            <div className="flex justify-between items-center border-t border-slate-200 pt-2">
              <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                GST & Convenience Fee
                <button
                  type="button"
                  onClick={() => setShowFeeModal(true)}
                  className="inline-flex items-center justify-center p-0.5 rounded-full text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors"
                  title="Why am I being charged this fee?"
                  aria-label="Why am I being charged this fee?"
                >
                  <Info className="h-4 w-4" />
                </button>
              </span>
              <span className="text-amber-800 font-bold">₹{feeAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500 font-medium">Payment Gateway</span>
            <span className="text-blue-600 font-bold">{gatewayName}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
            <span className="text-slate-900 font-bold">Total amount</span>
            <span className="metric-value text-xl text-amber-700">₹{order?.amount} INR</span>
          </div>
        </div>

        {/* What You Get */}
        <div className="border border-amber-200 bg-amber-50/70 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-yellow-900 font-bold mb-1.5">
            <Ticket className="w-4 h-4 text-yellow-700" />
            <span>Ticket Pass Inclusion & Event Rules:</span>
          </div>
          <ul className="text-xs text-yellow-800 space-y-1 pl-6 list-disc font-medium">
            <li>Official digital event ticket pass</li>
            <li>Opaque QR code for gate scanning</li>
            <li>6-digit manual fallback entry code</li>
            <li>Subject to Sphoorthy Freshers Party Rules & Regulations</li>
          </ul>
        </div>

        {/* View Rules button link */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleOpenRulesModal}
            className="inline-flex items-center gap-1.5 text-xs text-amber-800 font-bold hover:underline"
          >
            <FileText className="h-3.5 w-3.5 text-amber-600" />
            Review Fresher's Party Rules and Regulations
          </button>
        </div>

        {/* Pay Button */}
        <button
          onClick={handleProceedToPayment}
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
              <span>Pay ₹{order?.amount} via {gatewayName}</span>
            </>
          )}
        </button>

        {/* Self-service status check button */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={processing}
            className="inline-flex items-center gap-1.5 text-xs text-amber-900 font-semibold hover:text-amber-950 hover:underline cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${processing ? "animate-spin" : ""}`} />
            <span>Already debited from bank / UPI? Click here to verify and get ticket</span>
          </button>
        </div>

        <p className="text-center text-[10px] leading-5 text-slate-500">
          Payment details are securely processed by {gatewayName}. By completing payment, you agree to our{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-amber-800 underline hover:text-amber-950 font-semibold">
            Terms & Conditions
          </Link>
          {", "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-800 underline hover:text-amber-950 font-semibold">
            Privacy Policy
          </Link>
          {", and "}
          <Link href="/refund-policy" target="_blank" rel="noopener noreferrer" className="text-amber-800 underline hover:text-amber-950 font-semibold">
            Refund Policy
          </Link>
          .
        </p>
      </div>

      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        onConfirm={handleProceedToPayment}
        submitting={processing}
      />

      {/* Fee Explanation Popup Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Info className="h-5 w-5 text-amber-600 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Why am I being charged this fee?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFeeModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-700 font-normal">
              This fee helps cover payment processing charges and applicable taxes associated with securely processing your ticket payment through our payment gateway. It is added to your ticket price to cover these transaction-related costs.
            </p>
            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setShowFeeModal(false)}
                className="button-primary button-accent !min-h-[38px] !px-5 !text-xs"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
  );
}
