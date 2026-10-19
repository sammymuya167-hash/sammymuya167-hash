import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ShadowBot · Ideas into conversations",
  description:
    "Build thoughtful AI assistants with your own knowledge. A SHADOWNET project.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
