import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Users, Building2, CheckCircle2, XCircle, 
  RefreshCw, MapPin, Tag, UserCheck, Search, DollarSign, Eye, X, Award, CheckSquare,
  AlertTriangle, ShieldAlert, ArrowRight, Bell, Lock, LogOut, ArrowLeft, Loader2,
  Clock, CreditCard, Shield
} from 'lucide-react';
import { 
  fetchAdminOverview, 
  updateAdminFieldStatus, 
  updateAdminUserRole, 
  sendNotification, 
  broadcastAuthChange,
  fetchAdminDeposits,
  verifyAdminDeposit,
  settleAdminDepositRefund,
  fetchAdminRefunds,
  resolveAdminRefundDispute
} from '../supabaseClient';
import Header from '../components/Header';
import LoginModal from '../components/LoginModal';
import NotFound from './NotFound';

const parseMeta = (ghichu) => {
  try { return JSON.parse(ghichu || '{}'); } catch { return {}; }
};

export default function AdminDashboard({ user, setUser }) {
  const [currentUser, setCurrentUser] = useState(() => {
    if (user) return user;
    try {
      const savedUser = sessionStorage.getItem('datsan_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user !== undefined) setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    const handleAuthChange = (e) => {
      setCurrentUser(e.detail !== undefined ? e.detail : null);
    };
    window.addEventListener('datsan_auth_change', handleAuthChange);
    return () => window.removeEventListener('datsan_auth_change', handleAuthChange);
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    return tabParam && ['PENDING_FIELDS', 'ALL_FIELDS', 'USERS', 'DEPOSITS', 'REFUNDS'].includes(tabParam) ? tabParam : 'PENDING_FIELDS';
  });

  useEffect(() => {
    const tabParam = new URLSearchParams(location.search).get('tab');
    if (tabParam && ['PENDING_FIELDS', 'ALL_FIELDS', 'USERS', 'DEPOSITS', 'REFUNDS'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);
  const [userRoleFilter, setUserRoleFilter] = useState('ALL'); // ALL | KHACHHANG | CHUSAN
  const [loading, setLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // States Dữ Liệu
  const [sanList, setSanList] = useState([]);
  const [userList, setUserList] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [totalSystemRevenue, setTotalSystemRevenue] = useState(0);
  const [revenueStats, setRevenueStats] = useState({
    totalGMV: 0,
    qrCommission: 0,
    cashCommissionSettled: 0,
    cashCommissionPending: 0
  });

  // FEATURE 01: States Quản lý Ký Quỹ Chủ Sân
  const [depositsList, setDepositsList] = useState([]);
  const [pendingDepositRequests, setPendingDepositRequests] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState(false);

  // FEATURE 02: States Quản lý Hoàn Tiền & Tranh Chấp
  const [adminRefunds, setAdminRefunds] = useState([]);
  const [adminOverdueRefunds, setAdminOverdueRefunds] = useState([]);
  const [adminDisputes, setAdminDisputes] = useState([]);
  const [loadingAdminRefunds, setLoadingAdminRefunds] = useState(false);
  const [isResolvingDispute, setIsResolvingDispute] = useState(false);

  // Helper định dạng tiền tệ an toàn (chống hiển thị NaN đ hoặc giấu lỗi bằng 0đ)
  const formatMoneySafe = (val) => {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
      return 'Chưa xác định';
    }
    return `${Number(val).toLocaleString('vi-VN')} đ`;
  };

  // States Tìm Kiếm & Modal
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFieldDetail, setSelectedFieldDetail] = useState(null); // Modal Xem Chi Tiết Sân
  const [ownerFieldsModal, setOwnerFieldsModal] = useState({ show: false, ownerName: '', fields: [] }); // Modal Sân của Chủ Sân
  const [confirmRoleModal, setConfirmRoleModal] = useState({
    show: false,
    user: null,
    targetRole: '',
    fieldCount: 0,
    isSubmitting: false
  }); // Modal Xác Nhận Đổi Phân Quyền

  // Tải dữ liệu Admin bảo mật từ server endpoint /api/admin/overview
  const fetchAdminData = async () => {
    const role = (currentUser?.VaiTro || currentUser?.vaitro || '').toUpperCase();
    if (!currentUser || role !== 'ADMIN') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetchAdminOverview();
      const overview = res?.data || {};
      const fields = overview.fields || [];
      const users = overview.users || [];
      const bookings = overview.bookings || [];

      setIsSessionExpired(false);
      setUserList(users);
      setSanList(fields);
      setAllBookings(bookings);
      setBookingCount(bookings.length);

      let totalGMV = 0;
      let qrCommission = 0;
      let cashCommissionSettled = 0;
      let cashCommissionPending = 0;

      bookings.forEach(item => {
        const amount = Number(item.tongtien || item.TongTien || 0);
        const status = item.trangthai || item.TrangThai;
        const meta = parseMeta(item.ghichu || item.GhiChu);
        const method = meta.paymentMethod || (status === 'CHO_THI_DAU' ? 'TIEN_MAT' : 'QR');
        const commission = Number(meta.commissionAmount || Math.round(amount * 0.1));

        if (status !== 'DA_HUY' && status !== 'DAHUY') {
          totalGMV += amount;
        }

        if (method === 'QR' && (status === 'DA_THANH_TOAN' || status === 'HOAN_THANH' || status === 'HOANTHANH' || status === 'DACANCOC')) {
          qrCommission += commission;
        } else if (method === 'TIEN_MAT') {
          if (meta.commissionStatus === 'DA_QUYET_TOAN') {
            cashCommissionSettled += commission;
          } else if (meta.commissionStatus === 'CHO_CHUSAN_NOP') {
            cashCommissionPending += commission;
          }
        }
      });

      setTotalSystemRevenue(totalGMV);
      setRevenueStats({
        totalGMV,
        qrCommission,
        cashCommissionSettled,
        cashCommissionPending
      });

    } catch (err) {
      console.error('Lỗi tải dữ liệu Admin:', err);
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        setIsSessionExpired(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Tải danh sách Ký Quỹ Chủ Sân (FEATURE 01)
  const fetchAdminDepositsData = async () => {
    try {
      setLoadingDeposits(true);
      const res = await fetchAdminDeposits();
      if (res?.deposits) setDepositsList(res.deposits);
      if (res?.pendingRequests) setPendingDepositRequests(res.pendingRequests);
    } catch (err) {
      console.warn('Lỗi tải danh sách ký quỹ:', err);
    } finally {
      setLoadingDeposits(false);
    }
  };

  // Tải danh sách Hoàn Tiền & Tranh Chấp (FEATURE 02)
  const fetchAdminRefundsData = async () => {
    try {
      setLoadingAdminRefunds(true);
      const res = await fetchAdminRefunds();
      if (res?.allRefunds) setAdminRefunds(res.allRefunds);
      if (res?.overdueRefunds) setAdminOverdueRefunds(res.overdueRefunds);
      if (res?.disputes) setAdminDisputes(res.disputes);
    } catch (err) {
      console.warn('Lỗi tải danh sách hoàn tiền:', err);
    } finally {
      setLoadingAdminRefunds(false);
    }
  };

  useEffect(() => {
    const role = (currentUser?.VaiTro || currentUser?.vaitro || '').toUpperCase();
    if (currentUser && role === 'ADMIN') {
      fetchAdminData();
      fetchAdminDepositsData();
      fetchAdminRefundsData();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  // Admin Xác minh nhận tiền Ký Quỹ & Phê duyệt (FEATURE 01)
  const handleVerifyDeposit = async (transactionId, isApproved) => {
    let notes = isApproved ? 'Admin xác nhận đã nhận 1.000.000đ qua ngân hàng' : '';
    if (!isApproved) {
      const input = window.prompt('Nhập lý do từ chối yêu cầu ký quỹ:', 'Không tìm thấy giao dịch ngân hàng khớp nội dung');
      if (input === null) return;
      notes = input.trim() || 'Giao dịch không khớp';
    }

    try {
      setIsVerifyingDeposit(true);
      const res = await verifyAdminDeposit({ transactionId, isApproved, notes });
      if (res?.success) {
        alert(isApproved ? '✅ Đã xác minh nhận tiền ký quỹ & kích hoạt Chủ Sân thành công!' : 'Đã từ chối yêu cầu.');
        fetchAdminDepositsData();
        fetchAdminData();
      } else {
        alert('Lỗi: ' + (res?.error || 'Thao tác thất bại'));
      }
    } catch (err) {
      alert('Lỗi xác minh: ' + err.message);
    } finally {
      setIsVerifyingDeposit(false);
    }
  };

  // Admin Giải quyết Tranh Chấp Hoàn Tiền (FEATURE 02)
  const handleResolveDispute = async (refundId, resolution) => {
    const confirmMsg = resolution === 'PLATFORM_ESCROW_DEDUCTION'
      ? 'XÁC NHẬN: Trừ 100% tiền hoàn từ Khoản Ký Quỹ (1.000.000đ) của Chủ Sân để hoàn trả Khách Hàng?'
      : 'XÁC NHẬN: Bác bỏ khiếu nại của khách (Chủ sân đã chuyển khoản đúng & hợp lệ)?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsResolvingDispute(true);
      const res = await resolveAdminRefundDispute(refundId, {
        resolution,
        notes: resolution === 'PLATFORM_ESCROW_DEDUCTION'
          ? 'Admin quyết định trừ quỹ bảo đảm của chủ sân bồi hoàn cho khách'
          : 'Admin bác bỏ khiếu nại sau khi đối soát bằng chứng chuyển tiền'
      });

      if (res?.success) {
        alert('✅ Đã xử lý tranh chấp hoàn tiền thành công!');
        fetchAdminRefundsData();
        fetchAdminDepositsData();
      } else {
        alert('Lỗi: ' + (res?.error || 'Thao tác thất bại'));
      }
    } catch (err) {
      alert('Lỗi giải quyết: ' + err.message);
    } finally {
      setIsResolvingDispute(false);
    }
  };

  // Gửi thông báo nhắc nộp hoa hồng cho Chủ Sân
  const handleSendDebtReminder = async (owner, debtAmount, isOverdue) => {
    try {
      const title = debtAmount > 0 
        ? `⚠️ Nhắc nộp hoa hồng sàn DatSanOnline ${isOverdue ? '(Quá hạn 1 tuần)' : ''}`
        : `📢 Thông báo từ Ban Quản Trị sàn DatSanOnline`;
      const content = debtAmount > 0
        ? `Chào ${owner.hoten}, bạn đang có khoản nợ hoa hồng 10% các đơn tiền mặt là ${debtAmount.toLocaleString('vi-VN')} đ ${isOverdue ? '(Đã quá hạn hơn 7 ngày)' : ''}. Vui lòng truy cập trang Quản Lý Sân và quét mã VietQR để nộp hoa hồng cho sàn.`
        : `Chào ${owner.hoten}, Ban Quản Trị DatSanOnline gửi lời chào và nhắc nhở bạn duy trì chất lượng phục vụ sân thể thao.`;

      await sendNotification({
        manguoidung: owner.manguoidung,
        tieude: title,
        noidung: content,
        loaithongbao: 'REMINDER'
      });

      alert(`✅ Đã gửi thông báo nhắc nợ thành công tới chủ sân ${owner.hoten}!`);
    } catch (err) {
      alert('Không thể gửi thông báo: ' + err.message);
    }
  };

  // Xử lý Duyệt / Khóa sân bãi (Gọi endpoint backend an toàn & có lý do)
  const handleUpdateFieldStatus = async (maSan, newStatus) => {
    let reason = '';
    if (newStatus === 'TU_CHOI') {
      const inputReason = window.prompt('Nhập lý do từ chối phê duyệt hồ sơ sân:', 'Hồ sơ chưa đạt tiêu chuẩn kiểm duyệt của sàn');
      if (inputReason === null) return;
      reason = inputReason.trim() || 'Hồ sơ chưa đạt tiêu chuẩn';
    } else if (newStatus === 'KHOA' || newStatus === 'TAM_DUNG') {
      const inputReason = window.prompt('Nhập lý do tạm dừng/tạm khóa sân:', 'Bảo trì sân hoặc vi phạm chính sách vận hành');
      if (inputReason === null) return;
      reason = inputReason.trim() || 'Tạm dừng vận hành theo yêu cầu quản trị';
    }

    try {
      await updateAdminFieldStatus(maSan, newStatus, reason);
      alert(`Đã cập nhật trạng thái sân thành: ${newStatus}`);
      if (selectedFieldDetail?.masan === maSan) {
        setSelectedFieldDetail(prev => ({ ...prev, trangthai: newStatus }));
      }
      fetchAdminData();
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  // Yêu cầu Đổi Vai Trò Người Dùng (Mở Modal Xác Nhận)
  const handleRequestRoleChange = (user, targetRole, fieldCount = 0) => {
    if (user.vaitro === targetRole) return;
    setConfirmRoleModal({
      show: true,
      user,
      targetRole,
      fieldCount,
      isSubmitting: false
    });
  };

  // Xác Nhận Cập Nhật Vai Trò Người Dùng trong Modal (Gọi endpoint backend)
  const handleConfirmRoleChange = async () => {
    if (!confirmRoleModal.user || !confirmRoleModal.targetRole) return;
    try {
      setConfirmRoleModal(prev => ({ ...prev, isSubmitting: true }));
      await updateAdminUserRole(confirmRoleModal.user.manguoidung, confirmRoleModal.targetRole);
      alert(`Đã cập nhật vai trò của tài khoản "${confirmRoleModal.user.hoten}" thành: ${confirmRoleModal.targetRole}`);
      setConfirmRoleModal({ show: false, user: null, targetRole: '', fieldCount: 0, isSubmitting: false });
      fetchAdminData();
    } catch (err) {
      alert('Lỗi đổi vai trò: ' + err.message);
      setConfirmRoleModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Mở modal xem danh sách sân của 1 chủ sân
  const handleViewOwnerFields = (ownerId, ownerName) => {
    const fields = sanList.filter(s => s.machusan === ownerId);
    setOwnerFieldsModal({
      show: true,
      ownerName: ownerName || 'Chủ Sân',
      fields: fields
    });
  };

  // Lọc sân chờ duyệt & đang hoạt động
  const pendingFields = sanList.filter(s => s.trangthai === 'CHO_DUYET');
  const activeFields = sanList.filter(s => s.trangthai === 'HOATDONG');

  // Lọc người dùng theo từ khóa tìm kiếm & Tab phân loại
  const filteredUsers = userList.filter(u => {
    const roleMatch = userRoleFilter === 'ALL' || u.vaitro === userRoleFilter;
    const nameMatch = (u.hoten || '').toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = (u.sodienthoai || '').includes(searchTerm);
    return roleMatch && (nameMatch || emailMatch || phoneMatch);
  });

  // Lọc tất cả sân theo từ khóa tìm kiếm
  const filteredFields = sanList.filter(s => 
    (s.tensan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.nguoidung?.hoten || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const userRole = (currentUser?.VaiTro || currentUser?.vaitro || '').toUpperCase();

  // NẾU CHƯA ĐĂNG NHẬP HOẶC KHÔNG PHẢI SUPER ADMIN -> RENDER TRANG 404 TRUNG TÍNH (ZERO DATA LEAKED)
  if (!currentUser || userRole !== 'ADMIN') {
    return <NotFound user={currentUser} setUser={setUser} />;
  }

  // ADMIN ĐANG TẢI DỮ LIỆU TỪ SERVER
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col">
        <Header user={currentUser} setUser={setUser} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-600">Đang tải trung tâm quản trị tối cao...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-16">
      <Header user={currentUser} setUser={setCurrentUser} onLoginClick={() => setShowLoginModal(true)} />

      <main className="max-w-[1440px] mx-auto px-6 pt-8">
        
        {/* HEADER ADMIN */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>HỆ THỐNG QUẢN TRỊ TỐI CAO (SUPER ADMIN)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Trung Tâm Kiểm Duyệt & Quản Lý System
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchAdminData}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Làm mới dữ liệu
            </button>
          </div>
        </div>

        {/* BANNER CHẾ ĐỘ MÔ PHỎNG TÀI CHÍNH (DEMO FINANCIAL MODE) */}
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-emerald-500/10 border-2 border-amber-400/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shrink-0">
              ⚡
            </div>
            <div>
              <div className="text-sm font-black text-amber-950 flex items-center gap-2">
                KHU VỰC QUẢN TRỊ TÀI CHÍNH MÔ PHỎNG (DEMO FINANCIAL MODE)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                  SIMULATION ACTIVE
                </span>
              </div>
              <div className="text-xs text-amber-900/80 mt-0.5">
                Mọi giao dịch ký quỹ, hoàn tiền, công nợ hoa hồng 10% và chuyển khoản đều được giả lập an toàn trên hệ thống. Không có luồng tiền thật.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-xl shrink-0">
            <span>STAGING / DEMO</span>
          </div>
        </div>

        {/* BANNER CẢNH BÁO HẾT HẠN PHIÊN */}
        {isSessionExpired && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold text-amber-900">Phiên quản trị viên đã hết hạn hoặc bị thu hồi</div>
                <div className="text-xs text-amber-700">
                  Vui lòng đăng nhập lại để làm mới phiên làm việc Super Admin.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow transition whitespace-nowrap"
            >
              🔑 Đăng Nhập Lại
            </button>
          </div>
        )}

        {/* THỐNG KÊ KPI SYSTEM + DOANH THU SÀN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cụm Sân Chờ Duyệt</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                {pendingFields.length}
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600">{pendingFields.length} <span className="text-xs text-slate-400">hồ sơ</span></div>
            <p className="text-[11px] text-slate-500 mt-1">Yêu cầu từ chủ sân mới</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sân Đang Vận Hành</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                {activeFields.length}
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700">{activeFields.length} <span className="text-xs text-slate-400">cụm sân</span></div>
            <p className="text-[11px] text-slate-500 mt-1">Đã duyệt hoạt động</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Người Dùng</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                {userList.length}
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">{userList.length} <span className="text-xs text-slate-400">tài khoản</span></div>
            <p className="text-[11px] text-slate-500 mt-1">Khách hàng, Chủ sân & Admin</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lượt Đặt Toàn Sàn</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                {bookingCount}
              </div>
            </div>
            <div className="text-2xl font-black text-purple-700">{bookingCount} <span className="text-xs text-slate-400">lượt</span></div>
            <p className="text-[11px] text-slate-500 mt-1">Giao dịch thành công</p>
          </div>

          {/* Ô THỐNG KÊ DOANH THU ADMIN/HOA HỒNG SÀN */}
          <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-2xl p-5 shadow-md border border-emerald-900 col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Doanh Thu Hoa Hồng (10% Demo)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-amber-400">
              {(revenueStats.qrCommission + revenueStats.cashCommissionSettled).toLocaleString('vi-VN')} đ
            </div>
            <div className="mt-2 pt-2 border-t border-emerald-700/50 space-y-1 text-[10px]">
              <div className="flex justify-between text-emerald-200">
                <span>• Đã thu tự động (QR):</span>
                <span className="font-bold text-white">{revenueStats.qrCommission.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-emerald-200">
                <span>• Chủ sân đã nộp (Tiền mặt):</span>
                <span className="font-bold text-white">{revenueStats.cashCommissionSettled.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-amber-300 font-bold">
                <span>• Sổ nợ chủ sân chưa nộp:</span>
                <span>{revenueStats.cashCommissionPending.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTAINER TABS */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 bg-slate-50/50 px-6 pt-4 gap-4">
            
            {/* TABS CHÍNH */}
            <div className="flex items-center gap-6 overflow-x-auto">
              <button
                onClick={() => { setActiveTab('PENDING_FIELDS'); setSearchTerm(''); }}
                className={`pb-4 text-xs font-extrabold transition relative whitespace-nowrap ${
                  activeTab === 'PENDING_FIELDS' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Hồ Sơ Sân Chờ Duyệt ({pendingFields.length})
              </button>

              <button
                onClick={() => { setActiveTab('ALL_FIELDS'); setSearchTerm(''); }}
                className={`pb-4 text-xs font-extrabold transition relative whitespace-nowrap ${
                  activeTab === 'ALL_FIELDS' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tất Cả Cụm Sân ({sanList.length})
              </button>

              <button
                onClick={() => { setActiveTab('USERS'); setSearchTerm(''); }}
                className={`pb-4 text-xs font-extrabold transition relative whitespace-nowrap ${
                  activeTab === 'USERS' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Quản Lý Người Dùng ({userList.length})
              </button>

              <button
                onClick={() => { setActiveTab('DEPOSITS'); setSearchTerm(''); }}
                className={`pb-4 text-xs font-extrabold transition relative whitespace-nowrap ${
                  activeTab === 'DEPOSITS' ? 'text-purple-600 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ký Quỹ Chủ Sân (Demo) ({pendingDepositRequests.length > 0 ? `Chờ duyệt: ${pendingDepositRequests.length}` : depositsList.length})
              </button>

              <button
                onClick={() => { setActiveTab('REFUNDS'); setSearchTerm(''); }}
                className={`pb-4 text-xs font-extrabold transition relative whitespace-nowrap ${
                  activeTab === 'REFUNDS' ? 'text-rose-600 border-b-2 border-rose-500' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Hoàn Tiền & Tranh Chấp (Demo) ({adminDisputes.length > 0 ? `Tranh chấp: ${adminDisputes.length}` : adminRefunds.length})
              </button>
            </div>

            {/* Ô TÌM KIẾM NẠP TẠI TRANG ADMIN */}
            {(activeTab === 'ALL_FIELDS' || activeTab === 'USERS') && (
              <div className="pb-3 sm:pb-4 w-full sm:w-72">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={activeTab === 'USERS' ? "Tìm theo tên, email, SĐT..." : "Tìm tên sân, chủ sân..."}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 transition shadow-sm"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3" />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-2 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            
            {/* TAB 1: SÂN CHỜ DUYỆT */}
            {activeTab === 'PENDING_FIELDS' && (
              <div>
                {loading ? (
                  <div className="py-12 text-center text-xs font-bold text-emerald-600">Đang tải dữ liệu hồ sơ...</div>
                ) : pendingFields.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-60" />
                    <p className="text-xs font-bold text-slate-600">Hiện tại không có hồ sơ sân nào cần duyệt!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pendingFields.map((san) => (
                      <div key={san.masan} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden p-5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full">
                              CHỜ ADMIN DUYỆT
                            </span>
                            <span className="text-xs font-black text-rose-600">
                              {Number(san.giasan).toLocaleString('vi-VN')}đ / 1h
                            </span>
                          </div>

                          <div className="flex gap-4 mb-3">
                            <img 
                              src={san.hinhanh || 'https://images.unsplash.com/photo-1529900248057-5e632c63c574?auto=format&fit=crop&w=800&q=80'} 
                              alt={san.tensan}
                              className="w-24 h-24 object-cover rounded-xl border border-slate-200 shrink-0" 
                            />
                            <div>
                              <h4 className="font-extrabold text-base text-slate-900">{san.tensan}</h4>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin className="w-3.5 h-3.5" /> {san.vitri?.diachi}, Q. {san.vitri?.quan}
                              </p>
                              <p className="text-xs text-slate-600 mt-2 font-medium">
                                Chủ sân: <b className="text-slate-900">{san.nguoidung?.hoten || 'Chưa cập nhật'}</b> ({san.nguoidung?.sodienthoai})
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {Array.isArray(san.huyhieu) && san.huyhieu.map((h, i) => (
                              <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleUpdateFieldStatus(san.masan, 'TU_CHOI')}
                            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" /> Từ Chối
                          </button>
                          <button
                            onClick={() => handleUpdateFieldStatus(san.masan, 'HOATDONG')}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Duyệt Sân Hoạt Động
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TẤT CẢ CỤM SÂN (CLICK SÂN HIỆN MODAL DẠNG BẢNG CHI TIẾT) */}
            {activeTab === 'ALL_FIELDS' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Tên Sân Bãi</th>
                      <th className="py-3 px-4">Địa Chỉ</th>
                      <th className="py-3 px-4">Chủ Sân</th>
                      <th className="py-3 px-4">Giá / 1h</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFields.map((san) => (
                      <tr 
                        key={san.masan} 
                        className="hover:bg-slate-50/90 cursor-pointer transition"
                        onClick={() => setSelectedFieldDetail(san)} // CLICK VÀO HÀNG ĐỂ HIỆN MODAL BẢNG CHI TIẾT
                      >
                        <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-3">
                          <img src={san.hinhanh} alt="" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                          <span className="hover:text-emerald-700 font-extrabold flex items-center gap-1.5">
                            {san.tensan} <Eye className="w-3.5 h-3.5 text-slate-400 inline" />
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-600">{san.vitri?.diachi}, Q. {san.vitri?.quan}</td>
                        <td className="py-4 px-4 font-semibold text-slate-800">{san.nguoidung?.hoten || 'Khách hàng'}</td>
                        <td className="py-4 px-4 font-black text-rose-600">{Number(san.giasan).toLocaleString('vi-VN')} đ</td>
                        <td className="py-4 px-4">
                          {san.trangthai === 'HOATDONG' && <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">Đang hoạt động</span>}
                          {san.trangthai === 'CHO_DUYET' && <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">Chờ duyệt</span>}
                          {san.trangthai === 'TU_CHOI' && <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">Đã khóa / Từ chối</span>}
                        </td>
                        <td className="py-4 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                          {san.trangthai !== 'HOATDONG' ? (
                            <button
                              onClick={() => handleUpdateFieldStatus(san.masan, 'HOATDONG')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                            >
                              Kích Hoạt
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateFieldStatus(san.masan, 'TU_CHOI')}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                            >
                              Khóa Sân
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: QUẢN LÝ NGƯỜI DÙNG (PHÂN 2 BÊN KHÁCH HÀNG & CHỦ SÂN + THÊM CỘT SỐ SÂN) */}
            {activeTab === 'USERS' && (
              <div>
                {/* SUB FILTER PHÂN CHIA 2 BÊN KHÁCH HÀNG / CHỦ SÂN */}
                <div className="flex items-center gap-2 mb-4 bg-slate-100 p-1.5 rounded-xl w-fit">
                  <button
                    onClick={() => setUserRoleFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      userRoleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất Cả ({userList.length})
                  </button>
                  <button
                    onClick={() => setUserRoleFilter('KHACHHANG')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      userRoleFilter === 'KHACHHANG' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bên Khách Hàng ({userList.filter(u => u.vaitro === 'KHACHHANG').length})
                  </button>
                  <button
                    onClick={() => setUserRoleFilter('CHUSAN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      userRoleFilter === 'CHUSAN' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bên Chủ Sân ({userList.filter(u => u.vaitro === 'CHUSAN').length})
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-4">Họ Và Tên</th>
                        <th className="py-3 px-4">Email / SĐT</th>
                        <th className="py-3 px-4">Vai Trò</th>
                        <th className="py-3 px-4 text-center">Số Sân Đang Đăng Ký</th>
                        {userRoleFilter === 'CHUSAN' && (
                          <>
                            <th className="py-3 px-4 text-center">Nợ Hoa Hồng (10%)</th>
                            <th className="py-3 px-4 text-center">Nhắc Nợ / Thông Báo</th>
                          </>
                        )}
                        <th className="py-3 px-4 text-right">Phân Quyền Vai Trò</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => {
                        const ownerFields = sanList.filter(s => s.machusan === u.manguoidung);
                        const fieldCount = ownerFields.length;
                        const isDemotedOwner = fieldCount > 0 && u.vaitro !== 'CHUSAN';

                        // Tính nợ hoa hồng 10% từ các đơn tiền mặt đã hoàn thành nhưng chưa nộp
                        const ownerFieldIds = ownerFields.map(s => Number(s.masan));
                        const ownerBookings = allBookings.filter(b => ownerFieldIds.includes(Number(b.masan)));
                        const debtBookings = ownerBookings.filter(b => {
                          const meta = parseMeta(b.ghichu);
                          const isCash = meta.paymentMethod === 'TIEN_MAT' || b.trangthai === 'CHO_THI_DAU';
                          return (b.trangthai === 'HOAN_THANH' || b.trangthai === 'HOANTHANH') &&
                            isCash &&
                            meta.commissionStatus === 'CHO_CHUSAN_NOP';
                        });
                        const ownerDebt = debtBookings.reduce((sum, b) => {
                          const meta = parseMeta(b.ghichu);
                          return sum + Number(meta.commissionAmount || Math.round(Number(b.tongtien || 0) * 0.1));
                        }, 0);
                        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                        const nowTime = Date.now();
                        const isOverdueWeek = debtBookings.some(b => {
                          const bDate = new Date(b.ngaysudung || b.ngaydat || b.created_at).getTime();
                          return (nowTime - bDate) >= oneWeekMs;
                        });

                        return (
                          <tr key={u.manguoidung} className={`hover:bg-slate-50/60 transition ${isDemotedOwner ? 'bg-amber-50/30' : ''}`}>
                            <td className="py-4 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{u.hoten}</span>
                                {isDemotedOwner && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-black inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Sở hữu {fieldCount} sân
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-slate-600">
                              {u.email} <br/>
                              <span className="text-[11px] text-emerald-700 font-mono font-bold">{u.sodienthoai}</span>
                            </td>
                            <td className="py-4 px-4">
                              {u.vaitro === 'ADMIN' && <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">ADMIN</span>}
                              {u.vaitro === 'CHUSAN' && <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full">CHỦ SÂN</span>}
                              {u.vaitro === 'KHACHHANG' && <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full">KHÁCH HÀNG</span>}
                            </td>

                            {/* CỘT SỐ LƯỢNG SÂN ĐĂNG KÝ (NHẤP VÀO HIỆN SÂN) */}
                            <td className="py-4 px-4 text-center">
                              {fieldCount > 0 ? (
                                <button
                                  onClick={() => handleViewOwnerFields(u.manguoidung, u.hoten)}
                                  className={`px-3 py-1 font-black rounded-xl border transition inline-flex items-center gap-1.5 ${
                                    u.vaitro === 'CHUSAN'
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 ring-2 ring-rose-200'
                                  }`}
                                  title="Bấm để xem danh sách sân"
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                  <span>{fieldCount} sân</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 font-medium">0</span>
                              )}
                            </td>

                            {/* CỘT NỢ HOA HỒNG & NHẮC NỢ (CHO BÊN CHỦ SÂN) */}
                            {userRoleFilter === 'CHUSAN' && (
                              <>
                                <td className="py-4 px-4 text-center">
                                  {ownerDebt > 0 ? (
                                    <div className="flex flex-col items-center">
                                      <span className="font-black text-rose-600 text-xs">{ownerDebt.toLocaleString('vi-VN')} đ</span>
                                      {isOverdueWeek ? (
                                        <div className="flex flex-col items-center">
                                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-black inline-flex items-center gap-1 mt-1 shadow-xs animate-pulse">
                                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Quá hạn 1 tuần
                                          </span>
                                          <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                                            ✓ Tự động gửi nhắc
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-amber-700 font-semibold mt-0.5">Trong hạn</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-emerald-700 font-bold text-xs inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 0 đ
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <button
                                    onClick={() => handleSendDebtReminder(u, ownerDebt, isOverdueWeek)}
                                    className={`px-3 py-1.5 font-black text-[11px] rounded-xl border transition inline-flex items-center gap-1.5 ${
                                      ownerDebt > 0
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 ring-2 ring-rose-200 shadow-sm'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                    title={isOverdueWeek ? "Hệ thống đã tự động gửi nhắc nợ sau 1 tuần. Bấm để gửi nhắc nợ lại lần nữa" : "Gửi thông báo nhắc nợ"}
                                  >
                                    <Bell className="w-3.5 h-3.5 text-rose-600" />
                                    <span>{ownerDebt > 0 ? (isOverdueWeek ? 'Nhắc Lại' : 'Nhắc Nợ') : 'Gửi Thông Báo'}</span>
                                  </button>
                                </td>
                              </>
                            )}

                            {/* NÚT PHÂN QUYỀN VAI TRÒ */}
                            <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                              {/* Nút Khách Hàng */}
                              {u.vaitro === 'KHACHHANG' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-[10px] rounded-lg cursor-default shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-blue-600" /> Khách Hàng
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleRequestRoleChange(u, 'KHACHHANG', fieldCount)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition"
                                >
                                  Khách Hàng
                                </button>
                              )}

                              {/* Nút Chủ Sân */}
                              {u.vaitro === 'CHUSAN' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 font-extrabold text-[10px] rounded-lg cursor-default shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-amber-600" /> Chủ Sân
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleRequestRoleChange(u, 'CHUSAN', fieldCount)}
                                  className={`px-2.5 py-1 text-white font-bold text-[10px] rounded-lg transition ${
                                    isDemotedOwner
                                      ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-300 shadow font-black'
                                      : 'bg-amber-500 hover:bg-amber-600'
                                  }`}
                                  title={isDemotedOwner ? "Khôi phục lại quyền Chủ Sân cho tài khoản này" : "Cấp quyền Chủ Sân"}
                                >
                                  {isDemotedOwner ? '★ Khôi Phục Chủ Sân' : 'Chủ Sân'}
                                </button>
                              )}

                              {/* Nút Admin */}
                              {u.vaitro === 'ADMIN' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[10px] rounded-lg cursor-default shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-rose-600" /> Admin
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleRequestRoleChange(u, 'ADMIN', fieldCount)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition"
                                >
                                  Admin
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: QUẢN LÝ KÝ QUỸ CHỦ SÂN (FEATURE 01) */}
            {activeTab === 'DEPOSITS' && (
              <div className="space-y-6">
                {/* THỐNG KÊ QUỸ BẢO ĐẢM */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Tổng Chủ Sân Quản Lý</span>
                    <div className="text-xl font-black text-slate-900 mt-1">{depositsList.length} tài khoản</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Đã Ký Quỹ Hợp Lệ</span>
                    <div className="text-xl font-black text-emerald-600 mt-1">
                      {depositsList.filter(d => d.trangthai === 'HOP_LE').length} tài khoản
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Tổng Tiền Quỹ Nắm Giữ (Mô phỏng)</span>
                    <div className="text-xl font-black text-purple-700 mt-1">
                      {depositsList.reduce((acc, d) => acc + Number(d.sodu_hientai || 0), 0).toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Chờ Xác Minh Chuyển Khoản</span>
                    <div className="text-xl font-black text-amber-600 mt-1">
                      {pendingDepositRequests.length} yêu cầu
                    </div>
                  </div>
                </div>

                {/* KHỐI 1: YÊU CẦU NỘP KÝ QUỸ CHỜ XÁC MINH */}
                <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Yêu Cầu Nộp Ký Quỹ Chờ Đối Soát Ngân Hàng ({pendingDepositRequests.length})
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Kiểm tra tài khoản ngân hàng của sàn, đối soát đúng số tiền 1.000.000đ và nội dung trước khi duyệt.
                      </p>
                    </div>
                    <button
                      onClick={fetchAdminDepositsData}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingDeposits ? 'animate-spin' : ''}`} /> Làm mới
                    </button>
                  </div>

                  {pendingDepositRequests.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                      Không có yêu cầu nộp ký quỹ nào đang chờ duyệt.
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                            <th className="py-3 px-4">Mã GD</th>
                            <th className="py-3 px-4">Chủ Sân ID</th>
                            <th className="py-3 px-4">Số Tiền</th>
                            <th className="py-3 px-4">Nội Dung Chuyển Khoản</th>
                            <th className="py-3 px-4">Mã Tham Chiếu (Chủ sân gửi)</th>
                            <th className="py-3 px-4">Thời Gian</th>
                            <th className="py-3 px-4 text-right">Thao Tác Duyệt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {pendingDepositRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-bold text-slate-900">#{req.id}</td>
                              <td className="py-3 px-4 font-bold text-amber-700">Chủ Sân #{req.machusan}</td>
                              <td className="py-3 px-4 font-black text-emerald-600">
                                {Number(req.sotien).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] bg-slate-50 px-2 rounded">
                                {req.noi_dung_chuyen_khoan}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-700">
                                {req.bank_tx_id || 'Chưa cung cấp'}
                              </td>
                              <td className="py-3 px-4 text-[11px] text-slate-500">
                                {new Date(req.created_at).toLocaleString('vi-VN')}
                              </td>
                              <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                                <button
                                  disabled={isVerifyingDeposit}
                                  onClick={() => handleVerifyDeposit(req.id, true)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                                >
                                  ✓ Xác nhận đã nhận tiền & Duyệt
                                </button>
                                <button
                                  disabled={isVerifyingDeposit}
                                  onClick={() => handleVerifyDeposit(req.id, false)}
                                  className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold text-xs rounded-xl transition"
                                >
                                  ✕ Từ chối
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* KHỐI 2: TOÀN BỘ DANH SÁCH TÀI KHOẢN KÝ QUỸ */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h4 className="font-extrabold text-sm text-slate-900 mb-3">
                    Danh Sách Tài Khoản Ký Quỹ Toàn Hệ Thống ({depositsList.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                          <th className="py-3 px-4">Chủ Sân ID</th>
                          <th className="py-3 px-4">Số Dư Quỹ Hiện Tại</th>
                          <th className="py-3 px-4">Trạng Thái Ký Quỹ</th>
                          <th className="py-3 px-4">Phân Loại Chính Sách</th>
                          <th className="py-3 px-4">Ngày Cập Nhật</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {depositsList.map((dp) => (
                          <tr key={dp.makyquy || dp.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">Chủ Sân #{dp.machusan}</td>
                            <td className="py-3 px-4 font-black text-emerald-700">
                              {formatMoneySafe(dp.sodu_hientai)}
                            </td>
                            <td className="py-3 px-4">
                              {dp.trangthai === 'HOP_LE' && (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                                  ✓ Hợp lệ (1.000.000đ)
                                </span>
                              )}
                              {dp.trangthai === 'CHO_XAC_MINH' && (
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                                  ⏳ Chờ xác minh
                                </span>
                              )}
                              {dp.trangthai === 'CHUA_KY_QUY' && (
                                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                                  ✕ Chưa ký quỹ (Khóa nhận đơn)
                                </span>
                              )}
                              {dp.trangthai === 'DA_HOAN' && (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                                  Đã tất toán hoàn trả
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {dp.is_legacy ? (
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                  Chủ sân hiện hữu (Di sản)
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  Chủ sân mới
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-500">
                              {new Date(dp.updated_at).toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: QUẢN LÝ HOÀN TIỀN & TRANH CHẤP (FEATURE 02) */}
            {activeTab === 'REFUNDS' && (
              <div className="space-y-6">
                {/* THỐNG KÊ HOÀN TIỀN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Tổng Yêu Cầu Hoàn Tiền</span>
                    <div className="text-xl font-black text-slate-900 mt-1">{adminRefunds.length} đơn</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Chờ Chủ Sân Chuyển</span>
                    <div className="text-xl font-black text-amber-600 mt-1">
                      {adminRefunds.filter(r => r.trangthai === 'CHO_HOAN').length} đơn
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Quá Hạn 24 Giờ</span>
                    <div className="text-xl font-black text-rose-600 mt-1">
                      {adminOverdueRefunds.length} đơn
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Khiếu Nại Tranh Chấp</span>
                    <div className="text-xl font-black text-purple-700 mt-1">
                      {adminDisputes.length} vụ
                    </div>
                  </div>
                </div>

                {/* KHỐI 1: TRANH CHẤP CẦN ADMIN CAN THIỆP */}
                {adminDisputes.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
                    <h4 className="font-extrabold text-sm text-rose-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Tranh Chấp Hoàn Tiền Đang Mở ({adminDisputes.length})
                    </h4>
                    <p className="text-xs text-rose-700 mb-4">
                      Khách hàng khiếu nại chưa nhận được tiền hoàn hoặc có sai lệch. Admin có thẩm quyền trừ trực tiếp từ Khoản Ký Quỹ 1.000.000đ của Chủ Sân để bồi hoàn cho Khách.
                    </p>

                    <div className="space-y-3">
                      {adminDisputes.map((dp) => {
                        const disputeId = dp.mahoantien || dp.id;
                        const disputeAmount = dp.sotien_canhoan ?? dp.sotien_hoan;
                        const receiverName = dp.chutaikhoan_nhan || dp.tentaikhoan_nhan || '—';
                        const ownerTxId = dp.magiaodich_owner || dp.chusan_nganhang_txid || 'Không có';
                        const disputeReason = dp.lydo_tranhchap || dp.khieunai_lydo || 'Chưa nhận được tiền';

                        return (
                        <div key={disputeId} className="bg-white rounded-xl border border-rose-200 p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div>
                              <span className="text-xs font-black text-slate-900">Yêu cầu hoàn tiền #{disputeId} (Đơn #{dp.madatsan})</span>
                              <span className="ml-2 text-xs text-slate-500">Chủ sân #{dp.machusan} • Khách #{dp.makhachhang}</span>
                            </div>
                            <div className="text-sm font-black text-rose-600">
                              Số tiền: {formatMoneySafe(disputeAmount)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-lg">
                              <span className="font-bold text-slate-500 block text-[10px]">Lý do khách khiếu nại:</span>
                              <p className="font-medium text-slate-800 mt-0.5">{disputeReason}</p>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg">
                              <span className="font-bold text-slate-500 block text-[10px]">Tài khoản thụ hưởng:</span>
                              <p className="font-medium text-slate-800 mt-0.5">{dp.nganhang_nhan || 'MB Bank'} - {dp.sotaikhoan_nhan || '—'} ({receiverName})</p>
                              <span className="text-[10px] text-slate-400">Mã GD chủ sân gửi: {ownerTxId}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              disabled={isResolvingDispute}
                              onClick={() => handleResolveDispute(disputeId, 'PLATFORM_ESCROW_DEDUCTION')}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                            >
                              ⚡ Trừ Quỹ Ký Quỹ Chủ Sân Bồi Hoàn Khách
                            </button>
                            <button
                              disabled={isResolvingDispute}
                              onClick={() => handleResolveDispute(disputeId, 'DISMISS_DISPUTE')}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                            >
                              Bác Bỏ Khiếu Nại
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}

                {/* KHỐI 2: TOÀN BỘ DANH SÁCH HOÀN TIỀN */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-extrabold text-sm text-slate-900">
                      Toàn Bộ Lịch Sử Hoàn Tiền ({adminRefunds.length})
                    </h4>
                    <button
                      onClick={fetchAdminRefundsData}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingAdminRefunds ? 'animate-spin' : ''}`} /> Làm mới
                    </button>
                  </div>

                  {adminRefunds.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-slate-400">
                      Chưa có đơn hoàn tiền nào trong hệ thống.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                            <th className="py-3 px-4">Mã Đơn / Yêu Cầu</th>
                            <th className="py-3 px-4">Chủ Sân / Khách Hàng</th>
                            <th className="py-3 px-4">Số Tiền Hoàn (100%)</th>
                            <th className="py-3 px-4">Tài Khoản Nhận</th>
                            <th className="py-3 px-4">Hạn Xử Lý (24h)</th>
                            <th className="py-3 px-4">Trạng Thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {adminRefunds.map((rf) => {
                            const refundId = rf.mahoantien || rf.id;
                            const refundAmount = rf.sotien_canhoan ?? rf.sotien_hoan;
                            const receiverName = rf.chutaikhoan_nhan || rf.tentaikhoan_nhan || '—';
                            const isOverdue = (rf.trangthai === 'CHO_HOAN' || rf.trangthai === 'QUA_HAN') && new Date(rf.han_xuly) < new Date();
                            return (
                              <tr key={refundId} className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <span className="font-bold text-slate-900">Đơn #{rf.madatsan}</span>
                                  <div className="text-[10px] text-slate-400">YC #{refundId}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800">Chủ sân #{rf.machusan}</div>
                                  <div className="text-[10px] text-slate-500">Khách #{rf.makhachhang}</div>
                                </td>
                                <td className="py-3 px-4 font-black text-rose-600">
                                  {formatMoneySafe(refundAmount)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800">{rf.nganhang_nhan || 'MB Bank'} - {rf.sotaikhoan_nhan || '—'}</div>
                                  <div className="text-[10px] text-slate-500">{receiverName}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className={`text-[11px] font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                                    {new Date(rf.han_xuly).toLocaleString('vi-VN')}
                                  </div>
                                  {isOverdue && (
                                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                                      Quá hạn 24h
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {rf.trangthai === 'CHO_HOAN' && (
                                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                                      ⏳ Chờ chủ sân chuyển
                                    </span>
                                  )}
                                  {rf.trangthai === 'DA_CHUYEN' && (
                                    <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                                      Chủ sân đã chuyển
                                    </span>
                                  )}
                                  {rf.trangthai === 'DA_NHAN' && (
                                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                                      ✓ Đã hoàn tất 100%
                                    </span>
                                  )}
                                  {rf.trangthai === 'TRANH_CHAP' && (
                                    <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                                      ⚠️ Tranh chấp
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* ==================== MODAL 1: BẢNG CHI TIẾT SÂN (KHÔNG CHUYỂN TRANG) ==================== */}
      {selectedFieldDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            
            <button 
              onClick={() => setSelectedFieldDetail(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-full uppercase">
                Bảng Chi Tiết Cụm Sân
              </span>
              <span className={`px-3 py-1 text-[11px] font-black rounded-full ${
                selectedFieldDetail.trangthai === 'HOATDONG' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}>
                {selectedFieldDetail.trangthai === 'HOATDONG' ? 'Đang Hoạt Động' : 'Chờ / Khóa'}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">{selectedFieldDetail.tensan}</h3>
            
            <p className="text-xs text-slate-500 flex items-center gap-1 mb-6 font-medium">
              <MapPin className="w-4 h-4 text-emerald-600" /> 
              {selectedFieldDetail.vitri?.diachi}, P. {selectedFieldDetail.vitri?.phuong || 'Trung tâm'}, Q. {selectedFieldDetail.vitri?.quan}, TP. Đà Nẵng
            </p>

            {/* BỘ 4 HÌNH ẢNH SÂN BÃI DẠNG BẢNG */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              <img 
                src={selectedFieldDetail.hinhanh} 
                alt="Main" 
                className="col-span-2 h-36 w-full object-cover rounded-2xl border border-slate-200 shadow-sm" 
              />
              {Array.isArray(selectedFieldDetail.hinhanh_phu) && selectedFieldDetail.hinhanh_phu.map((img, idx) => (
                <img 
                  key={idx} 
                  src={img} 
                  alt={`Sub ${idx}`} 
                  className="h-36 w-full object-cover rounded-2xl border border-slate-200 shadow-sm" 
                />
              ))}
            </div>

            {/* BẢNG THÔNG TIN CHI TIẾT */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6 text-xs">
              <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200 p-3">
                <span className="font-bold text-slate-500">Giá Thuê Mặc Định:</span>
                <span className="font-black text-rose-600 text-sm">{Number(selectedFieldDetail.giasan).toLocaleString('vi-VN')} đ / 1h</span>
              </div>
              <div className="grid grid-cols-2 p-3 border-b border-slate-100">
                <span className="font-bold text-slate-500">Chủ Sân Sở Hữu:</span>
                <span className="font-extrabold text-slate-800">{selectedFieldDetail.nguoidung?.hoten} ({selectedFieldDetail.nguoidung?.sodienthoai})</span>
              </div>
              <div className="grid grid-cols-2 bg-slate-50 p-3 border-b border-slate-100">
                <span className="font-bold text-slate-500">Huy Hiệu Nổi Bật:</span>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(selectedFieldDetail.huyhieu) && selectedFieldDetail.huyhieu.map((h, i) => (
                    <span key={i} className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 p-3 border-b border-slate-100">
                <span className="font-bold text-slate-500">Tiện Ích Tiêu Chuẩn:</span>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(selectedFieldDetail.tienich) && selectedFieldDetail.tienich.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-slate-50">
                <span className="font-bold text-slate-500 block mb-1">Mô Tả & Quy Định:</span>
                <p className="text-slate-700 leading-relaxed font-medium">{selectedFieldDetail.mota}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {selectedFieldDetail.trangthai !== 'HOATDONG' ? (
                <button
                  onClick={() => handleUpdateFieldStatus(selectedFieldDetail.masan, 'HOATDONG')}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
                >
                  Duyệt Kích Hoạt Sân
                </button>
              ) : (
                <button
                  onClick={() => handleUpdateFieldStatus(selectedFieldDetail.masan, 'TU_CHOI')}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
                >
                  Tạm Khóa Sân
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL 2: XEM DANH SÁCH SÂN THUỘC SỞ HỮU CỦA CHỦ SÂN ==================== */}
      {ownerFieldsModal.show && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
            
            <button 
              onClick={() => setOwnerFieldsModal({ show: false, ownerName: '', fields: [] })}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-1">
              Danh Sách Sân Của: <span className="text-amber-600">{ownerFieldsModal.ownerName}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">Tổng số: {ownerFieldsModal.fields.length} cụm sân đang đăng ký trên hệ thống</p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {ownerFieldsModal.fields.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Chủ sân này chưa đăng ký cụm sân nào.</p>
              ) : (
                ownerFieldsModal.fields.map(field => (
                  <div key={field.masan} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img src={field.hinhanh} alt="" className="w-12 h-12 object-cover rounded-xl border border-slate-200" />
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900">{field.tensan}</h4>
                        <p className="text-[11px] text-slate-500">{field.vitri?.diachi}, Q. {field.vitri?.quan}</p>
                        <span className="text-[11px] font-black text-rose-600">{Number(field.giasan).toLocaleString('vi-VN')} đ / 1h</span>
                      </div>
                    </div>
                    <div>
                      {field.trangthai === 'HOATDONG' && <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">Đang chạy</span>}
                      {field.trangthai === 'CHO_DUYET' && <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">Chờ duyệt</span>}
                      {field.trangthai === 'TU_CHOI' && <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">Đã khóa</span>}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL 3: XÁC NHẬN ĐỔI PHÂN QUYỀN VAI TRÒ ==================== */}
      {confirmRoleModal.show && confirmRoleModal.user && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
            
            <button 
              onClick={() => setConfirmRoleModal({ show: false, user: null, targetRole: '', fieldCount: 0, isSubmitting: false })}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Xác Nhận Đổi Phân Quyền
                </h3>
                <p className="text-xs text-slate-500">
                  Kiểm tra kỹ thông tin trước khi thực thi
                </p>
              </div>
            </div>

            {/* THÔNG TIN TÀI KHOẢN */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Họ và tên:</span>
                <span className="font-extrabold text-slate-900">{confirmRoleModal.user.hoten}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Số điện thoại:</span>
                <span className="font-mono font-bold text-emerald-700">{confirmRoleModal.user.sodienthoai || 'Chưa có'}</span>
              </div>
              {confirmRoleModal.user.email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Email:</span>
                  <span className="text-slate-700 font-medium">{confirmRoleModal.user.email}</span>
                </div>
              )}
            </div>

            {/* BẢNG CHUYỂN ĐỔI VAI TRÒ */}
            <div className="bg-slate-100/70 p-4 rounded-2xl border border-slate-200 mb-4">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                Chuyển Đổi Quyền Hạn
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className={`px-3 py-1 text-xs font-black rounded-lg border ${
                  confirmRoleModal.user.vaitro === 'ADMIN' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                  confirmRoleModal.user.vaitro === 'CHUSAN' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  'bg-blue-100 text-blue-800 border-blue-200'
                }`}>
                  {confirmRoleModal.user.vaitro === 'ADMIN' ? 'Admin' :
                   confirmRoleModal.user.vaitro === 'CHUSAN' ? 'Chủ Sân' : 'Khách Hàng'}
                </span>

                <ArrowRight className="w-4 h-4 text-slate-400" />

                <span className={`px-3 py-1 text-xs font-black rounded-lg border ${
                  confirmRoleModal.targetRole === 'ADMIN' ? 'bg-rose-600 text-white border-rose-700' :
                  confirmRoleModal.targetRole === 'CHUSAN' ? 'bg-amber-500 text-white border-amber-600' :
                  'bg-blue-600 text-white border-blue-700'
                }`}>
                  {confirmRoleModal.targetRole === 'ADMIN' ? 'Admin' :
                   confirmRoleModal.targetRole === 'CHUSAN' ? 'Chủ Sân' : 'Khách Hàng'}
                </span>
              </div>
            </div>

            {/* CẢNH BÁO QUAN TRỌNG */}
            {confirmRoleModal.fieldCount > 0 && confirmRoleModal.targetRole !== 'CHUSAN' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Cảnh báo hạ quyền chủ sân:</div>
                  <div className="text-[11px] mt-0.5 text-amber-800 leading-relaxed">
                    Người dùng này đang sở hữu <strong>{confirmRoleModal.fieldCount} cụm sân</strong> trong hệ thống. Nếu chuyển sang Khách Hàng, họ sẽ không thể quản lý các cụm sân này nữa.
                  </div>
                </div>
              </div>
            )}

            {confirmRoleModal.targetRole === 'ADMIN' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-900 mb-4">
                <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Cảnh báo quyền Quản Trị Tối Cao:</div>
                  <div className="text-[11px] mt-0.5 text-rose-800 leading-relaxed">
                    Tài khoản sẽ có toàn quyền kiểm duyệt sân, can thiệp tài khoản khác và theo dõi tài chính toàn sàn.
                  </div>
                </div>
              </div>
            )}

            {confirmRoleModal.fieldCount > 0 && confirmRoleModal.targetRole === 'CHUSAN' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Khôi phục quyền Chủ Sân:</div>
                  <div className="text-[11px] mt-0.5 text-emerald-800 leading-relaxed">
                    Khôi phục lại quyền quản lý <strong>{confirmRoleModal.fieldCount} cụm sân</strong> cho tài khoản này.
                  </div>
                </div>
              </div>
            )}

            {/* NÚT THAO TÁC */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={confirmRoleModal.isSubmitting}
                onClick={() => setConfirmRoleModal({ show: false, user: null, targetRole: '', fieldCount: 0, isSubmitting: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={confirmRoleModal.isSubmitting}
                onClick={handleConfirmRoleChange}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {confirmRoleModal.isSubmitting ? 'Đang cập nhật...' : 'Xác Nhận Đổi Quyền'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL ĐĂNG NHẬP ADMIN */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={(loggedInUser) => {
          setCurrentUser(loggedInUser);
          if (typeof setUser === 'function') setUser(loggedInUser);
          fetchAdminData();
        }}
      />

    </div>
  );
}
