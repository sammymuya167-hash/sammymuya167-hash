# Presenting RouteForge by SHADOWNET to a business

The main product is the existing live platform:
https://routeforge-shadownet.sammymuya167.chatgpt.site

A business uses its own Merchant Hub at `/merchant`. Riders use the current signed RouteForge Rider APK from `/login`; the APK is the rider companion, not the business management dashboard. Platform administration stays with SHADOWNET and must not be shared with a prospective merchant.

## A practical meeting

1. Introduce the problem: a business can request a delivery manually or connect its ordering system, then track collection and delivery in one place.
2. Show the company dashboard, branch pickup addresses and three fleet choices: owned riders, the shared network, or owned riders with explicitly accepted shared-fleet fallback.
3. Demonstrate a permitted pilot using an isolated merchant account, a real pickup branch and an approved service area. Choose real prices with the business; do not invent a commercial tariff.
4. Create a request with the recipient name, telephone number and precise delivery entrance. Mark it ready only when the parcel can actually be collected.
5. Show an eligible test rider accepting the exclusive offer, collection, customer tracking and OTP delivery confirmation. Label any local/sandbox demonstration clearly.
6. Show delivery status callbacks to the business's custom website. The universal API is available; Shopify/WooCommerce native connectors are still planned and must not be sold as connected.
7. Offer a limited operational pilot: agree on locations, package sizes, fleet responsibility, delivery charges, support and success criteria before a wider rollout.

## What to give the business

- The main platform URL and its own merchant account/login after onboarding and approval.
- The integration guide at `/integrations` for its developer if it has an ordering system.
- The latest rider download from `/login` only for the people who will perform deliveries.
- A written pilot proposal specifying the real service area, prices, responsibilities and support contact.

## Confirm before demonstrating live operations

A shared rider must be approved, online, free, in the right service area and have a suitable vehicle. Shared-fleet and hybrid fallback pricing must be explicitly accepted. A registered merchant is not automatically approved for dispatch. Accurate recipient coordinates are required by the universal API; store-specific address conversion is not yet a native connector.

Offline journeys are recorded on the rider's phone while duty/location sharing is enabled and sync after connectivity returns. Uploaded history remains private to the authorized company. An offline rider cannot receive a new live offer until connected. Force-stop, a switched-off phone or missing GPS cannot generate real movement records retrospectively.

M-Pesa transactions, subscription charging and payouts remain disabled. Office cash/till reports are recorded claims for office review, not verified bank transactions. End-to-end production fulfillment needs authorized existing office/rider credentials and a real phone test before claiming field acceptance.
