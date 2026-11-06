# V2 verification — 2026-11-02

- JavaScript syntax check covers original and V2 entry/data modules.
- 11 Node tests cover both versions, including multi-shop discount allocation, atomic inventory validation, child-order cancellation, and seller scope.
- Browser PC 1440 × 1000: 37 buyer/auth/state/onboarding routes, 10 seller routes, 7 admin routes; no horizontal page overflow or render fallback errors. Buyer route scan found no broken loaded image assets.
- Manually exercised: add products from two shops, apply NEP100, require login before checkout, choose demo buyer role, place COD demo order, see two child orders in buyer list, switch to seller and see only K-Tech order/product, open/save product editor, and review inventory/admin screens.
- Browser console had no captured errors during the checked flow.
- Exact examples used by calculation tests: 1,219,000 + 50,000 − 100,000 = 1,169,000 VND; child totals K-Tech 846,990 and Mộc Wear 322,010 VND. Existing browser test orders created before allocation rounding adjustment retain their original snapshots (1 VND allocation difference; group total unchanged).
- Visual references checked with Figma context/screenshots: home, catalog, product, checkout, buyer returns list, seller overview/editor, admin overview. Repeated routes use their shared layout and dynamic demo data.
- Preview: http://127.0.0.1:4173/ (localhost only). User-facing preview tab left on homepage with buyer demo role.

Not production verification: backend authorization, actual payments/refunds, delivery integrations, identity/email validation and realtime chat are not implemented.
