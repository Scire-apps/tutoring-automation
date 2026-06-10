import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";
import Providers from "./providers";
import SupabaseListener from "./supabase-listener";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// De-branded baseline metadata. The full §8.5 rewrite (metadataBase, title
// template, OG siteName) lands in the admin/landing slice; the dead /favicon.png
// refs are dropped here because the asset was removed in demolition — the
// Scire icon.svg that Next auto-wires arrives with that slice.
export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline.replace(/\.$/, "")}`,
  description: BRAND.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <SupabaseListener />
          {children}
        </Providers>
      </body>
    </html>
  );
}
