import type { Metadata } from "next";
import { Hanken_Grotesk, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import SupabaseListener from "./supabase-listener";
import { BRAND } from "@/lib/brand";

// Body / UI face — a clean geometric grotesque with excellent small-size
// legibility and tabular figures for the data-dense panels.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

// Display face — confident, tightly-tracked headlines. Distinct from the body
// so titles carry weight without shouting.
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Scire — Peer tutoring, organized",
    template: "%s · Scire",
  },
  description: BRAND.description,
  openGraph: {
    siteName: "Scire",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${hanken.variable} ${schibsted.variable} antialiased`}>
        <Providers>
          <SupabaseListener />
          {children}
        </Providers>
      </body>
    </html>
  );
}
