import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the real client components at the point an API response becomes state.
// This catches crashes that an HTTP-only shell-render test cannot observe.
const require = createRequire(import.meta.resolve('vite/package.json'));
const { buildSync } = require('esbuild');
mkdirSync('.sites-runtime', { recursive: true });
const directory = mkdtempSync(path.resolve('.sites-runtime/merchant-ui-'));
const file = path.join(directory, 'components.mjs');
const bundle = buildSync({
  stdin: { contents: "export {default as MerchantWorkspace} from './app/merchant/workspace'; export {default as NetworkShell} from './app/network-shell';", resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', write: false,
});
writeFileSync(file, bundle.outputFiles[0].text);
const { MerchantWorkspace, NetworkShell } = await import(pathToFileURL(file).href);
test.after(() => rmSync(directory, { recursive: true, force: true }));

test('an existing office without a merchant profile renders onboarding after its API response', () => {
  // This is the exact pre-fix response: tracking/deliveries were absent.
  const html = renderToStaticMarkup(React.createElement(MerchantWorkspace, {
    initialData: { merchant: null, role: 'owner', isAdmin: true, areas: [] },
  }));
  assert.match(html, /Complete your merchant profile/);
  assert.match(html, /name="name"/);
  assert.match(html, /name="email"/);
  assert.match(html, /Save profile/);
  assert.match(html, /href="\/admin\/network"/);
});

test('an approved merchant with an empty fleet and order history renders its working tabs', () => {
  const html = renderToStaticMarkup(React.createElement(MerchantWorkspace, { initialData: {
    merchant: { name: 'Synthetic shop', email: 'shop@example.test', phone: '+254712345678', status: 'active', fleet_mode: 'owned' },
    role: 'owner', isAdmin: false, areas: [], branches: [], deliveries: [], riders: [], integrations: [], staff: [], tracking: [],
    events: [], audits: [], webhookAttempts: [], metrics: { total: 0, completed: 0, active: 0, deliveredFeesMinor: 0 },
    billing: { subscription: 'starter', livePayments: false },
  } }));
  for (const label of ['Profile', 'Deliveries', 'Branches', 'Fleet', 'Integrations', 'Staff', 'Billing', 'Activity'])
    assert.ok(html.includes(label), label);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected="true"/);
});

test('network navigation exposes native links and highlights only the current page', () => {
  for (const activeHref of ['/merchant', '/integrations', '/admin/network']) {
    const html = renderToStaticMarkup(React.createElement(NetworkShell, { title: 'Fixture', description: '', admin: true, activeHref }));
    for (const href of ['/', '/merchant', '/planner', '/rider', '/integrations', '/admin/network'])
      assert.ok(html.includes('href="' + href + '"'), href);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.ok(html.includes('href="' + activeHref + '" class="active" aria-current="page"'));
  }
});
