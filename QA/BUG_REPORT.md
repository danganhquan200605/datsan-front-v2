# BÁO CÁO CHI TIẾT LỖI HỆ THỐNG (BUG REPORT)

---

### BUG-001 (CRITICAL) – Lỗ hổng Backdoor: Tự động đăng nhập vào tài khoản Admin khi nhập URL `/admin`
* **Module**: Authentication & Authorization / Security
* **Môi trường**: Production (`https://datsan-front-v2.vercel.app/admin`) & Local
* **Mức độ nghiêm trọng**: **CRITICAL** (Nghiêm trọng nhất - Lỗ hổng bảo mật truy cập trái phép)
* **Độ ưu tiên**: P1 (Khắc phục ngay lập tức)
* **Điều kiện tiên quyết**: Khách vãng lai, trình duyệt ẩn danh (Incognito), chưa đăng nhập.
* **Các bước tái hiện (Steps to Reproduce)**:
  1. Mở cửa sổ trình duyệt ẩn danh (đảm bảo không có session đăng nhập nào).
  2. Gõ trực tiếp địa chỉ: `https://datsan-front-v2.vercel.app/admin`.
  3. Quan sát góc phải màn hình và dữ liệu quản trị hiển thị.
* **Kết quả kỳ vọng (Expected Result)**:
  * Hệ thống phải nhận diện người dùng chưa đăng nhập, từ chối quyền truy cập hoặc hiển thị popup yêu cầu đăng nhập. Tuyệt đối không được cấp quyền Admin cho người lạ.
* **Kết quả thực tế (Actual Result)**:
  * Người dùng lập tức bị tự động đăng nhập vào tài khoản Super Admin mang số điện thoại `+84901111111` (Lê Hoàng Quản Trị). Toàn bộ dữ liệu doanh thu sàn, danh sách người dùng và các nút duyệt/hủy sân bãi hiển thị đầy đủ và có thể thao tác được!
* **Bằng chứng mã nguồn (Evidence)**:
  * Tệp tin: `datsan-front-v2/src/pages/AdminDashboard.jsx`, dòng 93 - 106:
  ```javascript
  // Tự động khôi phục phiên nếu token hết hạn (401 / JWT expired)
  if (userRes?.error && (
    String(userRes.error.message || '').toLowerCase().includes('token') ||
    String(userRes.error.message || '').toLowerCase().includes('auth') ||
    String(userRes.error.message || '').toLowerCase().includes('401')
  )) {
    try {
      // ⚠️ NGUYÊN NHÂN: Tự động gọi API xác thực admin với số điện thoại và OTP hardcode
      const authRes = await verifyPhoneOtp('+84901111111', '123456');
      if (authRes?.accessToken) {
        sessionStorage.setItem('datsan_access_token', authRes.accessToken);
        if (authRes.user) {
          sessionStorage.setItem('datsan_user', JSON.stringify(authRes.user));
          setCurrentUser(authRes.user);
          if (typeof setUser === 'function') setUser(authRes.user);
          broadcastAuthChange(authRes.user);
        }
  ```
* **Nguyên nhân gốc rễ (Root Cause)**:
  * Khối mã tự động phục hồi phiên làm việc trong quá trình phát triển (development fallback) được để lại trong hàm `fetchAdminData()`. Khi khách vãng lai vào `/admin`, truy vấn lấy danh sách người dùng bị lỗi `401 Unauthorized`. Khối `if` bắt được lỗi này và ngay lập tức gọi API đăng nhập tài khoản Admin `+84901111111` kèm OTP `123456` mà không cần sự đồng ý hay thao tác của người dùng.
* **Đề xuất khắc phục (Suggested Fix)**:
  * Xóa bỏ hoàn toàn khối lệnh tự động `verifyPhoneOtp('+84901111111', '123456')` trong `fetchAdminData()`.
  * Nếu gặp lỗi 401 hoặc chưa có tài khoản Admin, chỉ hiển thị trạng thái `isSessionExpired = true` hoặc thông báo lỗi chuẩn, yêu cầu người dùng phải tự đăng nhập bằng thông tin thật.
* **Trạng thái**: RESOLVED & VERIFIED (Đã sửa & Kiểm thử thành công trên Local).
* **Chi tiết khắc phục (Resolution Details)**:
  1. Loại bỏ triệt để khối mã backdoor tự động `verifyPhoneOtp('+84901111111', '123456')` trong `AdminDashboard.jsx`.
  2. Xóa hàm `handleQuickAdminLogin` hardcoded OTP.
  3. Xây dựng component `LoginModal.jsx` chuẩn hóa form OTP số điện thoại toàn hệ thống.
  4. Tích hợp `LoginModal` vào `Header.jsx`, `AdminDashboard.jsx`, và `OwnerDashboard.jsx`.
  5. Khi khách vãng lai hoặc tài khoản chưa xác thực vào `/admin` hoặc `/owner`, hiển thị giao diện khách kèm banner cảnh báo yêu cầu quyền quản trị, giữ nguyên đường dẫn hiện tại và không tự động đăng nhập.
  6. Khi đăng xuất ở bất kỳ trang nào (`/admin`, `/owner`, `/register-field`, `/san/:id`), phiên được xóa sạch và người dùng ở lại đúng URL đó mà không bị văng về trang chủ.

