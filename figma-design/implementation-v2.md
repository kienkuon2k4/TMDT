# Nếp Market V2 implementation

Figma file: OLplY3tysdVlldPDOQEN3u, index 7:237. Desktop layout uses the existing green/cream tokens and shared Button, ProductInfoCard, form and table helpers.

The active entry is `dist/marketplace.js`, data model `dist/market-store.js`, overrides `dist/marketplace.css`. Original V1 files are retained as references; V1 local storage is not overwritten.

Implemented route families:

- Buyer: home, products, product/:id, shops, store/:id, cart, checkout, confirmation/:groupId, orders, order/:id, tracking/:id, favorites, vouchers, notifications, account, addresses, address/:id, delete-address/:id, password, returns, return-new/:orderId, return/:id, chat/:shopId.
- Authentication and states: login, register, forgot-password, reset-password, verify-email, roles, payment-pending, payment-failed, payment-success, network-error, loading; guarded seller/admin pages and unknown-page fallback.
- Seller onboarding: open-shop, apply-shop, shop-verification, shop-bank, shop-pending, shop-rejected.
- Seller: seller, seller/products, seller/product-new, seller/product/:id, seller/delete/:id, seller/inventory, seller/orders, seller/order/:id, seller/returns, seller/finance, seller/payout, seller/shipping, seller/profile.
- Admin: admin, admin/approvals, admin/moderation, admin/categories, admin/users, admin/disputes, admin/settlements.

Confirmation designs are represented by post-action messages or state pages. Repeated category detail and store designs share data-driven layouts. Product drawings are original Figma SVG exports; no temporary asset URLs are used at runtime.

This is a local frontend prototype. Role selection and ownership checks demonstrate the intended UX, not a server security boundary. Payments, email verification, password reset, identity verification and messaging do not call external services. Financial screens display demo calculations. These require backend implementation before production use.
