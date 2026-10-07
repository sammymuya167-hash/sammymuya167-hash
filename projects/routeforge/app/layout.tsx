import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RouteForge — Make every mile count",
  description:
    "Plan smarter delivery routes with vehicle capacity, delivery windows, fleet management, and saved optimization runs. Built by SHADOWNET.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