---

### BUG-002 (HIGH) – Thiếu lớp bảo vệ Route (Route Protection) trên các trang Quản Trị
* **Module**: Routing & Authorization
* **Môi trường**: Production & Local
* **Mức độ nghiêm trọng**: **HIGH**
* **Độ ưu tiên**: P2
* **Điều kiện tiên quyết**: Khách vãng lai chưa đăng nhập.
* **Các bước tái hiện**:
  1. Xóa toàn bộ sessionStorage.
  2. Truy cập trực tiếp: `https://datsan-front-v2.vercel.app/owner`.
* **Kết quả kỳ vọng**:
  * Chặn người dùng không có vai trò `CHUSAN` truy cập vào giao diện quản lý cụm sân, tự động chuyển về trang chủ hoặc mở modal đăng nhập.
* **Kết quả thực tế**:
  * Trang `OwnerDashboard` vẫn được tải và mount vào DOM. Do không có token, các API lấy dữ liệu trả về lỗi và màn hình treo ở trạng thái tải dữ liệu hoặc hiển thị trống rỗng.
* **Nguyên nhân gốc rễ**:
  * Để tránh màn hình chặn gây rối mắt trước đó, `RoleRoute` đã bị loại bỏ hoàn toàn khỏi `App.jsx`, khiến các route `/admin`, `/owner`, `/profile`, `/register-field` trở thành public routes ở tầng client-side.
* **Đề xuất khắc phục**:
  * Thiết lập cơ chế bảo vệ mềm: Trong từng trang hoặc ở `App.jsx`, kiểm tra nếu chưa đăng nhập thì tự động mở Modal Đăng Nhập chuẩn của web hoặc chuyển hướng an toàn về `/?login=1`.
* **Trạng thái**: Open.

---

### BUG-003 (MEDIUM) – Các trang chức năng vệ tinh đang ở trạng thái Placeholder chưa hoàn thiện
* **Module**: Customer Experience
* **Môi trường**: Production
* **Mức độ nghiêm trọng**: **MEDIUM**
* **Độ ưu tiên**: P3
* **Điều kiện tiên quyết**: Không.
* **Các bước tái hiện**:
  1. Truy cập vào các URL: `/checkout`, `/ticket/1`, `/matchmaking`.
* **Kết quả kỳ vọng**:
  * Giao diện thanh toán đơn hàng, vé điện tử mã QR, hoặc bảng ghép đội tìm người chơi bóng đá/thể thao.
* **Kết quả thực tế**:
  * Trang hiển thị giao diện tạm bợ: *"Thanh toán chưa sẵn sàng"*, *"Vé điện tử chưa sẵn sàng"*, *"Tìm đội ghép trận chưa sẵn sàng"*.
* **Nguyên nhân gốc rễ**:
  * Các trang này được dựng khung sườn (scaffolding) trong giai đoạn thiết kế ban đầu nhưng chưa được phát triển logic backend tương ứng.
* **Đề xuất khắc phục**:
  * Tạm thời ẩn các đường link trỏ tới 3 trang này ở Header và Footer để tránh tạo cảm giác ứng dụng chưa hoàn thiện cho người dùng.
* **Trạng thái**: Open.

---

### BUG-004 (LOW/MEDIUM) – Số tài khoản MBBank nhận tiền cọc/hoa hồng VietQR bị cố định cứng (Hardcoded)
* **Module**: Pricing & Payment
* **Môi trường**: Production
* **Mức độ nghiêm trọng**: **LOW/MEDIUM**
* **Độ ưu tiên**: P3
* **Điều kiện tiên quyết**: Đặt sân hoặc nộp hoa hồng.
* **Các bước tái hiện**:
  1. Đặt sân bất kỳ tại `FieldDetail.jsx` và chọn phương thức VietQR.
  2. Mở modal nộp hoa hồng tại `OwnerDashboard.jsx`.
* **Kết quả thực tế**:
  * Cả hai nơi đều tạo mã VietQR đến số tài khoản `0901111111` ngân hàng MBBank.
* **Đề xuất khắc phục**:
  * Trong mô hình thực tế, tiền đặt sân của khách nên được định tuyến về tài khoản của sàn hoặc tài khoản của từng chủ sân cụ thể dựa trên thông tin ngân hàng trong CSDL.
* **Trạng thái**: Open.
