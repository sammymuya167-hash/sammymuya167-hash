import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SprintForge — Build with momentum",
  description:
    "A thoughtful sprint planning workspace with issue dependencies, Kanban, burndown, and private saved projects. Built by SHADOWNET.",
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
