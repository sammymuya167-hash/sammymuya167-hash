import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanvasRoom — visual collaboration studio",
  description: "Map product flows, review ideas, and restore private board snapshots.",
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
