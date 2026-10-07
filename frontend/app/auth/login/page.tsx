"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/types";
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

export default function StaffLoginPage() {
  return <Suspense fallback={<div className="panel p-10 text-center text-sm text-slate-600">Preparing secure sign in…</div>}><StaffLoginContent /></Suspense>;
}

function StaffLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const assignedRole = await login(email.trim(), password);
      if (assignedRole === "GATE_STAFF") router.push("/scanner/gate");
      else if (assignedRole === "FOOD_STAFF") router.push("/scanner/food");
      else if (assignedRole === "OFFLINE_COLLECTOR") router.push("/offline");
      else if (assignedRole === "ADMIN" || assignedRole === "EVENT_MANAGER") router.push("/admin");
      else router.push(redirectUrl);
    } catch (reason: unknown) {
      setError(errorMessage(reason, "Sign in failed. Check your credentials and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto grid max-w-4xl overflow-hidden border border-slate-300 bg-[#fbf9f4] shadow-[0_24px_70px_rgba(45,39,25,.11)] md:grid-cols-[.92fr_1.08fr]">
      <aside className="page-hero surface-grid flex min-h-[300px] flex-col justify-between rounded-none p-7 md:min-h-[590px] md:p-9">
        <div className="relative z-10">
          <p className="eyebrow !text-[#e5c86f]">Sphoorthy / campus</p>
          <h1 className="editorial-title mt-8 text-4xl md:text-5xl">A good event<br />takes a good<br /><span className="italic text-[#e2bd55]">crew.</span></h1>
          <p className="mt-5 max-w-xs text-xs leading-6 text-white/70">Your verified account opens the tools assigned to your campus role. Nothing more, nothing less.</p>
        </div>
        <div className="relative z-10 flex items-center gap-3 border-t border-white/20 pt-5 text-[10px] font-bold uppercase tracking-[.13em] text-white/60">
          <ShieldCheck className="h-4 w-4 text-[#e5c86f]" /> College operations · Secure access
        </div>
      </aside>

      <section className="p-7 md:p-10">
        <p className="eyebrow">Welcome back</p>
        <h2 className="editorial-title mt-3 text-3xl">Campus account sign in</h2>
        <p className="mt-2 text-xs leading-5 text-slate-600">Use your assigned campus account credentials to continue.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && <div role="alert" className="border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>}
          <div>
            <label htmlFor="staff-email" className="field-label">Work email</label>
            <input id="staff-email" type="email" required autoComplete="username" autoFocus className="field-control" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@sphoorthy.ac.in" />
          </div>
          <div>
            <label htmlFor="staff-password" className="field-label">Password</label>
            <div className="relative">
              <KeyRound aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="staff-password" type="password" required autoComplete="current-password" className="field-control !pl-10" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your account password" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="button-primary button-accent w-full !min-h-[50px]">
            <LockKeyhole className="h-4 w-4" />{submitting ? "Verifying your account…" : "Sign in securely"}<ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-center text-[10px] leading-5 text-slate-500">Your role is checked by the campus access service after authentication.</p>
        </form>
      </section>
    </main>
  );
}
