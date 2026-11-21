import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Search, ArrowLeft } from 'lucide-react';
import Header from '../components/Header';
import LoginModal from '../components/LoginModal';

export default function NotFound({ user, setUser }) {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col">
      <Header 
        user={user} 
        setUser={setUser} 
        onLoginClick={() => setShowLoginModal(true)} 
      />

      <main className="flex-1 flex items-center justify-center p-6 my-auto">
        <div className="max-w-lg w-full text-center px-4 py-8">
          
          {/* Sports Field 404 Illustration */}
          <div className="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center">
            {/* Background glowing circle */}
            <div className="absolute inset-0 bg-emerald-100/60 rounded-full blur-xl scale-95" />
            
            {/* Sport pitch graphic */}
            <div className="relative w-44 h-44 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-xl shadow-emerald-500/20 p-3.5 flex flex-col justify-between overflow-hidden border-2 border-emerald-400/40">
              {/* Pitch inner markings */}
              <div className="w-full h-full border-2 border-white/40 rounded-2xl relative flex items-center justify-center">
                {/* Center circle */}
                <div className="w-16 h-16 rounded-full border-2 border-white/40 absolute" />
                {/* Center line */}
                <div className="w-full h-[2px] bg-white/40 absolute" />
                {/* Goal boxes */}
                <div className="w-16 h-6 border-2 border-b-0 border-white/40 absolute top-0 rounded-b-md" />
                <div className="w-16 h-6 border-2 border-t-0 border-white/40 absolute bottom-0 rounded-t-md" />
                
                {/* 404 Badge in center of the pitch */}
                <div className="relative z-10 px-4 py-1.5 bg-slate-900/90 text-white rounded-xl shadow-lg border border-white/20 backdrop-blur-sm">
                  <span className="text-2xl font-black tracking-wider text-emerald-400">404</span>
                </div>
              </div>
            </div>
          </div>

          {/* Heading & Friendly Message */}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            Rất tiếc, không tìm thấy trang!
          </h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-8">
            Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển. Vui lòng kiểm tra lại địa chỉ hoặc quay về trang chủ để khám phá các sân thể thao.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> Về Trang Chủ
            </button>
            <button
              onClick={() => navigate('/?search=1')}
              className="w-full sm:w-auto flex-1 py-3 px-6 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" /> Tìm Sân Thể Thao
            </button>
          </div>

          <div className="mt-8">
            <button
              onClick={() => window.history.back()}
              className="text-xs text-slate-400 hover:text-slate-600 transition inline-flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại trang trước
            </button>
          </div>

        </div>
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400 font-medium">
        © 2026 DatSanOnline – Hệ thống đặt sân thể thao trực tuyến
      </footer>

      {/* LoginModal if user clicks login in Header */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={(u) => {
          if (typeof setUser === 'function') setUser(u);
        }}
      />
    </div>
  );
}
