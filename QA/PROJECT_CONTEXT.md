# PROJECT CONTEXT - DATSANONLINE V2

## 1. TỔNG QUAN HỆ THỐNG
* **Tên dự án**: DatSanOnline (Hệ sinh thái sân cỏ & thể thao trực tuyến tại Đà Nẵng).
* **Môi trường Live**:
  * Frontend: `https://datsan-front-v2.vercel.app` (Vercel)
  * Backend API: `https://datsan-back-v2.onrender.com` (Render Web Service)
  * Database: Supabase PostgreSQL (Shared Cloud Instance)

---

## 2. KIẾN TRÚC KỸ THUẬT (TECH STACK)
* **Frontend**:
  * Framework: React 18 (SPA)
  * Bundler: Vite 8.3
  * Router: React Router DOM v6
  * Styling: Tailwind CSS, Google Fonts (Plus Jakarta Sans)
  * Icons: Lucide React
  * State Management: SessionStorage + React Hooks + Custom Window Event (`datsan_auth_change`)
* **Backend**:
  * Runtime: Node.js (v18+)
  * Framework: Express.js
  * Client CSDL: `@supabase/supabase-js` (Double client: `supabase` cho Anon và `adminSupabase` bằng `SERVICE_ROLE_KEY` cho các tác vụ quản trị)
  * Authentication: Phone SMS/OTP giả lập (`123456`) + Supabase Auth JWT (Access Token + Refresh Token)
* **Database**:
  * PostgreSQL trên nền tảng Supabase.
  * Các bảng chính:
    * `nguoidung`: Lưu thông tin tài khoản, vai trò (`KHACHHANG`, `CHUSAN`, `ADMIN`), số điện thoại, họ tên.
    * `san`: Lưu danh mục 20+ cụm sân thể thao, hình ảnh, giá, mô tả, trạng thái (`HOATDONG`, `CHO_DUYET`, `TU_CHOI`).
    * `loaisan`: Phân loại thể thao (Bóng đá, Cầu lông, Tennis, Pickleball, Bóng rổ, Bóng chuyền, Bóng bàn).
    * `vitri`: Địa chỉ, Phường, Quận, Tỉnh/Thành phố (Đà Nẵng).
    * `khunggio`: 14 ca thi đấu cố định (07:00 - 23:00) theo từng sân.
    * `datsan`: Đơn đặt sân, tổng tiền, ngày sử dụng, trạng thái (`CHO_THI_DAU`, `DA_THANH_TOAN`, `HOAN_THANH`, `HUY`).
    * `datsan_khunggio`: Bảng liên kết nhiều-nhiều giữa đơn đặt sân và khung giờ.
    * `thongbao`: Hệ thống thông báo phân quyền (Broadcast, Admin, Booking, Commission, Reminder).

---

## 3. PHÂN QUYỀN NGƯỜI DÙNG (RBAC)
1. **Khách vãng lai (Guest - Chưa đăng nhập)**:
   * Xem danh sách cụm sân, bộ lọc tìm kiếm theo môn thể thao, quận huyện, ngày giờ.
   * Xem chi tiết sân, ma trận khung giờ real-time và bảng giá.
   * Bấm đặt sân sẽ yêu cầu đăng nhập SĐT & OTP.
2. **Khách hàng (`KHACHHANG`)**:
   * Đặt sân trực tuyến (thanh toán 100% qua QR hoặc Tiền mặt khi đến sân).
   * Xem lịch sử đơn đặt sân tại `/profile`.
   * Gửi hồ sơ đăng ký hợp tác cụm sân mới tại `/register-field`.
   * Nhận thông báo xác nhận đặt sân, trận đấu hoàn tất.
3. **Chủ sân (`CHUSAN`)**:
   * Truy cập Cổng quản lý cụm sân `/owner`.
   * Xem toàn bộ lịch đặt sân theo ngày và theo ca.
   * Xác nhận thu tiền mặt khi khách đến sân.
   * Xem sổ nợ hoa hồng 10% sàn và đối soát nộp hoa hồng qua VietQR MBBank.
4. **Quản trị viên tối cao (`ADMIN`)**:
   * Truy cập Cổng quản trị hệ thống `/admin`.
   * Phê duyệt hồ sơ đăng ký sân mới (`CHO_DUYET` -> `HOATDONG` hoặc `TU_CHOI`).
   * Xem toàn bộ 20 cụm sân, doanh thu sàn (GMV, hoa hồng QR, hoa hồng tiền mặt).
   * Quản lý phân quyền người dùng (Thăng cấp/Hạ cấp vai trò `KHACHHANG` <-> `CHUSAN`).
   * Gửi thông báo nhắc nợ hoa hồng tới chủ sân.
