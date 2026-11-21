import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, MapPin, Bell, LogIn, Shield, User, LogOut, PlusCircle, Building2, Clock,
  Calendar, AlertTriangle, DollarSign, CheckCircle2, X
} from 'lucide-react';
import { fetchNotifications, markNotificationAsRead, broadcastAuthChange } from '../supabaseClient';
import LoginModal from './LoginModal';

export default function Header({ 
  user, 
  setUser, 
  onLoginClick, 
  searchTerm,
  setSearchTerm
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeToast, setActiveToast] = useState(null);
  const [showInternalLoginModal, setShowInternalLoginModal] = useState(false);
  const notifRef = useRef(null);
  const knownNotifIds = useRef(new Set());
  const navigate = useNavigate();

  // Đồng bộ phiên khi có sự kiện thay đổi xác thực
  useEffect(() => {
    const handleAuthChange = (e) => {
      if (typeof setUser === 'function' && e.detail !== undefined) {
        setUser(e.detail);
      }
    };
    window.addEventListener('datsan_auth_change', handleAuthChange);
    return () => window.removeEventListener('datsan_auth_change', handleAuthChange);
  }, [setUser]);

  // Xử lý đăng xuất (giữ nguyên vị trí trang, cập nhật phiên về Guest mượt mà)
  const handleLogout = () => {
    broadcastAuthChange(null);
    if (typeof setUser === 'function') setUser(null);
    setShowDropdown(false);
  };

  // Lấy tên hiển thị & vai trò
  const displayName = user?.HoTen || user?.hoten || 'Tài khoản';
  const userRole = user?.VaiTro || user?.vaitro || 'KHACHHANG';
  const userId = user?.manguoidung || user?.MaNguoiDung || user?.id;

  // Tải danh sách thông báo
  const loadNotifications = async () => {
    if (!userId && userRole !== 'ADMIN') {
      setNotifications([]);
      return;
    }
    try {
      const data = await fetchNotifications(userId, userRole);
      let list = Array.isArray(data) ? data : [];
      
      // Lọc bảo vệ chặt chẽ theo phân quyền vai trò (Role-based access control)
      if (userRole === 'KHACHHANG') {
        list = list.filter(n =>
          n.loaithongbao !== 'ADMIN' &&
          n.loaithongbao !== 'COMMISSION' &&
          n.loaithongbao !== 'REMINDER' &&
          (n.manguoidung === userId || n.loaithongbao === 'BROADCAST')
        );
      } else if (userRole === 'CHUSAN') {
        list = list.filter(n =>
          n.loaithongbao !== 'ADMIN' &&
          (n.manguoidung === userId || n.loaithongbao === 'BROADCAST')
        );
      }
      
      // Kiểm tra có thông báo mới tinh chưa đọc để hiển thị Toast realtime
      if (knownNotifIds.current.size > 0) {
        const newUnread = list.find(n => !n.dread && !knownNotifIds.current.has(n.mathongbao));
        if (newUnread) {
          setActiveToast(newUnread);
          setTimeout(() => setActiveToast(null), 6000);
        }
      }
      
      // Cập nhật tập ID đã biết
      list.forEach(n => knownNotifIds.current.add(n.mathongbao));
      setNotifications(list);
    } catch (e) {
      console.warn('Lỗi tải thông báo Header:', e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 10000);
    return () => clearInterval(timer);
  }, [userId, userRole]);

  // Đóng popover thông báo khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.dread).length;

  const handleMarkAllRead = async () => {
    try {
      await markNotificationAsRead(null, userId, true, userRole);
      setNotifications(prev => prev.map(n => ({ ...n, dread: true })));
    } catch (err) {
      console.warn(err);
    }
  };

  const handleMarkSingleRead = async (mathongbao) => {
    try {
      await markNotificationAsRead(mathongbao, userId, false, userRole);
      setNotifications(prev => prev.map(n => n.mathongbao === mathongbao ? ({ ...n, dread: true }) : n));
    } catch (err) {
      console.warn(err);
    }
  };

  // Xử lý click vào thông báo: Đánh dấu đã đọc & tự động chuyển đến chức năng tương ứng
  const handleNotificationClick = async (n) => {
    try {
      await handleMarkSingleRead(n.mathongbao);
    } catch {
      // ignore
    }
    setShowNotifications(false);

    if (n.loaithongbao === 'NEW_FIELD') {
      // Có hồ sơ sân mới chờ duyệt -> Admin đến thẳng mục duyệt sân
      navigate('/admin?tab=PENDING_FIELDS');
    } else if (n.loaithongbao === 'BOOKING') {
      // Có khách đặt sân mới -> Chủ sân đến bảng quản lý sân, Khách đến lịch sử đơn
      if (userRole === 'CHUSAN') {
        navigate('/owner');
      } else if (userRole === 'ADMIN') {
        navigate('/admin?tab=ALL_FIELDS');
      } else {
        navigate('/profile');
      }
    } else if (n.loaithongbao === 'COMMISSION' || n.loaithongbao === 'REMINDER') {
      // Nộp hoa hồng -> Chủ sân đến bảng quản lý, Admin đến kiểm tra sổ nợ
      if (userRole === 'CHUSAN') {
        navigate('/owner');
      } else if (userRole === 'ADMIN') {
        navigate('/admin');
      }
    } else if (n.loaithongbao === 'AUTO_COMPLETE') {
      // Trận đấu hoàn tất -> Khách đến profile để đánh giá sân
      navigate('/profile');
    }
  };

  const [currentClock, setCurrentClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const timeFormatted = currentClock.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = currentClock.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm font-sans">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between gap-6">
          
          {/* LOGO */}
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 font-bold text-lg">
                DS
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-emerald-600 leading-none">
                  DatSan<span className="text-amber-500">Online</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                  Hệ Sinh Thái Sân Cỏ VN
                </span>
              </div>
            </Link>
            <div className="relative hidden sm:block">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>TP. Đà Nẵng</span>
              </div>
            </div>
          </div>
          
          {/* SEARCH BAR */}
          <div className="flex-1 max-w-xl hidden md:block">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchTerm || ''}
                onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên sân, địa chỉ..."
                className="w-full h-11 pl-11 pr-24 rounded-full bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4" />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm && setSearchTerm('')}
                  className="absolute right-3 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* CÁC NÚT THAO TÁC / PROFILE */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {/* Nút Đăng Ký Chủ Sân cho Khách Hàng */}
                {userRole === 'KHACHHANG' && (
                  <button 
                    onClick={() => navigate('/register-field')} 
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Đăng Ký Chủ Sân</span>
                  </button>
                )}

                {/* Nút Quản Lý Sân / Admin */}
                {(userRole === 'ADMIN' || userRole === 'CHUSAN') && (
                  <button 
                    onClick={() => {
                      if (userRole === 'ADMIN') {
                        navigate('/admin');
                      } else {
                        navigate('/owner');
                      }
                    }} 
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Shield className="w-4 h-4" /> 
                    <span>{userRole === 'ADMIN' ? 'Trang Admin' : 'Quản Lý Sân'}</span>
                  </button>
                )}
                
                {/* NOTIFICATION BELL & DROPDOWN POPOVER */}
                <div className="relative" ref={notifRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-slate-500 hover:text-emerald-600 transition rounded-xl hover:bg-slate-100"
                    title="Thông báo hệ thống"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-sm animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Popover Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">Thông Báo</span>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-black text-[10px] rounded-full">
                              {unreadCount} mới
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button 
                            onClick={handleMarkAllRead}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition"
                          >
                            Đánh dấu tất cả đã đọc
                          </button>
                        )}
                      </div>

                      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="py-10 text-center text-slate-400 text-xs">
                            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                            Hiện tại chưa có thông báo nào
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const isUnread = !n.dread;
                            const notifTime = n.created_at 
                              ? new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(n.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                              : '';
                            return (
                              <div 
                                key={n.mathongbao}
                                onClick={() => handleNotificationClick(n)}
                                className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start gap-3 ${
                                  isUnread ? 'bg-emerald-50/40' : ''
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  n.loaithongbao === 'REMINDER' ? 'bg-rose-100 text-rose-600' :
                                  n.loaithongbao === 'BOOKING' ? 'bg-emerald-100 text-emerald-600' :
                                  n.loaithongbao === 'COMMISSION' ? 'bg-purple-100 text-purple-600' :
                                  n.loaithongbao === 'AUTO_COMPLETE' ? 'bg-blue-100 text-blue-600' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {n.loaithongbao === 'REMINDER' ? <AlertTriangle className="w-4 h-4" /> :
                                   n.loaithongbao === 'BOOKING' ? <Calendar className="w-4 h-4" /> :
                                   n.loaithongbao === 'COMMISSION' ? <DollarSign className="w-4 h-4" /> :
                                   n.loaithongbao === 'AUTO_COMPLETE' ? <Clock className="w-4 h-4" /> :
                                   <Bell className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <h4 className={`text-xs truncate ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                                      {n.tieude}
                                    </h4>
                                    {isUnread && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>}
                                  </div>
                                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                                    {n.noidung}
                                  </p>
                                  {notifTime && (
                                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                                      {notifTime}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* AVATAR & DROPDOWN MENU */}
                <div className="relative">
                  <div 
                    className="flex items-center gap-2 pl-2 border-l border-slate-200 cursor-pointer select-none" 
                    onClick={() => setShowDropdown(!showDropdown)}
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden xl:block text-left text-xs leading-tight">
                      <div className="font-bold text-slate-800">{displayName}</div>
                      <div className="text-[10px] text-emerald-600 font-medium font-mono">{userRole}</div>
                    </div>
                  </div>

                  {/* Dropdown Menu */}
                  {showDropdown && (
                    <div className="absolute right-0 mt-3 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
                      <button 
                        onClick={() => { setShowDropdown(false); navigate('/profile'); }}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold transition"
                      >
                        <User className="w-4 h-4 text-emerald-600" /> Thông tin cá nhân
                      </button>

                      {userRole === 'CHUSAN' && (
                        <button 
                          onClick={() => { setShowDropdown(false); navigate('/owner'); }}
                          className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold transition"
                        >
                          <Building2 className="w-4 h-4 text-amber-500" /> Bảng quản lý sân
                        </button>
                      )}

                      {userRole === 'ADMIN' && (
                        <button 
                        onClick={() => { setShowDropdown(false); navigate('/admin'); }}
                          className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold transition"
                        >
                          <Shield className="w-4 h-4 text-rose-500" /> Trang quản trị Admin
                        </button>
                      )}

                      <div className="h-px bg-slate-100 my-1"></div>
                      
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition"
                      >
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button 
                onClick={typeof onLoginClick === 'function' ? onLoginClick : () => setShowInternalLoginModal(true)} 
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm transition"
              >
                <LogIn className="w-4 h-4" /> Đăng nhập
              </button>
            )}
          </div>
        </div>
        
        {/* SUB NAV */}
        <div className="border-t border-slate-100 bg-white">
          <div className="max-w-[1440px] mx-auto px-6 h-11 flex items-center justify-between text-xs font-semibold">
            <nav className="flex items-center space-x-8">
              <Link to="/" className="text-emerald-600 border-b-2 border-emerald-600 py-3 font-bold">Trang Chủ</Link>
              <a href="#matrix-section" className="text-slate-600 hover:text-emerald-600 py-3 transition">Lưới Khung Giờ Real-time</a>
              <a href="#venues-section" className="text-slate-600 hover:text-emerald-600 py-3 transition">Danh Sách Cụm Sân</a>
            </nav>
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono font-bold text-slate-800">{timeFormatted}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 text-[11px]">{dateFormatted}</span>
            </div>
          </div>
        </div>
      </header>

      {/* FLOATING REALTIME TOAST BANNER */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-emerald-300 p-4 flex items-start gap-3 shadow-emerald-500/10">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 mt-0.5">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-slate-900">{activeToast.tieude}</div>
            <div className="text-[11px] text-slate-600 mt-1 leading-snug">{activeToast.noidung}</div>
          </div>
          <button onClick={() => setActiveToast(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL ĐĂNG NHẬP CHUẨN TOÀN HỆ THỐNG */}
      <LoginModal
        isOpen={showInternalLoginModal}
        onClose={() => setShowInternalLoginModal(false)}
        onSuccess={(loggedInUser) => {
          if (typeof setUser === 'function') setUser(loggedInUser);
          setShowInternalLoginModal(false);
        }}
      />
    </>
  );
}
