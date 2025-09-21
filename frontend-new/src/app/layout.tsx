import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Under Development",
  description: "This site is under development. Please check back soon.",
  icons: {
    icon: [
      { url: "data:image/x-icon;base64,AA==", rel: "icon", type: "image/x-icon" },
      { url: "data:image/png;base64,iVBORw0KGgo=", rel: "shortcut icon", type: "image/png" },
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
