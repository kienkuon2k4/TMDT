# Chợ PTIT — web app sàn thương mại điện tử

Ứng dụng PC cho người mua, người bán và quản trị. Tài khoản, giỏ, giao dịch và báo cáo sử dụng API và SQLite; không tạo đơn hoặc tự cấp quyền trong trình duyệt.

## Chạy

Node.js 24 trở lên. Không cần cài package:

```sh
npm run dev
```

Truy cập http://127.0.0.1:4173/. Database tự tạo schema và không tự sinh tài khoản/sản phẩm. Tạo quản trị đầu tiên theo [hướng dẫn vận hành](docs/OPERATIONS.md).

```sh
npm run check
npm test
npm run db:backup
```

## Chức năng

- Đăng ký/đăng nhập, hồ sơ, địa chỉ, đổi mật khẩu, phiên cookie và phân quyền server.
- Đăng ký/bổ sung hồ sơ gian hàng; admin duyệt, khóa/mở shop; người bán chọn shop sở hữu.
- Ngành hàng, sản phẩm, ảnh, SKU giá/tồn riêng, kiểm duyệt và nhật ký thay đổi.
- Tìm/lọc/sắp xếp/phân trang, chọn đúng SKU, giỏ và yêu thích theo tài khoản.
- Quote giá/phí/ưu đãi tại server; checkout COD nhiều shop, snapshot, transaction và idempotency.
- Hủy/hoàn tồn, shop xác nhận/gửi vận đơn, khách xác nhận nhận và thanh toán; lịch sử và thông báo.
- Đánh giá từ dòng mua đã nhận, trả hàng, tranh chấp, nhập lại kho và ghi chứng từ hoàn tiền.
- Ưu đãi shop/sàn, giới hạn lượt; báo cáo thu COD từ đơn đã hoàn thành và khoản hoàn đã ghi nhận.

Thanh toán online, email, chat, API vận chuyển và rút tiền tự động chưa bật. Vận đơn do người bán nhập; COD do người mua xác nhận; hoàn tiền chỉ ghi nhận sau chứng từ, không tự chuyển tiền.

## Tài liệu

- [Đặc tả, use case, ma trận quyền, ERD và trạng thái](docs/SPECIFICATION.md)
- [Cài đặt, tạo admin, sao lưu/khôi phục](docs/OPERATIONS.md)
- [Kiểm thử và kịch bản nghiệm thu](docs/TESTING.md)
- [API và kiến trúc](BACKEND.md)
- [Tiến độ](PLAN.md)

## Mã nguồn

- `server/database.mjs`, `commerce-schema.mjs`: schema, migration v1/v2.
- `server/api.mjs`, `commerce.mjs`: tài khoản, người bán, giỏ/đơn/ưu đãi/hậu mãi.
- `server/security.mjs`, `http.mjs`, `backup.mjs`: phiên, kiểm tra request, HTTP và sao lưu.
- `dist/application.js`, `workspace-ui.js`, `backend-ui.js`, `api-client.js`: giao diện hoạt động.
- `dist/components.js`, `styles.css`, `marketplace.css`, `assets/`: thành phần và tài nguyên giao diện.
- `tests/`: kiểm thử tích hợp với database riêng; fixtures không được dùng khi chạy ứng dụng.

Database `data/market.sqlite` và các bản sao lưu không được phục vụ qua web hoặc đưa vào git. Mã giao diện cũ nằm trong archive, ngoài thư mục public. Dữ liệu đang có được giữ qua migration; dữ liệu giao dịch cũ trong localStorage không được nhập thành đơn server.
