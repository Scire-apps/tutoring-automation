import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN",
  description: "A simple GIF display",
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
