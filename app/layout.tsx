import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Sklad",
  description: "Skladový systém",
  manifest: "/manifest.json",
  themeColor: "#111827",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="sk" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}