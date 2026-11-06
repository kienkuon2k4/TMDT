# Kế hoạch phát triển sàn thương mại điện tử

## Trạng thái và giả định

- Đã có giao diện Figma V2 và frontend PC. Backend giai đoạn đầu đã triển khai bằng Node.js + SQLite; xem BACKEND.md.
- Mục tiêu ban đầu: MVP sàn nhiều nhà bán, có website mua sắm, kênh người bán và trang quản trị.
- Vai trò ban đầu: người mua, chủ shop, quản trị viên. Một tài khoản có thể mua hàng và sở hữu shop.
- Tên sàn đã chốt: Chợ PTIT (2026-11-06). Công nghệ: Node.js + SQLite và frontend JavaScript thuần. Thời hạn, dịch vụ thanh toán/vận chuyển và phạm vi triển khai thật cần chốt thêm.
- Giả định để lập kế hoạch: VND, tiếng Việt, một kho mỗi shop, vận chuyển mô phỏng, COD và thanh toán sandbox. Đây chưa phải quyết định triển khai kinh doanh.
- Kiến trúc định hướng: backend chia module, database quan hệ, lưu ảnh riêng; chưa cần microservices.

## Cách thực hiện mỗi module

1. Chốt quy tắc nghiệp vụ và tiêu chí nghiệm thu.
2. Thiết kế dữ liệu, API và màn hình liên quan.
3. Lập trình backend và frontend theo một luồng sử dụng hoàn chỉnh.
4. Kiểm tra quyền, dữ liệu đầu vào, trạng thái lỗi và các tình huống nghiệp vụ quan trọng.
5. Demo, sửa lỗi, cập nhật tài liệu rồi chuyển module.

## Lộ trình và tiêu chí hoàn thành

### M00 — Chốt phạm vi và thiết kế nền tảng
- [ ] Chốt mục tiêu đồ án/kinh doanh, ngành hàng, thương hiệu, nhân lực và thời hạn.
- [ ] Chốt công nghệ, cấu trúc ứng dụng và môi trường phát triển.
- [ ] Lập ma trận quyền, use case và sơ đồ trạng thái.
- [ ] Thiết kế ERD ban đầu và quy tắc tính tiền, giữ tồn, hủy/hoàn.
- [ ] Phác thảo trang chủ, sản phẩm, checkout, kênh shop và admin.
- Hoàn thành khi: phạm vi MVP và các quyết định nền tảng được ghi rõ; không còn mơ hồ về chủ thể sở hữu dữ liệu và luồng đặt hàng.

### M01 — Khởi tạo ứng dụng và hệ thống giao diện
- [x] Khởi tạo frontend, backend, database, cấu hình môi trường và migration.
- [ ] Tạo layout mua sắm, shop, admin; thành phần form, bảng, phân trang và thông báo.
- [x] Tạo mẫu trạng thái đang tải, rỗng, lỗi, không có quyền và không tìm thấy.
- [x] Tạo dữ liệu mẫu tối thiểu và hướng dẫn chạy dự án.
- Hoàn thành khi: ứng dụng chạy từ hướng dẫn trên môi trường sạch, kết nối database và các layout hiển thị tốt trên điện thoại/máy tính.

### M02 — Tài khoản, phiên đăng nhập và phân quyền
- [x] Đăng ký, đăng nhập, đăng xuất, hồ sơ và địa chỉ.
- [ ] Thiết kế quy trình khôi phục mật khẩu theo môi trường email đã chọn.
- [x] Kiểm tra quyền tại backend, giới hạn đăng nhập và thu hồi phiên phù hợp.
- [x] Tạo tài khoản demo cho ba nhóm quyền.
- Hoàn thành khi: người dùng không truy cập được dữ liệu người khác; API quản trị được bảo vệ; kiểm tra được toàn bộ vòng đời phiên.

### M03 — Gian hàng và quản trị người bán
- [x] Gửi đăng ký shop, admin duyệt/từ chối kèm lý do.
- [ ] Quản lý hồ sơ, địa chỉ lấy hàng và trạng thái shop.
- [ ] Áp dụng phạm vi quyền theo shop, nhật ký duyệt và khóa shop.
- Hoàn thành khi: tài khoản được duyệt mở shop và chỉ quản lý shop thuộc quyền; shop bị khóa không tạo hoạt động bán mới nhưng vẫn có quy trình xử lý đơn cũ.

