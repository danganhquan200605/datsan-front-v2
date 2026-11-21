import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import các trang giao diện chính
import Home from './pages/Home';
import FieldDetail from './pages/FieldDetail';
import Checkout from './pages/Checkout';
import Ticket from './pages/Ticket';
import Login from './pages/Login';
import Matchmaking from './pages/Matchmaking';
import UserProfile from './pages/UserProfile';
import RegisterField from './pages/RegisterField';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';
import { getCurrentUser } from './supabaseClient';

// Route bảo vệ nội bộ: Nếu chưa đăng nhập hoặc sai vai trò, hiển thị giao diện trung tính 404
function ProtectedInternalRoute({ allowedRoles, user, setUser, children }) {
  let activeUser = user;
  if (activeUser === undefined) {
    try {
      const saved = sessionStorage.getItem('datsan_user');
      activeUser = saved ? JSON.parse(saved) : null;
    } catch {
      activeUser = null;
    }
  }

  // 1. Nếu chưa đăng nhập: Không render dashboard, không gọi API, hiển thị trang 404 trung tính
  if (!activeUser) {
    return <NotFound user={null} setUser={setUser} />;
  }

  // 2. Nếu đã đăng nhập nhưng không đủ quyền: Hiển thị trang 404 trung tính
  const role = String(activeUser.VaiTro || activeUser.vaitro || activeUser.role || '').toUpperCase();
  if (!allowedRoles.includes(role)) {
    return <NotFound user={activeUser} setUser={setUser} />;
  }

  // 3. Đúng vai trò: Render dashboard tương ứng
  return children;
}

function App() {
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    Boolean(import.meta.env?.DEV)
  );

  // Đọc dữ liệu tài khoản từ sessionStorage (tắt tab/trình duyệt sẽ tự đăng xuất về Guest)
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());

  // Lắng nghe sự kiện đồng bộ đăng nhập/đăng xuất toàn hệ thống
  useEffect(() => {
    const handleAuthChange = (e) => {
      setCurrentUser(e.detail !== undefined ? e.detail : getCurrentUser());
    };
    window.addEventListener('datsan_auth_change', handleAuthChange);
    return () => window.removeEventListener('datsan_auth_change', handleAuthChange);
  }, []);

  return (
    <Router>
      {/* NHÃN BẢO VỆ MÔI TRƯỜNG TRÊN LOCALHOST: STAGING / DEMO */}
      {isLocalhost && (
        <aside aria-label="Môi trường thử nghiệm" className="bg-amber-400 text-slate-900 border-b border-amber-500 text-xs font-bold py-1.5 px-4 text-center sticky top-0 z-50 shadow-sm flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
          <span className="bg-slate-900 text-amber-300 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase">LOCAL ENVIRONMENT</span>
          <span>⚡ <strong>STAGING / DEMO</strong> — HỆ THỐNG ĐANG KẾT NỐI SUPABASE STAGING & TIỀN MÔ PHỎNG ⚡</span>
        </aside>
      )}
      <Routes>
        {/* 1. Luồng Khách Hàng (Customer Flow) */}
        <Route path="/" element={<Home user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/field/:id" element={<FieldDetail user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/san/:id" element={<FieldDetail user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/checkout" element={<Checkout user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/ticket/:id" element={<Ticket user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/login" element={<Login user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/matchmaking" element={<Matchmaking user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/profile/*" element={<UserProfile user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/register-field" element={<RegisterField user={currentUser} setUser={setCurrentUser} />} />

        {/* 2. Luồng Của Chủ Sân (Field Owner Portal) - Được bảo vệ bằng ProtectedInternalRoute */}
        <Route 
          path="/owner/*" 
          element={
            <ProtectedInternalRoute 
              allowedRoles={['CHUSAN', 'ADMIN']} 
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <OwnerDashboard user={currentUser} setUser={setCurrentUser} />
            </ProtectedInternalRoute>
          } 
        />

        {/* 3. Luồng Quản Trị Hệ Thống (Super Admin Portal) - Được bảo vệ bằng ProtectedInternalRoute */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedInternalRoute 
              allowedRoles={['ADMIN']} 
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <AdminDashboard user={currentUser} setUser={setCurrentUser} />
            </ProtectedInternalRoute>
          } 
        />

        {/* 4. Trang 404 Thống Nhất Cho Tất Cả Đường Dẫn Không Tồn Tại */}
        <Route path="*" element={<NotFound user={currentUser} setUser={setCurrentUser} />} />
      </Routes>
    </Router>
  );
}

export default App;
