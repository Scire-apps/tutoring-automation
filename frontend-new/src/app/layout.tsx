import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN SIX SEVEN",
  description: "A simple GIF display",
  icons: {
    icon: [
      { url: "/favicon.png", rel: "icon", type: "image/png" },
      { url: "/favicon.png", rel: "shortcut icon", type: "image/png" },
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
