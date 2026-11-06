# Chợ PTIT — backend giao dịch

Backend Node.js + SQLite, frontend JavaScript thuần. Dùng phiên cookie HttpOnly/SameSite=Strict, CSRF và Origin cùng website; Secure cookie khi cấu hình HTTPS. Mật khẩu scrypt có salt riêng, token phiên lưu hash, giới hạn thử đăng nhập. Vai trò và chủ sở hữu đọc từ database trên mỗi request.

## API

| Nhóm | Endpoint |
|---|---|
| Khởi động | GET /api/health, GET /api/bootstrap |
| Catalog | GET /api/catalog?q=&category=&min=&max=&sort=&page= (20 sản phẩm/trang) |
| Tài khoản | POST /api/auth/register, /login, /logout, /password; GET/PATCH /api/me |
| Địa chỉ | POST /api/addresses; PUT/PATCH/DELETE /api/addresses/:id |
| Gian hàng | POST /api/applications (id hồ sơ cần bổ sung để gửi lại); PATCH /api/seller/shops/:shopId |
| Sản phẩm | POST /api/seller/shops/:shopId/products; PUT/DELETE /products/:id |
| Kho | PUT /api/seller/shops/:shopId/inventory |
| Giỏ | POST /api/cart/items; PATCH/DELETE /api/cart/items/:skuId |
| Thanh toán COD | POST /api/checkout/quote; POST /api/checkout |
| Đơn mua | POST /api/orders/:id/cancel hoặc /received |
| Shop xử lý đơn | PATCH /api/seller/orders/:id |
| Đánh giá | POST /api/reviews |
| Yêu thích | PUT/DELETE /api/favorites/:productId |
| Thông báo | POST /api/notifications/read |
| Trả hàng | POST /api/returns; PATCH /api/returns/:id |
| Admin | PATCH /api/admin/applications/:id, /products/:id, /shops/:id |
| Ngành hàng | POST /api/admin/categories; PUT/DELETE /api/admin/categories/:name |
| Ưu đãi | POST /api/admin/coupons; PATCH /api/admin/coupons/:code |

Request ghi dùng JSON, Origin đúng APP_ORIGIN và X-CSRF-Token của phiên (đọc từ bootstrap). API trả JSON; lỗi có `{error}` và mã 400/401/403/404/409/413/415/429/503 phù hợp. Sản phẩm chưa duyệt chỉ được trả cho chủ sở hữu hoặc admin.

## Checkout contract

1. POST cart/items với skuId và qty. Client không gửi giá có hiệu lực.
2. POST checkout/quote với couponCode và shopCoupons. Server trả nhóm shop, giá, phí, ưu đãi, tính hợp lệ và `version`.
3. POST checkout với addressId, payment='COD', quoteVersion, couponCode, shopCoupons, notes; header Idempotency-Key riêng cho lần đặt hàng.
4. Server kiểm tra idempotency trong transaction, kiểm tra địa chỉ và quote mới nhất, trừ tồn có điều kiện, ghi snapshot và lượt mã, xóa giỏ, tạo thông báo rồi commit. Mọi lỗi rollback toàn bộ.
5. Retry đúng key/nội dung trả lại nhóm đã tạo. Key dùng cho nội dung khác trả 409. Giá/phí thay đổi sau quote trả 409 để người mua xác nhận lại.

Tiền VND lưu bằng integer. Phân bổ ưu đãi dùng số nguyên và BigInt cho phép nhân/chia, không dùng tiền float để quyết định đơn. Chỉ hỗ trợ COD, không có đơn giữ tồn chờ ngân hàng hoặc tác vụ thanh toán giả.

## Dữ liệu và vận hành

Schema v1 giữ tài khoản/shop/catalog; v2 bổ sung cart, order_groups, orders, order_items, history, coupons/uses, reviews, notifications, favorites, return_requests/history. Migration giữ dữ liệu có sẵn. Ảnh PNG/JPEG tối đa 2 MB, kiểm tra chữ ký và lưu DB cho phiên bản này. Database nằm ngoài dist.

Tồn mỗi SKU không âm. Điều chỉnh kho dùng previousStock, form sản phẩm dùng version; bán/hủy/trả cũng tăng version để ngăn form cũ ghi đè. SKU đã có đơn không thể xóa. Sản phẩm ẩn và shop khóa không được bán mới. Đơn cũ vẫn được xử lý bởi chủ shop.

Báo cáo tổng hợp từ đơn COD được người mua xác nhận và khoản hoàn có chứng từ. Không tự ghi doanh thu từ đơn đang chờ, không có nút rút tiền hoặc chuyển tiền tự động. Trả hàng áp dụng toàn bộ số lượng của một dòng; ghi nhận trả/nhập kho/hoàn chỉ được một lần theo trạng thái.

Xem [đặc tả](docs/SPECIFICATION.md), [vận hành](docs/OPERATIONS.md) và [kiểm thử](docs/TESTING.md). Quên mật khẩu/email, online payment và kết nối hãng giao hàng chưa cấu hình nên không xuất hiện như chức năng đang hoạt động.
