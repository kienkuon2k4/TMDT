# Cài đặt và vận hành Chợ PTIT

## Máy mới

1. Cài Node.js 24 trở lên.
2. Sao chép mã nguồn, mở terminal trong thư mục dự án.
3. Chạy `npm run check`, `npm test`, sau đó `npm run dev`.
4. Truy cập http://127.0.0.1:4173/.

Không cần cài package hoặc SQLite server riêng. Database mới tự tạo schema; không tự tạo tài khoản, gian hàng, sản phẩm, đơn hàng hay ưu đãi. Dữ liệu kiểm thử nằm riêng trong tests/fixtures và không được nạp khi chạy ứng dụng.

## Tạo quản trị đầu tiên

Trong PowerShell, điền email, tên và mật khẩu riêng của người vận hành, rồi chạy:

```powershell
$env:ADMIN_EMAIL = 'email-quan-tri-cua-ban@example.com'
$env:ADMIN_NAME = 'Tên quản trị viên'
$env:ADMIN_PASSWORD = 'mat-khau-rieng-ban-tu-chon'
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

Lệnh không in mật khẩu, không thay mật khẩu hoặc tự nâng quyền tài khoản đã tồn tại. Đăng nhập website với tài khoản vừa tạo, thêm ngành hàng và xét duyệt hồ sơ người bán.

## Cấu hình

| Biến môi trường | Mặc định / công dụng |
|---|---|
| PORT | 4173 |
| APP_ORIGIN | http://127.0.0.1:PORT, phải khớp địa chỉ truy cập |
| DB_PATH | data/market.sqlite |
| NODE_ENV | production yêu cầu APP_ORIGIN HTTPS |
| BACKUP_PATH | Tệp đích khi chạy db:backup, không ghi đè tệp đã tồn tại |

Máy chủ bind 127.0.0.1. Khi vận hành ngoài máy cá nhân cần reverse proxy HTTPS cùng origin, cấu hình host/domain, phân quyền truy cập thư mục dữ liệu và lịch sao lưu. Việc đưa lên Internet không được tự thực hiện bởi bộ mã nguồn.

## Sao lưu và khôi phục

Chạy `npm run db:backup`. SQLite tạo snapshot nhất quán bằng VACUUM INTO; tệp mặc định ở data/backups với tên thời gian và định danh ngẫu nhiên. Không sao chép riêng market.sqlite lúc server còn chạy vì dữ liệu có thể nằm trong WAL.

Để khôi phục: dừng server hoàn toàn, giữ bản sao nguyên bộ database hiện tại để có thể quay lại, đặt bản snapshot ở một đường dẫn mới và cấu hình DB_PATH trỏ tới bản khôi phục. Khởi động server rồi kiểm tra tài khoản, số đơn, dòng hàng, tồn và báo cáo. Giữ bản gốc cho đến khi đối chiếu đạt; không ghi đè hoặc xóa dữ liệu gốc trong lúc thử khôi phục.

## Quy trình khai thác

- Người dùng đăng ký tài khoản thật và địa chỉ của mình.
- Người bán gửi hồ sơ → admin xét duyệt → người bán đăng sản phẩm/SKU → admin duyệt.
- Người mua chọn SKU, đặt COD → shop xác nhận/nhập vận đơn → người mua nhận và thanh toán.
- Báo cáo COD dựa trên xác nhận nhận hàng. Đối chiếu với chứng từ giao/thu tiền của shop ngoài hệ thống.
- Hoàn tiền thực hiện qua quy trình tài chính của người vận hành; chỉ nhập chứng từ vào web app sau khi đã hoàn. Web app không tự chuyển tiền.

## Chức năng chưa bật

Thanh toán online, webhook ngân hàng, API hãng vận chuyển, gửi email, chat và rút tiền tự động chưa có kết nối dịch vụ. Những nút này không xuất hiện trong luồng sử dụng. API quên mật khẩu trả 503 thay vì báo gửi email thành công khi chưa cấu hình nhà cung cấp.

## Dữ liệu cũ

Migration bổ sung bảng giao dịch và giữ dữ liệu đang có. Các giỏ/đơn từng lưu trong trình duyệt không được nhập thành giao dịch server. Bản giao diện cũ ở archive/frontend-prototype, nằm ngoài thư mục public. Không có cơ chế đăng nhập bằng cách tự chọn vai trò.
