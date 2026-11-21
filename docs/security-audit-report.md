# BÁO CÁO KIỂM THỬ BẢO MẬT & PHÂN QUYỀN TOÀN DIỆN (SECURITY AUDIT REPORT)
**Dự án:** DatSanOnline (Hệ thống Đặt sân thể thao trực tuyến)  
**Phạm vi:** Authentication, Role-Based Access Control (RBAC), Backend API Authorization, Resource Ownership (IDOR), Frontend Route Protection, Input Validation  
**Môi trường kiểm thử:** Local Staging Testbed (`localhost:5173` & `localhost:5000`) & Supabase Cloud PostgreSQL  
**Ngày thực hiện:** 21/11/2026  
**Chế độ thực thi:** Audit Only & Verified Automated Test Suite  

---

## 1. Executive Summary (Tóm tắt điều hành)

Hệ thống **DatSanOnline** đã trải qua quá trình kiểm thử bảo mật độc lập toàn diện gồm **44 kịch bản kiểm thử** (29 kiểm thử tự động tầng API/Backend/Database và 15 kiểm thử giao diện End-to-End bằng Browser Automation).

### Phân bố mức độ nghiêm trọng:
| Mức độ nghiêm trọng | Số lượng phát hiện | Tình trạng |
| :--- | :---: | :--- |
| **Critical (Khẩn cấp)** | **0** | Không phát hiện lỗ hổng cho phép bypass authentication hoặc chiếm quyền Admin |
| **High (Cao)** | **0** | Không có lỗ hổng IDOR làm rò rỉ dữ liệu tài chính hoặc thanh toán chéo |
| **Medium (Trung bình)** | **0** | Không có lỗ hổng can thiệp trái phép vào database thông qua API |
| **Low / Informational (Thấp / Kiến trúc)** | **1** | Cơ chế tự động khởi tạo tài khoản khi nhập SĐT mới (Passwordless Auto-provisioning) |

### Điểm nổi bật về kiến trúc an ninh đã đạt được:
1. **Kiến trúc phòng thủ đa lớp (Defense-in-Depth):**
   - **Tầng Frontend:** Toàn bộ route nhạy cảm (`/admin`, `/admin/*`, `/owner`, `/owner/*`) được bảo vệ bằng component `ProtectedInternalRoute`. Người dùng chưa đăng nhập hoặc sai vai trò khi truy cập trực tiếp sẽ nhận được trang **404 Trung tính (E-commerce Style)**. Giao diện hoàn toàn không rò rỉ layout dashboard, số liệu thống kê, tên cụm sân hay bất kỳ thông báo lỗi kỹ thuật nào.
   - **Tầng Backend:** Toàn bộ API nghiệp vụ nhạy cảm (`/api/admin/*`, `/api/owner/*`, `/api/data`) đều xác thực token qua `getAuthenticatedProfile()`. Khi token không có, backend trả về `HTTP 401 Unauthorized`. Khi token hợp lệ nhưng sai quyền, backend trả về `HTTP 403 Forbidden`.
2. **Kiểm soát quyền sở hữu tài nguyên (Anti-IDOR):**
   - Chủ sân A không thể xem, sửa hoặc quyết toán lịch đặt sân của Chủ sân B (`POST /api/owner/settle-booking` xác minh chặt chẽ `masan` thuộc quyền sở hữu của `manguoidung`).
   - Khách hàng không thể truy vấn hoặc cập nhật hồ sơ người dùng khác qua gateway `/api/data`.
3. **Loại bỏ hoàn toàn cửa sau (Backdoor Removal):**
   - Đã loại bỏ hoàn toàn cơ chế tự động mạo danh tài khoản Admin khi truy cập `/admin` ở các phiên bản cũ.

---

## 2. Ma trận kiểm thử chi tiết (Test Matrix)

### Bảng A: Automated Backend & API Security Tests (29 kịch bản)

