# KẾ HOẠCH KIỂM THỬ TOÀN DIỆN (TEST PLAN) - DATSANONLINE V2

## 1. MỤC TIÊU KIỂM THỬ (TEST OBJECTIVES)
* Đảm bảo tính toàn vẹn của hệ thống đặt sân thể thao đa người dùng.
* Phát hiện mọi lỗi nghiệp vụ, bảo mật xác thực (Authentication), phân quyền (Authorization).
* Đánh giá khả năng sẵn sàng chạy thực tế trên môi trường Production (Production Readiness).
* Chế độ kiểm thử: **QA AUDIT ONLY – Không tự ý sửa code khi chưa có phê duyệt.**

---

## 2. PHẠM VI KIỂM THỬ (TEST SCOPE)
1. **Module A - Xác thực & Phân quyền (Authentication & Authorization)**:
   * Đăng nhập OTP với các số điện thoại đại diện cho 3 vai trò: Admin, Chủ sân, Khách hàng.
   * Đăng xuất từ các trang công khai (`/`, `/san/:id`) và trang quản trị (`/admin`, `/owner`, `/register-field`, `/profile`).
   * Kiểm tra lỗ hổng Backdoor tự động đăng nhập khi truy cập trực tiếp URL `/admin`.
   * Kiểm tra phân quyền truy cập chéo giữa Khách hàng và Quản trị.
2. **Module B - Nghiệp vụ Đặt Sân (Field Booking & Concurrency)**:
   * Quy trình chọn sân, chọn ngày, chọn ca thi đấu (07:00 - 23:00).
   * Tính toán phí thuê theo ca và dịch vụ đi kèm (Nước uống, áo bib, vợt).
   * Kiểm tra xung đột đặt trùng khung giờ (Race condition / Concurrency locking).
3. **Module C - Thanh toán & Đối soát Hoa hồng (Payment & Commission)**:
   * Thanh toán 100% qua VietQR vs Thanh toán tiền mặt khi đến sân.
   * Tính toán 10% hoa hồng sàn DatSanOnline.
   * Quy trình Chủ sân đối soát nộp hoa hồng qua VietQR MBBank (`0901111111`).
4. **Module D - Quản lý Cụm Sân & Phê duyệt (Field Management)**:
   * Đăng ký cụm sân mới từ giao diện khách hàng/chủ sân (`/register-field`).
   * Quy trình Admin kiểm tra và duyệt hồ sơ sân (`CHO_DUYET` -> `HOATDONG` hoặc `TU_CHOI`).
   * Kiểm tra lỗi hiển thị hồ sơ sân mới trên Admin Dashboard.
5. **Module E - Tìm kiếm, Bộ lọc & Thông báo (Search, Filters & Notifications)**:
   * Tìm kiếm theo tên sân, lọc môn thể thao, quận huyện Đà Nẵng, ngày giờ.
   * Hệ thống thông báo phân quyền (không lộ thông báo hoa hồng admin cho khách).
   * Điều hướng khi click vào thông báo (Notification click routing).

---

## 3. MÔI TRƯỜNG & TÀI KHOẢN TEST
* **Môi trường Live**:
  * Web: `https://datsan-front-v2.vercel.app`
  * API: `https://datsan-back-v2.onrender.com`
* **Dữ liệu tài khoản kiểm thử**:
  * Quản trị viên (Super Admin): `0901111111` (OTP: `123456`)
  * Chủ sân mẫu 1: `0905777888` (OTP: `123456`)
  * Chủ sân mẫu 2: `0905666777` (OTP: `123456`)
  * Khách hàng mẫu: `0905123456` (OTP: `123456`)

---

## 4. TIÊU CHUẨN ĐÁNH GIÁ MỨC ĐỘ LỖI (BUG SEVERITY)
* **CRITICAL**: Lỗ hổng bảo mật nghiêm trọng (như backdoor auto-login), mất dữ liệu, hoặc đặt trùng lịch được xác nhận.
* **HIGH**: Chức năng nghiệp vụ cốt lõi không hoạt động (không thể đặt sân, tính sai tiền, không duyệt được sân).
* **MEDIUM**: Lỗi bộ lọc, điều hướng chưa tối ưu, giao diện responsive bị lệch nhưng không cản trở hoàn toàn luồng nghiệp vụ.
* **LOW**: Lỗi căn chỉnh pixel, chính tả hoặc giao diện phụ.
