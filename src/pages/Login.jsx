import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Shield, Building2, User, Phone, KeyRound, ArrowLeft, 
  Sparkles, CheckCircle2, AlertTriangle, Loader2, LogIn 
} from 'lucide-react';
import { requestPhoneOtp, verifyPhoneOtp, broadcastAuthChange } from '../supabaseClient';

export default function Login({ user, setUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || searchParams.get('returnUrl') || '';

  const [activeTab, setActiveTab] = useState('KHACHHANG'); // KHACHHANG | CHUSAN | ADMIN
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Xử lý chuyển hướng sau khi đăng nhập thành công
  const handlePostLoginRedirect = (loggedInUser) => {
    const role = String(loggedInUser?.VaiTro || loggedInUser?.vaitro || '').toUpperCase();
    if (redirectTarget) {
      navigate(redirectTarget);
    } else if (role === 'ADMIN') {
      navigate('/admin');
    } else if (role === 'CHUSAN') {
      navigate('/owner');
    } else {
      navigate('/');
    }
  };

  // Đăng nhập nhanh 1 chạm cho môi trường kiểm thử
  const handleQuickDemoLogin = async (phone) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const normalized = phone.trim().replace(/^0/, '84').replace(/[^0-9]/g, '');
      const res = await verifyPhoneOtp(normalized, '123456');
      if (res?.accessToken) {
        sessionStorage.setItem('datsan_access_token', res.accessToken);
        if (res.refreshToken) sessionStorage.setItem('datsan_refresh_token', res.refreshToken);
        sessionStorage.setItem('datsan_user', JSON.stringify(res.user));
        if (typeof setUser === 'function') setUser(res.user);
        broadcastAuthChange(res.user);
        handlePostLoginRedirect(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Không thể đăng nhập bằng tài khoản mẫu');
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
      setStep(2);
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
        if (typeof setUser === 'function') setUser(res.user);
        broadcastAuthChange(res.user);
        handlePostLoginRedirect(res.user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Mã OTP không chính xác hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 flex flex-col justify-center items-center p-4 antialiased font-sans">
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 bg-white/80 hover:bg-white px-3.5 py-2 rounded-xl shadow-sm border border-slate-200 transition backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Về Trang Chủ
        </Link>
        <span className="text-[11px] font-mono text-slate-400 font-bold">
          DatSanOnline Auth v2
        </span>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Brand Banner */}
        <div className="p-6 sm:p-8 text-center border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 font-bold text-xl mx-auto mb-3">
            DS
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Đăng Nhập Hệ Thống
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Hệ sinh thái kết nối và quản lý sân cỏ toàn quốc
          </p>

          {/* Quick Tab Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl mt-5 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setActiveTab('KHACHHANG'); setPhoneNumber('0905123456'); setStep(1); setErrorMsg(''); }}
              className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1 ${
                activeTab === 'KHACHHANG' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Khách</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('CHUSAN'); setPhoneNumber('0905777888'); setStep(1); setErrorMsg(''); }}
              className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1 ${
                activeTab === 'CHUSAN' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Chủ Sân</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('ADMIN'); setPhoneNumber('0901111111'); setStep(1); setErrorMsg(''); }}
              className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1 ${
                activeTab === 'ADMIN' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {/* Quick Login One-Click for QA/Demo */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
            <div className="text-[11px] font-black text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Tài khoản kiểm thử nhanh (1-Click):
            </div>
            {activeTab === 'KHACHHANG' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin('0905123456')}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>⚡ Vào ngay tài khoản Khách Hàng (0905123456)</span>
              </button>
            )}
            {activeTab === 'CHUSAN' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin('0905777888')}
                className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>⚡ Vào ngay tài khoản Chủ Sân (0905777888)</span>
              </button>
            )}
            {activeTab === 'ADMIN' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemoLogin('0901111111')}
                className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>⚡ Vào ngay tài khoản Quản Trị Viên (0901111111)</span>
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Standard Phone + OTP Form */}
          {step === 1 ? (
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
                    placeholder="Nhập 10 số điện thoại"
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono"
                    required
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Gửi Mã Xác Thực OTP</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Mã xác thực OTP
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
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
                  Mã OTP đã gửi tới {phoneNumber}. (Môi trường test: <code className="font-mono font-bold text-slate-600">123456</code>)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Xác Nhận & Đăng Nhập</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
