# Trạng thái triển khai giao diện

- Nguồn: file Figma `OLplY3tysdVlldPDOQEN3u`, trang chủ node `2:446`.
- Frontend đã nằm trong `dist/`; hướng dẫn tại `README.md`.
- Xem thử: `http://127.0.0.1:4173/` và `/#/shop`.
- SVG gốc đã xuất trực tiếp từ node Figma, lưu cục bộ, không dùng URL asset tạm thời.
- Các trang trạng thái Figma được gộp theo thao tác thành trang xác nhận hoặc thông báo.
- `npm run check` và 6 kiểm thử dữ liệu đều qua.
- Đã kiểm tra trình duyệt PC: ảnh gốc, luồng mua hàng, voucher, checkout demo, đơn xuất hiện ở shop, lưu sản phẩm, tìm kiếm không có kết quả.
- Các thẻ thống kê lấy dữ liệu demo; biểu đồ vẫn là minh họa.
- Chưa có backend/phân quyền thật, thanh toán, email hoặc chat ngoài trình duyệt.
- Font Inter qua Google Fonts; nếu mạng không tải được thì dùng Arial. Chưa có font Inter cục bộ.
