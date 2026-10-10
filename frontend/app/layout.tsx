import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteProviderFrame } from "@/components/SiteFrame";
import { PwaRegister } from "@/components/PwaRegister";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#17221e",
};

export const metadata: Metadata = {
  title: "Sphoorthy Events — Campus, in session",
  description:
    "The official campus event calendar, registration and entry platform for Sphoorthy Engineering College.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sphoorthy Events",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body suppressHydrationWarning>
        <PwaRegister />
        <SiteProviderFrame>{children}</SiteProviderFrame>
      </body>
    </html>
  );
}