| Mã Test | Phân hệ | Vai trò thực hiện | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái | Ghi chú & Bằng chứng |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **SEC-A01** | Auth | Khách / Admin | Đăng nhập hợp lệ trả về HTTP 200 + JWT | HTTP 200, cấp access_token | **PASS** | Đăng nhập SĐT `+84901111111` OTP `123456` |
| **SEC-A02** | Auth | Khách | Đăng nhập SĐT chưa tồn tại | Hệ thống tự khởi tạo tài khoản KHACHHANG | **PASS (Info)** | Khởi tạo tài khoản mật khẩu dùng một lần |
| **SEC-A03** | Auth | Khách | Đăng nhập với OTP sai (000000) | HTTP 400 hoặc 401 | HTTP 401 | Từ chối truy cập chính xác |
| **SEC-A04** | Auth | Chưa xác thực | Gọi `/api/admin/overview` không token | HTTP 401 | HTTP 401 | Chặn truy cập không xác thực |
| **SEC-A05** | Auth | Chưa xác thực | Gọi API với Token sai định dạng | HTTP 401 | HTTP 401 | Chặn token rác |
| **SEC-A06** | Auth | Chưa xác thực | Gọi API với Token bị sửa chữ ký (tampered) | HTTP 401 | HTTP 401 | Chặn token giả mạo chữ ký |
| **SEC-A07** | Auth | Tất cả | Phản hồi auth không chứa key nhạy cảm | Không có `service_role` hay password hash | **PASS** | Không rò rỉ bí mật server trong response |
| **SEC-B01** | RBAC | KHACHHANG | Truy cập `GET /api/admin/overview` | HTTP 403 Forbidden | HTTP 403 | Khách không thể xem thống kê Admin |
| **SEC-B02** | RBAC | CHUSAN | Truy cập `GET /api/admin/overview` | HTTP 403 Forbidden | HTTP 403 | Chủ sân không thể xem thống kê Admin |
| **SEC-B03** | RBAC | ADMIN | Truy cập `GET /api/admin/overview` | HTTP 200 OK | HTTP 200 | Admin xem toàn bộ dữ liệu quản trị |
| **SEC-B04** | RBAC | KHACHHANG | Duyệt trạng thái sân `/api/admin/fields/:id/status` | HTTP 403 Forbidden | HTTP 403 | Khách không thể duyệt sân |
| **SEC-B05** | RBAC | CHUSAN | Duyệt trạng thái sân `/api/admin/fields/:id/status` | HTTP 403 Forbidden | HTTP 403 | Chủ sân không thể tự duyệt sân |
| **SEC-B06** | RBAC | KHACHHANG | Nâng quyền user `POST /api/admin/users/:id/role` | HTTP 403 Forbidden | HTTP 403 | Khách không thể nâng quyền bản thân |
| **SEC-B07** | RBAC | CHUSAN | Nâng quyền user `POST /api/admin/users/:id/role` | HTTP 403 Forbidden | HTTP 403 | Chủ sân không thể nâng quyền |
| **SEC-C01** | API Auth | Chưa xác thực | Truy cập `GET /api/owner/overview` | HTTP 401 Unauthorized | HTTP 401 | Chặn truy cập chưa đăng nhập |
| **SEC-C02** | API Auth | KHACHHANG | Truy cập `GET /api/owner/overview` | HTTP 403 Forbidden | HTTP 403 | Khách hàng không thể vào API chủ sân |
| **SEC-C03** | API Auth | CHUSAN A | Truy cập `GET /api/owner/overview` | HTTP 200, chỉ trả về sân của Chủ sân A (Sân 33) | HTTP 200 (Count: 1, Sân 33) | **PASS** | Dữ liệu cô lập theo đúng chủ sở hữu |
| **SEC-D01** | IDOR | CHUSAN A | Quyết toán đơn đặt sân của Chủ sân B | HTTP 403 Forbidden | HTTP 403 ("You do not own pitch") | **PASS** | Ngăn chặn leo quyền ngang giữa các chủ sân |
| **SEC-D02** | IDOR | KHACHHANG A | Truy vấn toàn bộ người dùng qua `/api/data` | HTTP 403 Forbidden | HTTP 403 | Chặn rò rỉ danh sách khách hàng toàn sàn |
| **SEC-D03** | IDOR | KHACHHANG A | Truy vấn thông tin người dùng khác (ID 25) | HTTP 403 Forbidden | HTTP 403 | Chặn xem trộm hồ sơ người khác |
| **SEC-D04** | IDOR | KHACHHANG A | Truy vấn thông tin của chính mình (ID 17) | HTTP 200 OK | HTTP 200 | Cho phép xem hồ sơ cá nhân |
| **SEC-D05** | IDOR | KHACHHANG A | Truy vấn toàn bộ đơn đặt sân sàn qua `/api/data` | HTTP 403 Forbidden | HTTP 403 | Chặn lộ lịch sử đặt sân toàn hệ thống |
| **SEC-D06** | IDOR | KHACHHANG A | Cập nhật trạng thái sân (`san`) qua `/api/data` | HTTP 403 Forbidden | HTTP 403 | Chặn thay đổi trạng thái sân trái phép |
| **SEC-D07** | IDOR | KHACHHANG A | Cập nhật vai trò lên ADMIN qua `/api/data` | HTTP 403 Forbidden | HTTP 403 | Chặn thay đổi quyền qua bảng nguoidung |
| **SEC-E01** | Validation | ADMIN | Truy vấn bảng hệ thống `information_schema` | HTTP 400 Bad Request | HTTP 400 | Chặn SQL injection / Schema enumeration |
| **SEC-E02** | Business | KHACHHANG A | Tạo đơn đặt sân trực tiếp bỏ qua luồng atomic | HTTP 403 Forbidden | HTTP 403 ("Must use atomic endpoint") | **PASS** | Bắt buộc kiểm tra trùng giờ qua transaction |
| **SEC-E03** | Validation | ADMIN | Cập nhật vai trò với tên không hợp lệ | HTTP 400 Bad Request | HTTP 400 | Ràng buộc Whitelist vai trò |
| **SEC-E04** | Validation | ADMIN | Cập nhật trạng thái sân với giá trị không hợp lệ | HTTP 400 Bad Request | HTTP 400 | Ràng buộc Whitelist trạng thái sân |
| **SEC-E05** | Business | CHUSAN A | Gửi action giả mạo tới `/api/owner/settle-booking` | HTTP 400 Bad Request | HTTP 400 | Ràng buộc Whitelist hành động quyết toán |

