import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN",
  description: "6 7, 6+7=13, the 13th letter of the alphabet is m, m is for mango mustard and massive",
  icons: {
    icon: [
      { url: "/favicon.ico", rel: "icon", type: "image/x-icon" },
      { url: "/favicon.ico", rel: "shortcut icon", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
