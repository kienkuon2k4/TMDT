# Verification — Chợ PTIT web app, 2026-11-06

## Automated checks

- `npm run check`: passed for active server/scripts/dist JavaScript.
- `npm test`: 21 passed, 0 failed; only active HTTP/database and commerce tests are counted. Historical prototype tests are outside the active test glob.
- Coverage includes session/password/role/Origin/CSRF, tenant scope, SKU prices, stock/version conflicts, multi-shop snapshots, exact VND allocation, quote-price changes, duplicate checkout, concurrent last-unit and last-voucher requests, cancellation, COD receipt, verified reviews, returns/restock/refund evidence, shop lock, application correction, catalog/category/favorites and backup.
- Backup was reopened and checked for orders, immutable item price, cart row and stock. Temporary cleanup verifies the destination stays in the named test directory.

## Browser checks

Used a separate in-memory database on port 4174 with fixtures loaded only by tests/helpers/serve-ui.mjs. No browser test order was created in the application database on port 4173.

- PC 1440 × 1000: select Oxford M at 499,000 VND, add AirTone at 890,000 VND; the cart retained exact variants/prices after reload.
- Server checkout created two shop orders, 519,000 and 920,000 VND, with 50,000 VND combined shipping. Latest quote-version validation was included.
- Seller K-Tech saw only its own order, prepared it and saved a carrier/tracking reference.
- Buyer confirmed receipt and COD, posted one purchase-backed review. Admin report showed 890,000 VND merchandise and 30,000 VND shipping collected; the other shop's pending order was not counted as collected.
- Checked eight admin pages including shop status, moderation, pending product detail, categories, coupons, returns, audit and reports: no horizontal page overflow, duplicate DOM IDs, or visible demo/placeholder notices. Captured browser error log was empty.
- Opened the actual application at port 4173 after logout from the test server. Homepage loaded with 0 broken images, no horizontal overflow and no demo/illustrative-operation text. Preserved existing application data.

## Evidence

- docs/evidence/cho-ptit-home.jpg — actual application public homepage.
- docs/evidence/multi-shop-orders.jpg — isolated browser test, two orders persisted through API.
- docs/evidence/cod-report.jpg — isolated browser test, totals derived from the completed order.

The isolated UI server is stopped after verification. Only the main localhost application is left running.

## Limits

COD and refund bookkeeping use explicit user/operator confirmation and tracking/payment references; there is no automatic bank transfer, bank webhook or carrier verification. Online payments, email delivery, chat and automated withdrawals are not enabled in the UI. Internet deployment/load acceptance and school-format report/slides remain listed in PLAN.md.