---

### Bảng B: Frontend Route Protection & UI E2E Tests (15 kịch bản)

| Mã Test | Kịch bản kiểm thử | Người dùng | Kết quả kỳ vọng | Kết quả thực tế | Trạng thái | Bằng chứng hình ảnh |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC01** | Truy cập trực tiếp `/admin` | Khách (Guest) | Hiển thị 404 trung tính, không render Dashboard | Hiển thị 404 chuẩn, không lộ dữ liệu | **PASS** | `tc01_guest_admin_404.png` |
| **TC02** | Truy cập trực tiếp `/owner` | Khách (Guest) | Hiển thị 404 trung tính, không render Dashboard | Hiển thị 404 chuẩn, không lộ dữ liệu | **PASS** | `tc02_guest_owner_404.png` |
| **TC03** | Truy cập route con `/admin/users` | Khách (Guest) | Hiển thị 404 trung tính | Hiển thị 404 chuẩn | **PASS** | `tc03_guest_admin_users_404.png` |
| **TC04** | Truy cập route con `/owner/bookings`| Khách (Guest) | Hiển thị 404 trung tính | Hiển thị 404 chuẩn | **PASS** | `tc04_guest_owner_bookings_404.png` |
| **TC05** | Truy cập `/admin` | Khách hàng | Hiển thị 404 trung tính | Hiển thị 404 chuẩn | **PASS** | `tc05_customer_admin_404.png` |
| **TC06** | Truy cập `/owner` | Khách hàng | Hiển thị 404 trung tính | Hiển thị 404 chuẩn | **PASS** | `tc06_customer_owner_404.png` |
| **TC07** | Truy cập `/admin` | Chủ sân | Hiển thị 404 trung tính | Hiển thị 404 chuẩn | **PASS** | `tc07_owner_admin_404.png` |
| **TC08** | Truy cập `/owner` | Chủ sân | Render Dashboard Chủ sân đầy đủ | Hiển thị số liệu, KPI, lịch đặt sân | **PASS** | `tc08_owner_dashboard_active.png` |
| **TC09** | Truy cập `/admin` | Super Admin | Render Dashboard Quản trị đầy đủ | Hiển thị bảng điều khiển, duyệt sân | **PASS** | `tc09_admin_dashboard_active.png` |
| **TC10** | Truy cập URL ngẫu nhiên (`/random-xyz`)| Mọi vai trò | Hiển thị trang 404 trung tính | Hiển thị 404 chuẩn | **PASS** | `tc10_random_route_404.png` |
| **TC11** | F5 / Reload lại trang `/owner` | Chủ sân | Duy trì phiên làm việc, không bị 404 | Dashboard tải lại bình thường | **PASS** | `tc11_owner_refresh_dashboard.png` |
| **TC12** | Gọi API quản trị không Token | Bất kỳ ai | HTTP 401 Unauthorized | HTTP 401 | **PASS** | Được bảo vệ bởi Middleware |
| **TC13** | Gọi API quản trị sai Role | Khách / Chủ sân | HTTP 403 Forbidden | HTTP 403 | **PASS** | Được bảo vệ bởi Middleware |
| **TC14** | Đăng xuất tại trang Admin | Super Admin | Header chuyển về Guest, giao diện thành 404 ngay | Chuyển ngay thành 404, không lưu vết | **PASS** | `tc14_logout_admin_404.png` |
| **TC15** | Bấm nút Back sau khi đăng xuất | Guest | Không hiển thị lại dữ liệu trang Admin cũ | Giữ nguyên 404, không FOUC | **PASS** | `tc15_back_button_post_logout_404.png` |

