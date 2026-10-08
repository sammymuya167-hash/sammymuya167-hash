import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RouteForge — Main office & live dispatch",
  description:
    "Manage company drivers, partner locations, collections, deliveries and live GPS from one private office workspace. Built by SHADOWNET.",
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
