import React, { useState } from 'react';
import { Phone, X, Loader2, KeyRound } from 'lucide-react';
import { requestPhoneOtp, verifyPhoneOtp, broadcastAuthChange } from '../supabaseClient';

export default function LoginModal({ isOpen, onClose, onSuccess }) {
  const [loginStep, setLoginStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setLoginStep(1);
    setPhoneNumber('');
    setNormalizedPhone('');
    setOtpCode('');
    setLoginError('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    if (typeof onClose === 'function') onClose();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const digits = phoneNumber.replace(/\D/g, '');
    const e164Phone = digits.startsWith('0') ? `+84${digits.slice(1)}` : digits.startsWith('84') ? `+${digits}` : `+84${digits}`;
    if (!/^\+84\d{9}$/.test(e164Phone)) {
      setLoginError('Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số).');
      return;
    }
    try {
      setIsSubmitting(true);
      setLoginError('');
      await requestPhoneOtp(e164Phone);
      setNormalizedPhone(e164Phone);
      setOtpCode('');
      setLoginStep(2);
    } catch (error) {
      setLoginError(error.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setLoginError('Vui lòng nhập mã OTP.');
      return;
    }
    try {
      setIsSubmitting(true);
      setLoginError('');
      const session = await verifyPhoneOtp(normalizedPhone, otpCode.trim());
      if (session?.accessToken) {
        sessionStorage.setItem('datsan_access_token', session.accessToken);
        if (session.refreshToken) sessionStorage.setItem('datsan_refresh_token', session.refreshToken);
        if (session.user) {
          sessionStorage.setItem('datsan_user', JSON.stringify(session.user));
          broadcastAuthChange(session.user);
          if (typeof onSuccess === 'function') onSuccess(session.user);
        }
        handleClose();
      } else {
        throw new Error('Không nhận được dữ liệu phiên đăng nhập.');
      }
    } catch (error) {
      setLoginError(error.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div 
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            {loginStep === 1 ? (
              <Phone className="w-6 h-6 text-emerald-600" />
            ) : (
              <KeyRound className="w-6 h-6 text-emerald-600" />
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900">
            {loginStep === 1 ? 'Đăng nhập / Đăng ký' : 'Xác thực OTP'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {loginStep === 1 
              ? 'Nhập số điện thoại để nhận mã xác thực qua SMS.' 
              : `Nhập mã 6 chữ số gửi đến ${normalizedPhone}`}
          </p>
        </div>

        {loginStep === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số điện thoại
              </label>
              <input 
                type="tel" 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d+ ]/g, ''))} 
                placeholder="Ví dụ: 0905123456" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium" 
                autoFocus
                required 
              />
            </div>
            {loginError && (
              <p role="alert" className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {loginError}
              </p>
            )}
            <button 
              type="submit"
              disabled={isSubmitting} 
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...
                </>
              ) : (
                'Gửi mã OTP'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                Mã xác thực OTP
              </label>
              <input 
                type="text" 
                inputMode="numeric" 
                maxLength={8} 
                value={otpCode} 
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                placeholder="------" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center tracking-widest text-xl font-black focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" 
                autoFocus
                required 
              />
            </div>
            <div className="text-[11px] text-slate-500 text-center">
              Nhập mã OTP 6 chữ số đã gửi qua tin nhắn
            </div>
            {loginError && (
              <p role="alert" className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {loginError}
              </p>
            )}
            <button 
              type="submit"
              disabled={isSubmitting} 
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang xác minh...
                </>
              ) : (
                'Xác nhận đăng nhập'
              )}
            </button>
            <button 
              type="button" 
              onClick={() => { setLoginStep(1); setLoginError(''); }} 
              className="w-full text-xs text-emerald-700 font-bold hover:underline text-center"
            >
              Đổi số điện thoại khác
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
