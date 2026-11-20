import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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
import { getCurrentUser } from './supabaseClient';

function RoleRoute({ allowedRoles, children }) {
  let activeUser = null;
  try {
    const saved = sessionStorage.getItem('datsan_user');
    activeUser = saved ? JSON.parse(saved) : null;
  } catch {
    activeUser = null;
  }

  if (!activeUser) return <Navigate to="/?login=1" replace />;
  const role = String(activeUser.VaiTro || activeUser.vaitro || activeUser.role || '').toUpperCase();
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
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
      <Routes>
        {/* 1. Luồng Khách Hàng (Customer Flow) */}
        <Route path="/" element={<Home user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/field/:id" element={<FieldDetail user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/san/:id" element={<FieldDetail user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/checkout" element={<Checkout user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/ticket/:id" element={<Ticket user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/login" element={<Login user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/matchmaking" element={<Matchmaking user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/profile/*" element={<RoleRoute allowedRoles={['KHACHHANG', 'CHUSAN', 'ADMIN']}><UserProfile user={currentUser} setUser={setCurrentUser} /></RoleRoute>} />
        <Route path="/register-field" element={<RoleRoute allowedRoles={['KHACHHANG', 'CHUSAN', 'ADMIN']}><RegisterField user={currentUser} setUser={setCurrentUser} /></RoleRoute>} />

        {/* 2. Luồng Của Chủ Sân (Field Owner Portal) */}
        <Route path="/owner/*" element={<RoleRoute allowedRoles={['CHUSAN', 'ADMIN']}><OwnerDashboard user={currentUser} setUser={setCurrentUser} /></RoleRoute>} />

        {/* 3. Luồng Quản Trị Hệ Thống (Super Admin Portal) */}
        <Route path="/admin/*" element={<RoleRoute allowedRoles={['ADMIN']}><AdminDashboard user={currentUser} setUser={setCurrentUser} /></RoleRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
