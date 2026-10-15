import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"ShadowSocial — Your people. Your world.",description:"Share your everyday, find your people, and make a little more connection. By SHADOWNET.",icons:{icon:"/favicon.svg"},manifest:"/manifest.webmanifest"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
