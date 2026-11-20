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

// Guard bảo vệ phân quyền và hiển thị Form Đăng Nhập tại chỗ không bị văng về Trang Chủ
import PortalLoginGuard from './components/PortalLoginGuard';
import { getCurrentUser } from './supabaseClient';

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
        {/* 1. Luồng Khách Hàng Công Khai (Public Flow) */}
        <Route path="/" element={<Home user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/field/:id" element={<FieldDetail user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/san/:id" element={<FieldDetail user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/checkout" element={<Checkout user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/ticket/:id" element={<Ticket user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/login" element={<Login user={currentUser} setUser={setCurrentUser} />} />
        <Route path="/matchmaking" element={<Matchmaking user={currentUser} setUser={setCurrentUser} />} />

        {/* 2. Luồng Yêu Cầu Xác Thực (Protected Flows) */}
        <Route 
          path="/profile/*" 
          element={
            <PortalLoginGuard 
              allowedRoles={['KHACHHANG', 'CHUSAN', 'ADMIN']} 
              portalType="PROFILE"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <UserProfile user={currentUser} setUser={setCurrentUser} />
            </PortalLoginGuard>
          } 
        />
        
        <Route 
          path="/register-field" 
          element={
            <PortalLoginGuard 
              allowedRoles={['KHACHHANG', 'CHUSAN', 'ADMIN']} 
              portalType="REGISTER"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <RegisterField user={currentUser} setUser={setCurrentUser} />
            </PortalLoginGuard>
          } 
        />

        {/* 3. Luồng Của Chủ Sân (Field Owner Portal) */}
        <Route 
          path="/owner/*" 
          element={
            <PortalLoginGuard 
              allowedRoles={['CHUSAN', 'ADMIN']} 
              portalType="CHUSAN"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <OwnerDashboard user={currentUser} setUser={setCurrentUser} />
            </PortalLoginGuard>
          } 
        />

        {/* 4. Luồng Quản Trị Hệ Thống (Super Admin Portal) */}
        <Route 
          path="/admin/*" 
          element={
            <PortalLoginGuard 
              allowedRoles={['ADMIN']} 
              portalType="ADMIN"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <AdminDashboard user={currentUser} setUser={setCurrentUser} />
            </PortalLoginGuard>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
