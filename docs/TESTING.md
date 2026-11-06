# Kiểm thử và kịch bản nghiệm thu

## Lệnh

`npm run check` kiểm tra cú pháp mã nguồn hoạt động. `npm test` chạy kiểm thử HTTP/database bằng Node test runner. Mỗi fixture có database và cổng localhost riêng. Không tạo đơn kiểm thử vào data/market.sqlite và không gọi ngân hàng/hãng vận chuyển bên ngoài.

## Ma trận kiểm tra tự động

| Mã | Kiểm tra | Kết quả bắt buộc |
|---|---|---|
| AUTH01 | Sai mật khẩu, đăng xuất, phiên hết hiệu lực | Không truy cập tài khoản |
| AUTH02 | Tự gửi role=admin, gọi API admin bằng buyer | Bị từ chối, không nâng quyền |
| AUTH03 | Origin khác / CSRF sai | Bị từ chối trước khi ghi |
| OWN01 | Sửa địa chỉ, sản phẩm, SKU shop khác | Không đọc/ghi chéo |
| SKU01 | SKU có giá khác nhau | Giá/variant trong cart và đơn đúng SKU |
| SKU02 | Tồn âm, form tồn/version cũ | Bị từ chối, không ghi đè |
| CART01 | Giỏ hai tài khoản | Tách biệt, dữ liệu lưu server |
| ORDER01 | Giỏ hai shop | Tạo một nhóm, hai đơn con và snapshot |
| ORDER02 | Sửa giá/tổng tiền trên client | Server tính độc lập |
| ORDER03 | Giá tăng sau xem quote | 409, không tạo đơn hoặc trừ tồn |
| ORDER04 | Hai người mua SKU cuối | Chỉ một thành công, tồn không âm |
| ORDER05 | Gửi lặp / gửi đồng thời cùng key | Một nhóm đơn, trừ tồn một lần |
| ORDER06 | Một dòng/shop không hợp lệ | Rollback toàn bộ checkout |
| CANCEL01 | Hủy một đơn shop, hủy lặp | Hoàn đúng tồn một lần |
| COD01 | Shop chuẩn bị/gửi, khách nhận | Lịch sử và COD cập nhật đúng vai trò |
| COD02 | Shop tự hoàn thành / hủy không lý do | Bị từ chối |
| REVIEW01 | Chưa nhận, đơn người khác, đánh giá lặp | Bị từ chối |
| PROMO01 | Mã cuối cùng bị dùng đồng thời | Không vượt hạn mức |
| PROMO02 | Hủy một phần/toàn bộ nhóm | Lượt mã hoàn theo đúng phạm vi |
| MONEY01 | Phân bổ giảm giá số lớn | Tổng từng dòng khớp từng VND |
| RETURN01 | Trả, nhập lại kho, ghi chứng từ hoàn | Đúng trạng thái, không thao tác lặp |
| ADMIN01 | Khóa shop, sửa ngành hàng đang dùng | Kiểm tra trạng thái/ràng buộc |
| BACKUP01 | Backup rồi mở lại | Đơn, snapshot, giỏ, tồn còn đúng |

## Kịch bản nghiệm thu trên website

1. Quản trị tạo ngành hàng. Hai tài khoản người bán đăng ký hai shop và được duyệt.
2. Mỗi shop đăng sản phẩm. Một sản phẩm có hai SKU khác giá/tồn. Admin duyệt.
3. Người mua chọn SKU thứ hai, kiểm tra giá đổi, thêm sản phẩm hai shop vào giỏ. Tải lại trang, giỏ vẫn còn.
4. Tạo địa chỉ, áp dụng ưu đãi hợp lệ nếu có, đặt COD. Lưu mã nhóm và hai mã đơn con.
5. Đổi tên/giá sản phẩm sau đặt, xác nhận đơn cũ giữ snapshot giá/tên.
6. Người bán mỗi shop chỉ thấy và xử lý đơn thuộc shop mình. Một đơn hủy trước xác nhận để kiểm tra hoàn tồn; đơn còn lại chuẩn bị và gửi với vận đơn.
7. Người mua xác nhận nhận hàng, gửi đánh giá. Người khác không thể đánh giá dòng hàng đó.
8. Đối chiếu báo cáo với đơn hoàn thành. Yêu cầu trả hàng, kiểm tra nhập lại kho và chỉ ghi hoàn sau chứng từ tài chính.
9. Sao lưu, chạy lại trên bản khôi phục riêng và đối chiếu số liệu.

## Phạm vi kiểm chứng

Kiểm thử mã nguồn chứng minh quy tắc của ứng dụng và các request HTTP. Cần nghiệm thu với dữ liệu vận hành, kiểm tra tải, bàn phím/thiết bị, phân quyền thư mục và quy trình tài chính trước khi triển khai ngoài máy cá nhân. Tích hợp ngân hàng, hãng vận chuyển và gửi email chưa được kiểm thử vì chưa được bật.
