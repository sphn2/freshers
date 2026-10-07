"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  LogIn,
  LogOut,
  QrCode,
  ShieldCheck,
  Utensils,
} from "lucide-react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <title>Sphoorthy Events — Campus, in session</title>
        <meta
          name="description"
          content="The official campus event calendar, registration and entry platform for Sphoorthy Engineering College."
        />
        <meta name="theme-color" content="#f4f0e7" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <SiteFrame>{children}</SiteFrame>
        </AuthProvider>
      </body>
    </html>
  );
}

function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, logout, hasRole } = useAuth();
  const links = [
    { href: "/", label: "What's on", icon: CalendarDays, visible: true },
    { href: "/scanner/gate", label: "Gate", icon: QrCode, visible: hasRole(["GATE_STAFF", "ADMIN", "EVENT_MANAGER"]) },
    { href: "/scanner/food", label: "Food", icon: Utensils, visible: hasRole(["FOOD_STAFF", "ADMIN", "EVENT_MANAGER"]) },
    { href: "/offline", label: "Cash desk", icon: Banknote, visible: hasRole(["OFFLINE_COLLECTOR", "ADMIN"]) },
    { href: "/admin", label: "Operations", icon: ShieldCheck, visible: hasRole(["ADMIN", "EVENT_MANAGER"]) },
  ].filter((item) => item.visible);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand-lockup no-underline">
            <span className="brand-seal" aria-hidden="true">S</span>
            <span>
              <span className="brand-title block">SPHOORTHY / EVENTS</span>
              <span className="brand-subtitle block">Campus, in session</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="site-nav hidden md:flex">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="site-nav-link"
                data-active={pathname === href}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900">{user.full_name}</p>
                  <p className="mt-0.5 text-[9px] font-extrabold tracking-[.12em] text-slate-500">{role.replaceAll("_", " ")}</p>
                </div>
                <button
                  type="button"
                  aria-label="Sign out"
                  onClick={() => void logout()}
                  className="grid h-9 w-9 place-items-center border border-slate-300 bg-transparent text-slate-700 transition hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link href="/auth/login" className="button-primary !min-h-10 !px-4">
                Staff sign in <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          {!user && (
            <Link href="/auth/login" aria-label="Staff sign in" className="button-primary !min-h-10 !px-3 md:hidden">
              <LogIn className="h-4 w-4" />
            </Link>
          )}
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer flex items-center justify-between gap-4">
        <span>Sphoorthy Engineering College · Official campus events</span>
        <span className="hidden sm:inline">Gather well. Go far.</span>
      </footer>

      {user && (
        <nav aria-label="Staff shortcuts" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-[#fbf9f4]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-around">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 text-center text-[9px] font-bold leading-tight ${pathname === href ? "text-pink-700" : "text-slate-500"}`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