### M04 — Danh mục, sản phẩm, biến thể và kho
- [ ] Admin quản lý danh mục; shop tạo sản phẩm, ảnh, thuộc tính và SKU.
- [x] Tách trạng thái kiểm duyệt và trạng thái bán.
- [ ] Quản lý tồn theo SKU, lịch sử điều chỉnh và cơ chế giữ/giải phóng hàng.
- [x] Admin duyệt/gỡ sản phẩm, lưu lý do.
- Hoàn thành khi: sản phẩm được duyệt xuất hiện công khai; SKU có giá/tồn riêng; thao tác đồng thời không làm tồn có thể bán âm.

### M05 — Khám phá và chi tiết sản phẩm
- [ ] Trang chủ, danh mục, tìm kiếm, lọc, sắp xếp, phân trang.
- [ ] Chi tiết sản phẩm, chọn biến thể và trang shop.
- [ ] Giao diện hết hàng, sản phẩm bị gỡ, không có kết quả.
- Hoàn thành khi: khách tìm được sản phẩm hợp lệ, chọn đúng SKU và xem đúng giá/tồn; dữ liệu chưa duyệt không bị lộ qua API công khai.

### M06 — Giỏ hàng, checkout và tạo đơn nhiều shop
- [ ] Giỏ hàng nhóm theo shop; chọn sản phẩm, đổi số lượng và xóa.
- [ ] Backend kiểm tra lại giá, SKU, trạng thái shop và tồn khi checkout.
- [ ] Tạo nhóm đặt hàng và đơn riêng từng shop; lưu snapshot dòng hàng/địa chỉ.
- [ ] Giữ tồn an toàn, chống gửi đặt hàng lặp và hết hạn giữ hàng.
- [ ] Tính tiền bằng kiểu dữ liệu chính xác, ghi rõ phí từng shop.
- Hoàn thành khi: đặt được giỏ hai shop thành hai đơn; sửa giá trên trình duyệt không ảnh hưởng tiền backend; thử mua SKU cuối đồng thời và nhấn đặt hàng lặp không tạo sai đơn/tồn.

### M07 — Thanh toán, xử lý đơn và vận chuyển
- [ ] COD và cổng thanh toán sandbox được chọn; phân bổ thanh toán theo đơn shop.
- [ ] Xác minh webhook, chống xử lý lặp, xử lý lỗi và đối soát cơ bản.
- [ ] Shop chuẩn bị đơn; bộ mô phỏng vận chuyển gửi sự kiện theo quy tắc.
- [ ] Người mua theo dõi/hủy theo điều kiện; giải phóng tồn đúng lúc.
- [ ] Tách trạng thái đơn, thanh toán, vận chuyển; lưu lịch sử.
- Hoàn thành khi: demo được COD và sandbox từ đặt đến hoàn tất; đóng trình duyệt, webhook lặp/đến muộn, giao thất bại không làm sai tiền hoặc trạng thái.

### M08 — Voucher và phân bổ giảm giá
- [ ] Voucher shop/sàn đơn giản với thời hạn, giá trị tối thiểu và giới hạn lượt.
- [ ] Chốt quy tắc kết hợp, bên tài trợ, phân bổ giảm giá từng dòng.
- [ ] Xử lý giữ/sử dụng/hoàn lượt khi thanh toán hoặc hủy.
- Hoàn thành khi: hai yêu cầu dùng lượt voucher cuối không vượt giới hạn; tổng phân bổ bằng tổng giảm; có dữ liệu tính hoàn một phần chính xác.

### M09 — Hậu mãi, hoàn tiền và đánh giá
- [ ] Yêu cầu trả hàng theo dòng/số lượng, bằng chứng và phản hồi shop.
- [ ] Admin xử lý tranh chấp; hoàn tiền toàn bộ/một phần qua luồng phù hợp.
- [ ] Quản lý hàng hoàn và chỉ nhập lại kho khi có xác nhận.
- [ ] Đánh giá từ dòng hàng đủ điều kiện; báo cáo nội dung vi phạm.
- Hoàn thành khi: hoàn một sản phẩm trong đơn nhiều sản phẩm đúng tiền/giảm giá; không hoàn quá khoản còn được hoàn; không đánh giá đơn người khác.

