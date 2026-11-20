import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LogIn, AlertTriangle, X, Phone } from 'lucide-react';

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
import Header from './components/Header';
import { getCurrentUser, requestPhoneOtp, verifyPhoneOtp, broadcastAuthChange } from './supabaseClient';

function RoleRoute({ allowedRoles, roleName = 'người dùng có thẩm quyền', user, setUser, children }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  let activeUser = user;
  if (!activeUser) {
    try {
      const saved = sessionStorage.getItem('datsan_user');
      activeUser = saved ? JSON.parse(saved) : null;
    } catch {
      activeUser = null;
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setLoginError('');
      const normalized = phone.trim().replace(/^0/, '84').replace(/[^0-9]/g, '');
      const session = await verifyPhoneOtp(normalized, otp.trim());
      sessionStorage.setItem('datsan_access_token', session.accessToken);
      if (session.refreshToken) sessionStorage.setItem('datsan_refresh_token', session.refreshToken);
      sessionStorage.setItem('datsan_user', JSON.stringify(session.user));
      if (typeof setUser === 'function') setUser(session.user);
      broadcastAuthChange(session.user);
      setShowLoginModal(false);
    } catch (err) {
      setLoginError(err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Nếu chưa đăng nhập: Giữ nguyên URL trang này, hiển thị Header bình thường + thông báo yêu cầu đăng nhập
  if (!activeUser) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col">
        <Header user={null} setUser={setUser} onLoginClick={() => setShowLoginModal(true)} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Yêu cầu đăng nhập</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Vui lòng đăng nhập với tài khoản {roleName} để tiếp tục truy cập và thao tác tại trang này.
            </p>
            <button
              onClick={() => setShowLoginModal(true)}
              className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Đăng nhập ngay
            </button>
          </div>
        </main>

        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
              <button 
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900">{step === 1 ? 'Đăng nhập / Đăng ký' : 'Xác thực OTP'}</h2>
                <p className="text-xs text-slate-500 mt-1">{step === 1 ? 'Nhập số điện thoại để nhận mã xác thực.' : `Nhập mã được gửi đến ${phone}`}</p>
              </div>

              {step === 1 ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setSubmitting(true);
                    setLoginError('');
                    const normalized = phone.trim().replace(/^0/, '84').replace(/[^0-9]/g, '');
                    await requestPhoneOtp(normalized);
                    setStep(2);
                  } catch (err) {
                    setLoginError(err.message || 'Lỗi gửi OTP');
                  } finally {
                    setSubmitting(false);
                  }
                }} className="space-y-4">
                  <label className="block text-xs font-bold text-slate-700">Số điện thoại
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nhập số điện thoại (ví dụ: 0901111111)" className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" required />
                  </label>
                  {loginError && <p role="alert" className="text-xs text-rose-600 font-bold">{loginError}</p>}
                  <button disabled={submitting} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition">
                    {submitting ? 'Đang gửi...' : 'Gửi mã OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <label className="block text-xs font-bold text-slate-700">Mã OTP
                    <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center tracking-widest text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" autoFocus required />
                  </label>
                  {loginError && <p role="alert" className="text-xs text-rose-600 font-bold">{loginError}</p>}
                  <button disabled={submitting} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition">
                    {submitting ? 'Đang xác minh...' : 'Xác nhận đăng nhập'}
                  </button>
                  <button type="button" onClick={() => { setStep(1); setLoginError(''); }} className="w-full text-xs text-emerald-700">Đổi số điện thoại</button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Nếu đã đăng nhập nhưng sai vai trò:
  const role = String(activeUser.VaiTro || activeUser.vaitro || activeUser.role || '').toUpperCase();
  if (!allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col">
        <Header user={activeUser} setUser={setUser} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Không đủ phân quyền</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Tài khoản hiện tại ({activeUser.HoTen || activeUser.hoten} - {role}) không có quyền truy cập trang này. Vui lòng đăng nhập với tài khoản {roleName}.
            </p>
            <button
              onClick={() => {
                broadcastAuthChange(null);
                if (typeof setUser === 'function') setUser(null);
              }}
              className="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition"
            >
              Đổi tài khoản khác
            </button>
          </div>
        </main>
      </div>
    );
  }

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
        <Route 
          path="/profile/*" 
          element={
            <RoleRoute 
              allowedRoles={['KHACHHANG', 'CHUSAN', 'ADMIN']} 
              roleName="thành viên"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <UserProfile user={currentUser} setUser={setCurrentUser} />
            </RoleRoute>
          } 
        />
        <Route 
          path="/register-field" 
          element={
            <RoleRoute 
              allowedRoles={['KHACHHANG', 'CHUSAN', 'ADMIN']} 
              roleName="đăng ký sân"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <RegisterField user={currentUser} setUser={setCurrentUser} />
            </RoleRoute>
          } 
        />

        {/* 2. Luồng Của Chủ Sân (Field Owner Portal) */}
        <Route 
          path="/owner/*" 
          element={
            <RoleRoute 
              allowedRoles={['CHUSAN', 'ADMIN']} 
              roleName="Chủ Sân"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <OwnerDashboard user={currentUser} setUser={setCurrentUser} />
            </RoleRoute>
          } 
        />

        {/* 3. Luồng Quản Trị Hệ Thống (Super Admin Portal) */}
        <Route 
          path="/admin/*" 
          element={
            <RoleRoute 
              allowedRoles={['ADMIN']} 
              roleName="Quản Trị Viên (Admin)"
              user={currentUser} 
              setUser={setCurrentUser}
            >
              <AdminDashboard user={currentUser} setUser={setCurrentUser} />
            </RoleRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
