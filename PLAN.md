# Chợ PTIT — tiến độ web app (2026-11-06)

## Phạm vi đã chốt

Sàn đa ngành nhiều người bán, ưu tiên PC; Node.js 24+, SQLite và frontend JavaScript. VND; checkout và thanh toán COD. Tất cả chức năng hiển thị trong luồng sử dụng phải gọi backend hoặc là nội dung hướng dẫn; không tạo giao dịch hay tự nâng quyền ở client.

## M00 — Phân tích và thiết kế

- [x] Thương hiệu Chợ PTIT, ba vai trò, phạm vi MVP COD.
- [x] Use case, ma trận quyền, ERD, từ điển dữ liệu, sơ đồ trạng thái và checkout trong docs/SPECIFICATION.md.
- [x] Giao diện PC dựa trên Figma, header/footer theo tên mới.
- [ ] Đối chiếu rubric chính thức của học phần, chuẩn báo cáo và thời hạn nghiệm thu.

## M01–M02 — Nền tảng và tài khoản

- [x] HTTP/API/database/migration; ứng dụng không tự nạp tài khoản hoặc giao dịch mẫu.
- [x] Đăng ký, đăng nhập, đăng xuất, cookie phiên, CSRF/Origin, mật khẩu băm, giới hạn đăng nhập.
- [x] Hồ sơ/địa chỉ của từng tài khoản, đổi mật khẩu và thu hồi phiên.
- [x] Tạo admin bằng lệnh của người vận hành; không chọn vai trò để đăng nhập.
- [ ] Nhà cung cấp email, xác minh email và giao diện khôi phục qua email. Chưa bật, không báo gửi thành công giả.

## M03–M04 — Gian hàng, sản phẩm và kho

- [x] Gửi hồ sơ, yêu cầu bổ sung có lý do, gửi lại hồ sơ, admin duyệt và thông báo.
- [x] Hồ sơ shop, địa chỉ lấy hàng, phí giao hàng, chọn shop sở hữu.
- [x] Khóa/mở shop; chặn bán mới khi khóa, tiếp tục xử lý đơn cũ.
- [x] Tạo/đổi tên/xóa ngành hàng với ràng buộc dữ liệu.
- [x] Sản phẩm, ảnh PNG/JPEG, SKU riêng giá/tồn; duyệt/ẩn/gỡ với lý do.
- [x] Điều chỉnh tồn có version/previousStock, ghi audit; SKU đã có đơn được bảo toàn.
- [ ] Album nhiều ảnh, thuộc tính ngành hàng dạng cấu hình riêng, KYC qua nhà cung cấp bên ngoài.

## M05–M06 — Mua hàng và checkout

- [x] Tìm/lọc/sắp xếp/phân trang catalog tại API.
- [x] Chọn đúng SKU; giá và tồn hiển thị theo phân loại.
- [x] Giỏ và yêu thích theo tài khoản, lưu database.
- [x] Quote server kiểm tra SKU, shop, tồn, giá, phí và ưu đãi.
- [x] Giá/phí thay đổi sau quote yêu cầu người mua kiểm tra lại.
- [x] Transaction tạo nhóm/đơn shop/dòng snapshot, trừ tồn có điều kiện, rollback toàn bộ khi lỗi.
- [x] Idempotency, chống đặt lặp và mua vượt tồn khi request đồng thời.
- [x] Hủy đơn hoàn tồn và lượt ưu đãi đúng phạm vi, không xử lý lặp.
- [ ] Giữ tồn có thời hạn cho thanh toán trước. Không cần/bật trong luồng COD hiện tại.

## M07–M08 — COD, vận chuyển và ưu đãi

- [x] Shop xác nhận, chuẩn bị, nhập đơn vị giao và mã vận đơn.
- [x] Người mua xác nhận nhận hàng và thanh toán COD; shop không tự xác nhận tiền khách đã trả.
- [x] Lịch sử trạng thái, thông báo, quyền người mua/shop; shop hủy trước gửi có lý do.
- [x] Mã shop/sàn, mức giảm cố định, ngày hiệu lực, tổng lượt, bật/tắt.
- [x] Phân bổ chính xác từng VND bằng số nguyên/BigInt và kiểm tra lượt mã trong transaction.
- [ ] Cổng thanh toán, webhook, đối chiếu thu tiền và API hãng vận chuyển. Không hiển thị như tính năng đã hoạt động.

## M09–M10 — Hậu mãi, đánh giá và báo cáo

- [x] Đánh giá từ dòng đơn đã nhận, không đánh giá chéo hoặc lặp.
- [x] Trả hàng trong 7 ngày, gắn dòng mua và số tiền sau ưu đãi.
- [x] Shop phản hồi, người mua gửi tranh chấp, admin xử lý; có lịch sử và lý do.
- [x] Nhập lại kho sau xác nhận hàng đủ điều kiện; ghi hoàn tiền sau chứng từ, không lặp.
- [x] Báo cáo thu COD từ đơn hoàn thành và khoản hoàn đã ghi nhận, phân tách theo shop.
- [x] Thông báo trong web, audit các thao tác nghiệp vụ.
- [ ] Trả từng phần số lượng nhiều lần trên cùng một dòng; chứng cứ nhiều tệp.
- [ ] Sổ cái phí/hoa hồng, đối soát và thanh toán tự động cho người bán. Không có nút rút tiền giả.

## M11 — Nghiệm thu và vận hành

- [x] Kiểm thử HTTP/database cho quyền, transaction, concurrency, idempotency, SKU, ưu đãi, hậu mãi và báo cáo.
- [x] Kiểm thử trình duyệt trên database cô lập, không tạo đơn thử vào database ứng dụng.
- [x] Sao lưu SQLite nhất quán; kiểm thử mở lại bản sao có đơn, snapshot, giỏ và tồn.
- [x] Hướng dẫn máy mới, tạo admin, API, ma trận test và kịch bản nghiệm thu.
- [ ] Nghiệm thu thiết bị/bàn phím, tải thực tế, quy trình đối chiếu giao/thu/hoàn tiền.
- [ ] Hosting/domain/TLS, cấu hình lưu ảnh và email, lịch backup và diễn tập khôi phục của đơn vị vận hành.
- [ ] Báo cáo theo mẫu trường, slide bảo vệ và ảnh minh chứng hoàn chỉnh theo rubric.

## Tệp tham chiếu

README.md, BACKEND.md, docs/SPECIFICATION.md, docs/OPERATIONS.md, docs/TESTING.md, server/VERIFICATION.md. Bản kế hoạch trước giao dịch được giữ trong archive/PLAN-before-commerce.md để đối chiếu lịch sử.
