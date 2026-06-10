"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast surface (shadcn/new-york over `sonner`). Light-only to match the app
 * theme; tokens come from the shadcn CSS variables so toasts inherit the brand
 * palette. Mount ONE `<Toaster />` high in the tree — calling `toast(...)`
 * anywhere below routes to it.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
