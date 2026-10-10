import type { Metadata } from "next";
import "./globals.css";
import { SiteProviderFrame } from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: "Sphoorthy Events — Campus, in session",
  description:
    "The official campus event calendar, registration and entry platform for Sphoorthy Engineering College.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f4f0e7" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <SiteProviderFrame>{children}</SiteProviderFrame>
      </body>
    </html>
  );
}