---

## 3. Phân tích chi tiết các vấn đề & Điểm kiến trúc (Findings & Insights)

### Phát hiện #1: Trải nghiệm người dùng đối với trang bảo vệ (Hình ảnh phản ánh từ người dùng)
- **Hiện tượng:** Khi người dùng truy cập link `/admin?tab=PENDING_FIELDS` trên môi trường Vercel production cũ, màn hình xuất hiện một hộp thông báo:
  > *"Yêu cầu đăng nhập - Vui lòng đăng nhập với tài khoản Quản Trị Viên (Admin) để tiếp tục truy cập và thao tác tại trang này."*
- **Nguyên nhân:** Trên bản build cũ đang chạy ở Vercel (commit `ac019da`), component `RoleRoute` chặn các route bảo vệ bằng một Card cảnh báo màu trắng ở giữa màn hình. Điều này khiến khách vãng lai biết chắc chắn đường dẫn `/admin` tồn tại và là cổng nội bộ, đồng thời gây trải nghiệm khó chịu cho người dùng.
- **Biện pháp đã xử lý triệt để trên mã nguồn mới:**
  1. Loại bỏ hoàn toàn component cảnh báo và các thẻ thông báo đăng nhập thừa thãi.
  2. Áp dụng chuẩn **Neutral 404 (Thương mại điện tử)** thông qua component `ProtectedInternalRoute` và `NotFound.jsx`. Khi khách chưa đăng nhập hoặc không đủ quyền truy cập `/admin` hay `/owner`, website hiển thị giao diện 404 thân thiện: *"Không tìm thấy trang yêu cầu - Đường dẫn không tồn tại hoặc đã được di chuyển"*, kèm thanh tìm kiếm và nút "Về trang chủ".
  3. Hoàn thiện xử lý click thông báo trong `Header.jsx`: Khi Admin click thông báo hồ sơ sân mới (`NEW_FIELD`), hệ thống sử dụng SPA client-side routing `navigate('/admin?tab=PENDING_FIELDS')`, không làm mất phiên và mở trực tiếp tab duyệt sân.

