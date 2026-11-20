import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Shield, Building2, PlusCircle, User, AlertTriangle, ArrowLeft, 
  CheckCircle2, Sparkles, Loader2, LogIn, Phone, KeyRound
} from 'lucide-react';
import { requestPhoneOtp, verifyPhoneOtp, broadcastAuthChange, getCurrentUser } from '../supabaseClient';

export default function PortalLoginGuard({ 
  allowedRoles = [], 
  portalType = 'ADMIN',
  title = '',
  description = '',
  user,
  setUser,
  children 
}) {
  const navigate = useNavigate();
  const [activeUser, setActiveUser] = useState(() => user || getCurrentUser());
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginStep, setLoginStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Đồng bộ phiên khi có sự kiện thay đổi đăng nhập/đăng xuất
  useEffect(() => {
    if (user !== undefined) setActiveUser(user);
  }, [user]);

  useEffect(() => {
    const handleAuthChange = (e) => {
      const newUser = e.detail !== undefined ? e.detail : getCurrentUser();
      setActiveUser(newUser);
      if (typeof setUser === 'function') setUser(newUser);
    };
    window.addEventListener('datsan_auth_change', handleAuthChange);
    return () => window.removeEventListener('datsan_auth_change', handleAuthChange);
  }, [setUser]);

  // Đăng nhập nhanh bằng tài khoản mẫu phục vụ demo & test
  const handleQuickLogin = async (phone) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const normalized = phone.trim().replace(/^0/, '84').replace(/[^0-9]/g, '');
      const res = await verifyPhoneOtp(normalized, '123456');
      if (res?.accessToken) {
        sessionStorage.setItem('datsan_access_token', res.accessToken);
        if (res.refreshToken) sessionStorage.setItem('datsan_refresh_token', res.refreshToken);
        sessionStorage.setItem('datsan_user', JSON.stringify(res.user));
        setActiveUser(res.user);
        if (typeof setUser === 'function') setUser(res.user);
        broadcastAuthChange(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Không thể đăng nhập bằng tài khoản này');
    } finally {
      setLoading(false);
    }
  };

  // Gửi OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      const normalized = phoneNumber.trim().replace(/^0/, '84').replace(/[^0-9]/g, '');
      await requestPhoneOtp(normalized);
      setLoginStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Không thể gửi mã xác thực OTP');
    } finally {
      setLoading(false);
    }
  };

  // Xác thực OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMsg('Vui lòng nhập mã OTP');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      const normalized = phoneNumber.trim().replace(/^0/, '84').replace(/[^0-9]/g, '');
      const res = await verifyPhoneOtp(normalized, otpCode.trim());
      if (res?.accessToken) {
        sessionStorage.setItem('datsan_access_token', res.accessToken);
        if (res.refreshToken) sessionStorage.setItem('datsan_refresh_token', res.refreshToken);
        sessionStorage.setItem('datsan_user', JSON.stringify(res.user));
        setActiveUser(res.user);
        if (typeof setUser === 'function') setUser(res.user);
        broadcastAuthChange(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Mã OTP không chính xác hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  // Đổi tài khoản khác
  const handleSwitchAccount = () => {
    broadcastAuthChange(null);
    if (typeof setUser === 'function') setUser(null);
    setActiveUser(null);
    setLoginStep(1);
    setPhoneNumber('');
    setOtpCode('');
    setErrorMsg('');
  };

  // Cấu hình giao diện theo loại portal
  const config = {
    ADMIN: {
      badge: 'CỔNG BẢO MẬT ADMIN',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      icon: <Shield className="w-8 h-8 text-purple-600" />,
      iconBg: 'bg-purple-100',
      btnColor: 'bg-purple-600 hover:bg-purple-700 text-white',
      defaultTitle: 'Cổng Quản Trị Hệ Thống (Super Admin)',
      defaultDesc: 'Vui lòng xác thực tài khoản có phân quyền Quản Trị Viên (Admin) để tiếp tục thao tác.',
      quickAccount: {
        label: '⚡ Đăng nhập Quản Trị Viên (0901111111 / OTP: 123456)',
        phone: '0901111111'
      }
    },
    CHUSAN: {
      badge: 'CỔNG QUẢN LÝ DÀNH CHO CHỦ SÂN',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: <Building2 className="w-8 h-8 text-amber-600" />,
      iconBg: 'bg-amber-100',
      btnColor: 'bg-amber-500 hover:bg-amber-600 text-white',
      defaultTitle: 'Bảng Điều Khiển Quản Lý Sân',
      defaultDesc: 'Khu vực dành riêng cho Chủ Sân để quản lý lịch đặt sân, xác nhận thu tiền mặt và nộp hoa hồng.',
      quickAccount: {
        label: '⚡ Đăng nhập Chủ Sân (0905777888 / OTP: 123456)',
        phone: '0905777888'
      }
    },
    REGISTER: {
      badge: 'ĐĂNG KÝ CỤM SÂN MỚI',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: <PlusCircle className="w-8 h-8 text-emerald-600" />,
      iconBg: 'bg-emerald-100',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      defaultTitle: 'Đăng Ký Cụm Sân Thể Thao Mới',
      defaultDesc: 'Vui lòng đăng nhập tài khoản trước khi gửi hồ sơ đăng ký hợp tác cụm sân lên sàn DatSanOnline.',
      quickAccount: {
        label: '⚡ Đăng nhập Khách Hàng (0905123456 / OTP: 123456)',
        phone: '0905123456'
      }
    },
    PROFILE: {
      badge: 'THÔNG TIN CÁ NHÂN',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: <User className="w-8 h-8 text-blue-600" />,
      iconBg: 'bg-blue-100',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
      defaultTitle: 'Hồ Sơ & Lịch Sử Đặt Sân',
      defaultDesc: 'Vui lòng đăng nhập để tra cứu các trận đấu đã đặt và quản lý thông tin tài khoản của bạn.',
      quickAccount: {
        label: '⚡ Đăng nhập Khách Hàng (0905123456 / OTP: 123456)',
        phone: '0905123456'
      }
    }
  }[portalType] || {
    badge: 'XÁC THỰC BẢO MẬT',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <Lock className="w-8 h-8 text-slate-700" />,
    iconBg: 'bg-slate-100',
    btnColor: 'bg-slate-900 hover:bg-slate-800 text-white',
    defaultTitle: 'Yêu Cầu Đăng Nhập',
    defaultDesc: 'Vui lòng đăng nhập để tiếp tục truy cập trang này.',
    quickAccount: null
  };

  // 1. TRƯỜNG HỢP CHƯA ĐĂNG NHẬP: Hiển thị giao diện đăng nhập ngay tại route hiện tại
  if (!activeUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 flex flex-col justify-center items-center p-4 antialiased font-sans">
        {/* Nút quay lại trang chủ */}
        <div className="w-full max-w-md mb-4 flex items-center justify-between">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 bg-white/80 hover:bg-white px-3.5 py-2 rounded-xl shadow-sm border border-slate-200 transition backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Về Trang Chủ
          </Link>
          <div className="text-[11px] font-mono text-slate-400 font-bold">
            DatSanOnline VN
          </div>
        </div>

        {/* Card đăng nhập */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header Card */}
          <div className="p-6 sm:p-8 text-center border-b border-slate-100">
            <div className={`w-16 h-16 rounded-2xl ${config.iconBg} flex items-center justify-center mx-auto mb-4 shadow-inner`}>
              {config.icon}
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border mb-2 ${config.badgeColor}`}>
              {config.badge}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title || config.defaultTitle}
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
              {description || config.defaultDesc}
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {/* Nút đăng nhập test nhanh nếu có */}
            {config.quickAccount && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
                <div className="text-[11px] font-black text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Chế độ kiểm thử nhanh:
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin(config.quickAccount.phone)}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{config.quickAccount.label}</span>
                </button>
              </div>
            )}

            {/* Thông báo lỗi nếu có */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form đăng nhập SĐT & OTP chuẩn */}
            {loginStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ví dụ: 0901111111"
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono"
                      autoFocus
                      required
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 ${config.btnColor}`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  <span>Nhận Mã OTP Qua SMS</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Mã xác thực OTP (6 chữ số)
                    </label>
                    <button
                      type="button"
                      onClick={() => setLoginStep(1)}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      Đổi số điện thoại
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Mặc định: 123456"
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono tracking-widest text-center"
                      autoFocus
                      required
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mã xác thực đã được gửi đến số {phoneNumber}. (Môi trường test: <code className="font-mono font-bold text-slate-600">123456</code>)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 ${config.btnColor}`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Xác Nhận & Tiếp Tục</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. TRƯỜNG HỢP ĐÃ ĐĂNG NHẬP NHƯNG SAI PHÂN QUYỀN (VD: Khách Hàng cố truy cập /admin)
  const userRole = String(activeUser.VaiTro || activeUser.vaitro || activeUser.role || '').toUpperCase();
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 antialiased font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div>
            <span className="inline-block px-3 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
              TỪ CHỐI TRUY CẬP (403)
            </span>
            <h2 className="text-xl font-black text-slate-900">
              Không Đủ Phân Quyền
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Bạn đang đăng nhập bằng tài khoản <strong className="text-slate-800">{activeUser.HoTen || activeUser.hoten || activeUser.SoDienThoai}</strong> (Vai trò: <span className="font-mono font-bold text-emerald-600">{userRole}</span>).
            </p>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Khu vực này yêu cầu phân quyền: <span className="text-rose-600 font-mono font-bold">{allowedRoles.join(' hoặc ')}</span>.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleSwitchAccount}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng Nhập Bằng Tài Khoản Khác</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay Lại Trang Chủ</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. ĐỦ QUYỀN: Hiển thị nội dung component
  return children;
}
