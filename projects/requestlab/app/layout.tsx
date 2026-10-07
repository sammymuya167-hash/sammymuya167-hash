import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RequestLab — Know what your API is saying",
  description:
    "Send requests, inspect responses, and test API contracts with collections, environments, and a live sandbox. Built by SHADOWNET.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