### M10 — Tài chính, báo cáo và thông báo
- [ ] Sổ ghi nhận tiền, phí sàn, khoản phải trả shop và điều chỉnh hoàn tiền.
- [ ] Báo cáo tách giá trị đơn, tiền đã thu, doanh thu phí và shop thực nhận.
- [ ] Đối soát và mô phỏng thanh toán cho shop; ngăn trả tiền lặp.
- [ ] Thông báo trong web, email theo cấu hình; nhật ký thao tác nhạy cảm.
- Hoàn thành khi: truy vết được từ báo cáo tới giao dịch nguồn; tổng phân bổ/đối soát khớp; đơn đang tranh chấp không giải ngân trái quy tắc.

### M11 — Kiểm thử tích hợp, triển khai và bàn giao
- [ ] Kiểm thử xuyên suốt người mua/shop/admin, quyền ngang và quyền dọc.
- [ ] Kiểm tra responsive, bàn phím, biểu mẫu, lỗi và hiệu năng theo tải mục tiêu đã thống nhất.
- [ ] Rà soát bí mật cấu hình, giới hạn tải tệp, log, backup và phục hồi.
- [ ] Migration, dữ liệu demo, môi trường staging, checklist triển khai/rollback.
- [ ] Tài liệu chạy, tài khoản demo, hướng dẫn sử dụng và kịch bản trình diễn.
- Hoàn thành khi: tiêu chí MVP đạt trên staging, không còn lỗi chặn giao dịch hoặc lỗi truy cập dữ liệu trái quyền; phục hồi backup đã được kiểm tra.

## Các mốc kiểm chứng

1. Sau M03: tài khoản → mở shop → admin duyệt hoạt động được.
2. Sau M05: shop đăng sản phẩm → admin duyệt → khách tìm và xem được.
3. Sau M07: mua nhiều shop → thanh toán → giao hàng → hoàn tất hoạt động xuyên suốt.
4. Sau M10: giảm giá → hủy/trả hàng → hoàn tiền → đối soát có số liệu nhất quán.
5. Sau M11: bản MVP sẵn sàng demo/bàn giao; kinh doanh thật cần chốt thêm yêu cầu vận hành và tích hợp thực tế.

## Ngoài MVP

Chat thời gian thực, livestream, xu/thành viên, flash sale quy mô lớn, quảng cáo, tiếp thị liên kết, gợi ý cá nhân hóa, đa kho, nhiều đơn vị vận chuyển và app di động.

## Theo dõi tiến độ

- Hiện tại: giao diện V2 hoàn thành; backend tài khoản, phiên, phân quyền, hồ sơ/địa chỉ, duyệt shop, sản phẩm/kiểm duyệt và SKU/kho đã nối giao diện. Chưa hoàn thành toàn bộ MVP.
- Bước tiếp theo: hoàn thiện catalog/SKU trên luồng mua và triển khai M06 giỏ hàng/checkout nhiều shop tại server. Email thật, khóa shop, giữ tồn và các tích hợp vận hành còn mở.
- Chưa cam kết lịch theo tuần khi chưa biết nhân lực, thời gian và công nghệ.

## Cập nhật backend giai đoạn 1 — 2026-11-03

- Công nghệ đã chọn cho bản chạy cục bộ: Node.js 24+, SQLite tích hợp, frontend JavaScript thuần. Chưa deploy công khai.
- M02: đã có xác thực/phiên/phân quyền và khôi phục token; email thực và xác minh email chưa cấu hình.
- M03: đã có đăng ký, duyệt/cần bổ sung, hồ sơ shop, phạm vi chủ sở hữu và audit; thao tác khóa shop trên admin còn tiếp tục.
- M04: đã có SKU giá/tồn riêng, transaction điều chỉnh, version chống ghi đè, ảnh và kiểm duyệt. Giữ/giải phóng tồn khi đặt hàng chưa có.
- M05 trở đi: giao diện đã có, dữ liệu giao dịch vẫn minh họa; không đánh dấu hoàn thành backend.