### Phát hiện #2: Cơ chế Passwordless OTP Auto-Provisioning (Mức độ: Low / Informational)
- **Mô tả:** Trong kịch bản `SEC-A02`, khi thực hiện yêu cầu xác minh OTP với một số điện thoại chưa từng đăng ký (`+84999999999`), hệ thống Supabase tự động cấp một tài khoản mới với vai trò mặc định là `KHACHHANG`.
- **Đánh giá rủi ro:** Đây là tính năng đăng nhập nhanh không cần mật khẩu (Passwordless Onboarding) phổ biến trên các nền tảng thương mại hiện đại. Tuy nhiên, nếu không giới hạn số lần gửi OTP (Rate Limiting), kẻ tấn công có thể spam tạo nhiều tài khoản rác.
- **Khuyến nghị:**
  - Bổ sung Rate Limiting trên endpoint `POST /api/auth/otp` (ví dụ: tối đa 3 yêu cầu OTP / số điện thoại trong vòng 15 phút).
  - Tích hợp Captcha nhẹ (Turnstile hoặc reCAPTCHA v3) tại modal gửi mã OTP nếu phát hiện lưu lượng bất thường.

### Phát hiện #3: Kiểm soát toàn vẹn giao dịch đặt sân (Transaction Atomicity)
- **Mô tả:** Kịch bản `SEC-E02` kiểm tra việc người dùng cố ý ghi đè hoặc insert trực tiếp đơn đặt sân qua gateway `/api/data`.
- **Kết quả:** Backend đã từ chối với mã lỗi `HTTP 403: Bookings must use the atomic booking endpoint`.
- **Ý nghĩa:** Đảm bảo toàn vẹn dữ liệu, triệt tiêu nguy cơ Race Condition (hai người cùng đặt một khung giờ) nhờ bắt buộc sử dụng Stored Procedure hoặc hàm `datsan_atomic` tại database.

---

## 4. Đánh giá tổng kết & Kết luận (Final Assessment)

### Kết luận kiểm thử: **CONDITIONAL PASS (ĐẠT TIÊU CHUẨN CÓ ĐIỀU KIỆN)**

- **Độ an toàn phân quyền:** **RẤT TỐT (EXCELLENT)**  
  Hệ thống đã đạt đầy đủ các yêu cầu bảo vệ phân quyền theo chuẩn thương mại điện tử thực tế:
  - Khách vãng lai và người dùng sai vai trò không thể truy cập, xem hoặc thao tác trên bất kỳ trang hay API quản trị nào.
  - Thông tin nhạy cảm của các chủ sân và khách hàng được cô lập hoàn toàn (Anti-IDOR).
  - Không có hiện tượng rò rỉ layout trước khi xác thực (Zero FOUC).
  
- **Điều kiện để hoàn tất triển khai (Production Readiness):**
  1. Hiện tại toàn bộ mã nguồn cải tiến bảo vệ đa lớp (404 Neutral Route Protection, Header Notification Routing, Backend RBAC Middleware) đã hoàn thành và được kiểm thử thành công trên môi trường cục bộ (`localhost`).
  2. Cần thực hiện thao tác **Commit & Push** các thay đổi từ nhánh phát triển lên GitHub để Vercel kích hoạt quá trình Build & Deploy bản mới nhất, thay thế giao diện cũ đang hiển thị tại `datsan-front-v2.vercel.app`.
