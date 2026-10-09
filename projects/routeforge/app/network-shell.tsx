"use client";
/* Native links keep navigation available during hydration and page failures. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { Compass, ArrowUpRight, LayoutDashboard, Store, Truck, Code2, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { SignOut } from './office/sign-out';

export default function NetworkShell({ title, description, children, admin=false, activeHref='/merchant' }: {
  title: string; description: string; children: ReactNode; admin?: boolean; activeHref?: string;
}) {
  const links = [
    { href: '/', label: 'Main office', Icon: LayoutDashboard },
    { href: '/merchant', label: 'Merchant hub', Icon: Store },
    { href: '/planner', label: 'Route planner', Icon: Compass },
    { href: '/rider', label: 'Rider portal', Icon: Truck },
    { href: '/integrations', label: 'API documentation', Icon: Code2 },
    ...(admin ? [{ href: '/admin/network', label: 'Network administration', Icon: ShieldCheck }] : []),
  ];
  return <main className="network-shell bwm-office">
    <aside className="office-sidebar" tabIndex={0} aria-label="Platform navigation panel">
      <a className="brand" href="/"><span className="brand-mark"><Compass size={23}/></span>routeforge<span className="brand-period">.</span></a>
      <span className="tiny-label">SHADOWNET · DELIVERY NETWORK</span>
      <nav aria-label="Platform navigation">{links.map(({ href, label, Icon }) => <a key={href} href={href}
        className={activeHref===href?'active':undefined} aria-current={activeHref===href?'page':undefined}>
        <Icon size={18}/>{label}{href==='/'&&<ArrowUpRight size={14}/>}
      </a>)}</nav>
      <div className="office-sidebar-bottom"><SignOut/><p className="office-note">Connected businesses.<br/>One delivery network.</p></div>
    </aside>
    <section className="network-content"><header className="network-header"><span className="tiny-label">ROUTEFORGE 2.0</span><h1>{title}</h1><p>{description}</p></header>{children}</section>
  </main>;
}
