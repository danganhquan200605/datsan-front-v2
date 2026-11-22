import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, DollarSign, Calendar, Users, Star, CheckCircle2, 
  Clock, MapPin, Phone, AlertCircle, PlusCircle, RefreshCw, ChevronRight, Eye,
  QrCode, X, Check, XCircle, Search, RotateCcw, Filter, Loader2,
  ShieldCheck, CreditCard, ArrowRight, Shield, AlertTriangle
} from 'lucide-react';
import { 
  supabase, 
  settleOwnerBooking, 
  triggerAutoComplete, 
  broadcastAuthChange, 
  fetchOwnerOverview,
  fetchOwnerDeposit,
  requestOwnerDeposit,
  submitOwnerDepositProof,
  requestOwnerDepositRefund,
  fetchOwnerRefunds,
  confirmOwnerRefundSent,
  processMockPayment,
  getMockBookingQrSvg,
  isMatchEnded
} from '../supabaseClient';
import Header from '../components/Header';
import LoginModal from '../components/LoginModal';
import NotFound from './NotFound';

const getLocalDateValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const getOwnerQuickDateList = (todayStr) => {
  const today = new Date(`${todayStr}T12:00:00`);
  const list = [];

  // Hôm qua (-1 ngày)
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayFull = getLocalDateValue(yesterday);
  const yesterdayLabel = yesterday.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }).replace('/', '-');
  list.push({
    full: yesterdayFull,
    title: 'Hôm qua',
    label: yesterdayLabel,
  });

  // Hôm nay (0 ngày)
  const todayLabel = today.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }).replace('/', '-');
  list.push({
    full: todayStr,
    title: 'Hôm nay',
    label: todayLabel,
  });

  // Ngày mai (+1) và các ngày tiếp theo (+5 ngày)
  for (let i = 1; i <= 5; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const full = getLocalDateValue(d);
    const label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }).replace('/', '-');
    let title = d.toLocaleDateString('vi-VN', { weekday: 'short' });
    if (i === 1) title = 'Ngày mai';
    list.push({
      full,
      title,
      label,
    });
  }

  return list;
};

export default function OwnerDashboard({ user, setUser }) {
  const navigate = useNavigate();

  // Lấy thông tin chủ sân đang đăng nhập
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

  const ownerId = currentUser?.MaNguoiDung || currentUser?.manguoidung;

  // States dữ liệu
  const [sanList, setSanList] = useState([]);
  const [bookingList, setBookingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const todayStr = getLocalDateValue();
  const quickDates = useMemo(() => getOwnerQuickDateList(todayStr), [todayStr]);
  const [activeTab, setActiveTab] = useState('BOOKINGS'); // BOOKINGS | FIELDS
  const [bookingFilterStatus, setBookingFilterStatus] = useState('ALL');
  const [dateFilter, setDateFilter] = useState(() => todayStr);
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // States Ký quỹ bảo đảm (FEATURE 01)
  const [depositData, setDepositData] = useState(null);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositPaymentReq, setDepositPaymentReq] = useState(null);
  const [depositTxRef, setDepositTxRef] = useState('');
  const [isSubmittingDepositProof, setIsSubmittingDepositProof] = useState(false);

  // States Hoàn tiền cho khách hủy (FEATURE 02)
  const [refundsList, setRefundsList] = useState([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);
  const [selectedRefundForAction, setSelectedRefundForAction] = useState(null);
  const [refundTxIdInput, setRefundTxIdInput] = useState('');
  const [refundProofUrlInput, setRefundProofUrlInput] = useState('');
  const [isSubmittingRefundSent, setIsSubmittingRefundSent] = useState(false);

  // Helper parse metadata ghichu
  const parseMeta = (ghichu) => {
    try {
      return JSON.parse(ghichu || '{}');
    } catch {
      return {};
    }
  };

  // Helper định dạng tiền tệ an toàn (chống hiển thị NaN đ hoặc giấu lỗi bằng 0đ)
  const formatMoneySafe = (val) => {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
      return 'Chưa xác định';
    }
    return `${Number(val).toLocaleString('vi-VN')} đ`;
  };

  // Helper phân loại ca thi đấu
  const getBookingShift = (b) => {
    const firstSlot = b.datsan_khunggio?.[0]?.khunggio;
    const startStr = firstSlot?.giobatdau || '';
    if (!startStr) return 'OTHER';
    const hour = parseInt(startStr.slice(0, 2), 10);
    if (hour < 12) return 'SANG';
    if (hour < 17) return 'CHIEU';
    return 'TOI';
  };

  const userRole = (currentUser?.VaiTro || currentUser?.vaitro || '').toUpperCase();
  const isOwnerOrAdmin = ['CHUSAN', 'ADMIN'].includes(userRole);

  // Fetch dữ liệu của riêng Chủ sân từ endpoint an toàn /api/owner/overview
  const fetchOwnerData = async () => {
    if (!currentUser || !isOwnerOrAdmin) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      await triggerAutoComplete();
      const res = await fetchOwnerOverview();
      const overview = res?.data || {};
      setSanList(overview.fields || []);
      setBookingList(overview.bookings || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu Owner Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch thông tin ký quỹ của Chủ Sân (FEATURE 01)
  const fetchOwnerDepositData = async () => {
    if (!currentUser || !isOwnerOrAdmin) return;
    try {
      setLoadingDeposit(true);
      const res = await fetchOwnerDeposit();
      if (res?.deposit) setDepositData(res.deposit);
    } catch (err) {
      console.warn('Lỗi lấy thông tin ký quỹ:', err);
    } finally {
      setLoadingDeposit(false);
    }
  };

  // Fetch danh sách hoàn tiền khách hủy (FEATURE 02)
  const fetchOwnerRefundsData = async () => {
    if (!currentUser || !isOwnerOrAdmin) return;
    try {
      setLoadingRefunds(true);
      const res = await fetchOwnerRefunds();
      if (res?.refunds) setRefundsList(res.refunds);
    } catch (err) {
      console.warn('Lỗi lấy danh sách hoàn tiền:', err);
    } finally {
      setLoadingRefunds(false);
    }
  };

  useEffect(() => {
    if (currentUser && isOwnerOrAdmin) {
      fetchOwnerData();
      fetchOwnerDepositData();
      fetchOwnerRefundsData();
    } else {
      setLoading(false);
    }
  }, [currentUser, isOwnerOrAdmin]);

  // Bắt đầu quy trình nộp ký quỹ mô phỏng DEMO
  const handleStartDepositPayment = async () => {
    try {
      const res = await requestOwnerDeposit();
      if (res?.paymentDetails) {
        setDepositPaymentReq(res.paymentDetails);
        setDepositTxRef('');
        setShowDepositModal(true);
      }
    } catch (err) {
      alert('Lỗi tạo yêu cầu thanh toán ký quỹ: ' + err.message);
    }
  };

  // Gửi xác nhận đã chuyển khoản ký quỹ
  const handleSubmitDepositProof = async () => {
    if (!depositPaymentReq?.requestId) return;
    try {
      setIsSubmittingDepositProof(true);
      const res = await submitOwnerDepositProof({
        requestId: depositPaymentReq.requestId,
        bankTxId: depositTxRef || 'VQ-' + Date.now().toString().slice(-6),
        proofUrl: ''
      });
      if (res?.success) {
        alert('✅ Đã gửi thông tin nộp ký quỹ! Admin sàn sẽ đối soát tài khoản và kích hoạt trong vòng 1-2 giờ.');
        setShowDepositModal(false);
        fetchOwnerDepositData();
      } else {
        alert('Lỗi: ' + (res?.error || 'Không thể gửi xác nhận'));
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmittingDepositProof(false);
    }
  };

  // Thanh toán mô phỏng ký quỹ qua Mock Payment Gateway (DEMO)
  const handleSimulateDepositPayment = async (simulationAction = 'SIMULATE_SUCCESS') => {
    if (!depositPaymentReq) return;
    const txId = depositPaymentReq.transaction?.magiaodich || depositPaymentReq.transaction?.id;
    if (!txId) {
      alert('Không tìm thấy mã giao dịch ký quỹ.');
      return;
    }
    try {
      setIsSubmittingDepositProof(true);
      const res = await processMockPayment({
        transactionType: 'ESCROW_DEPOSIT',
        transactionId: txId,
        simulationAction
      });
      if (res?.success) {
        alert('🎉 ' + res.message);
        setShowDepositModal(false);
        fetchOwnerDepositData();
      } else {
        alert('⚠️ ' + (res?.message || 'Mô phỏng thanh toán thất bại'));
        fetchOwnerDepositData();
      }
    } catch (err) {
      alert('Lỗi thanh toán mô phỏng: ' + err.message);
    } finally {
      setIsSubmittingDepositProof(false);
    }
  };

  // Hoàn tiền mô phỏng qua Mock Payment Gateway (DEMO)
  const handleSimulateRefundPayment = async (refundId) => {
    try {
      setIsSubmittingRefundSent(true);
      const res = await processMockPayment({
        transactionType: 'REFUND',
        transactionId: refundId,
        simulationAction: 'SIMULATE_SUCCESS'
      });
      if (res?.success) {
        alert('🎉 ' + res.message);
        setSelectedRefundForAction(null);
        fetchOwnerRefundsData();
      } else {
        alert('Lỗi: ' + (res?.message || 'Mô phỏng hoàn tiền thất bại'));
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmittingRefundSent(false);
    }
  };

  // Xác nhận đã chuyển khoản hoàn tiền cho khách hủy (FEATURE 02)
  const handleConfirmRefundSent = async () => {
    if (!selectedRefundForAction) return;
    try {
      setIsSubmittingRefundSent(true);
      const res = await confirmOwnerRefundSent(selectedRefundForAction.id, {
        bankTxId: refundTxIdInput || 'REF-' + Date.now().toString().slice(-6),
        proofUrl: refundProofUrlInput
      });
      if (res?.success) {
        alert('✅ Đã xác nhận chuyển tiền hoàn! Hệ thống đã thông báo khách hàng xác nhận nhận tiền.');
        setSelectedRefundForAction(null);
        setRefundTxIdInput('');
        setRefundProofUrlInput('');
        fetchOwnerRefundsData();
      } else {
        alert('Lỗi: ' + (res?.error || 'Thao tác thất bại'));
      }
    } catch (err) {
      alert('Lỗi xác nhận hoàn tiền: ' + err.message);
    } finally {
      setIsSubmittingRefundSent(false);
    }
  };

  // Cập nhật trạng thái đơn đặt sân qua quy trình nghiệp vụ an toàn
  const handleUpdateBookingStatus = async (maDatSan, newStatus) => {
    if (newStatus === 'HOAN_THANH') {
      return handleSettleAction('COMPLETE_MATCH', maDatSan);
    }
    try {
      const { error } = await supabase
        .from('datsan')
        .update({ trangthai: newStatus })
        .eq('madatsan', maDatSan);

      if (error) throw error;

      alert(`Đã cập nhật trạng thái đơn thành: ${newStatus}`);
      fetchOwnerData();
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  // Xử lý xác nhận thu tiền mặt / hoàn tất trận / hủy trận / nộp hoa hồng
  const handleSettleAction = async (action, bookingId = null) => {
    try {
      setIsSettling(true);
      const res = await settleOwnerBooking(action, bookingId, ownerId);
      if (res && res.error) throw new Error(res.error);

      if (action === 'CONFIRM_CASH') {
        if (res?.matchHasEnded) {
          alert('✅ Đã xác nhận thu tiền mặt và hoàn tất ca đấu! Phí hoa hồng 10% đã được ghi vào Sổ Nợ.');
        } else {
          alert('💵 Đã xác nhận thu tiền mặt tại sân! Đơn được chuyển sang Chờ thi đấu và sẽ tự động hoàn tất sau khi trận đấu kết thúc.');
        }
      } else if (action === 'COMPLETE_MATCH') {
        alert('✅ Đã hoàn tất ca đấu thành công!');
      } else if (action === 'CANCEL_NO_SHOW') {
        alert('✅ Đã hủy trận (khách vắng mặt). Khung giờ đã được giải phóng và phí hoa hồng là 0 đ.');
      } else if (action === 'SETTLE_ALL_COMMISSIONS') {
        setShowSettleModal(false);
        setTimeout(() => {
          alert('🎉 Đã nộp hoa hồng thành công! Số nợ hoa hồng đã về 0 đ.');
        }, 100);
      }
      fetchOwnerData();
    } catch (err) {
      alert('Lỗi thao tác: ' + err.message);
    } finally {
      setIsSettling(false);
    }
  };

  // Tính toán Sổ nợ hoa hồng cần nộp cho Admin
  const pendingCommissionBookings = bookingList.filter(b => {
    const meta = parseMeta(b.ghichu);
    return (b.trangthai === 'HOAN_THANH' || b.trangthai === 'HOANTHANH') && meta.commissionStatus === 'CHO_CHUSAN_NOP';
  });

  const totalPendingCommission = pendingCommissionBookings.reduce((sum, b) => {
    const meta = parseMeta(b.ghichu);
    return sum + Number(meta.commissionAmount || Math.round(Number(b.tongtien || 0) * 0.1));
  }, 0);

  // Tính toán KPI Doanh Thu
  const totalRevenue = bookingList
    .filter(b => b.trangthai === 'HOANTHANH' || b.trangthai === 'HOAN_THANH' || b.trangthai === 'DA_THANH_TOAN' || b.trangthai === 'DACANCOC')
    .reduce((sum, b) => sum + Number(b.tongtien || 0), 0);

  const totalBookings = bookingList.length;
  const totalFields = sanList.length;

  const filteredBookings = bookingList.filter(b => {
    const meta = parseMeta(b.ghichu);
    const method = meta.paymentMethod || (b.trangthai === 'CHO_THI_DAU' ? 'TIEN_MAT' : 'QR');
    const isCash = method === 'TIEN_MAT';

    // 1. Lọc theo trạng thái
    let matchStatus = true;
    if (bookingFilterStatus === 'CHO_THI_DAU') matchStatus = isCash && (b.trangthai === 'CHO_THI_DAU' || b.trangthai === 'CHOXACNHAN');
    else if (bookingFilterStatus === 'DA_THANH_TOAN') matchStatus = !isCash && (b.trangthai === 'DA_THANH_TOAN' || b.trangthai === 'DACANCOC' || b.trangthai === 'CHOXACNHAN');
    else if (bookingFilterStatus === 'HOAN_THANH') matchStatus = b.trangthai === 'HOAN_THANH' || b.trangthai === 'HOANTHANH';
    else if (bookingFilterStatus === 'DA_HUY') matchStatus = b.trangthai === 'DA_HUY' || b.trangthai === 'DAHUY';
    else if (bookingFilterStatus !== 'ALL') matchStatus = b.trangthai === bookingFilterStatus;

    // 2. Lọc theo ngày
    const bookingDate = String(b.ngaysudung || b.ngaydat || '').slice(0, 10);
    const matchDate = !dateFilter || bookingDate === dateFilter;

    // 3. Lọc theo ca
    const bookingShift = getBookingShift(b);
    const matchShift = shiftFilter === 'ALL' || bookingShift === shiftFilter;

    // 4. Tìm kiếm
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query ||
      (b.nguoidung?.hoten || '').toLowerCase().includes(query) ||
      (b.nguoidung?.sodienthoai || '').includes(query) ||
      (b.san?.tensan || '').toLowerCase().includes(query) ||
      String(b.madatsan || '').includes(query);

    return matchStatus && matchDate && matchShift && matchSearch;
  });

  // NẾU CHƯA ĐĂNG NHẬP HOẶC KHÔNG PHẢI CHỦ SÂN/ADMIN -> RENDER TRANG 404 TRUNG TÍNH (ZERO DATA LEAKED)
  if (!currentUser || !isOwnerOrAdmin) {
    return <NotFound user={currentUser} setUser={setUser} />;
  }

  // Đang tải dữ liệu
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased flex flex-col">
        <Header user={currentUser} setUser={setUser} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-600">Đang tải bảng quản lý chủ sân...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-16">
      <Header user={currentUser} setUser={setCurrentUser} onLoginClick={() => setShowLoginModal(true)} />

      <main className="max-w-[1440px] mx-auto px-6 pt-8">
        
        {/* HEADER DASHBOARD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 mb-1">
              <Building2 className="w-4 h-4" />
              <span>PORTAL QUẢN LÝ CHỦ SÂN</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Bảng Điều Khiển Kinh Doanh
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/register-field')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> Thêm Cụm Sân Mới
            </button>
            <button 
              onClick={fetchOwnerData}
              className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* THÔNG BÁO VẬN HÀNH THỬ NGHIỆM */}
        <div className="mb-6 bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm text-xs font-bold">Lưu ý</span>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Cổng Quản Lý Vận Hành & Ký Quỹ</h4>
              <p className="text-[11px] text-slate-600 font-medium">Hệ thống đang hoạt động trong môi trường thử nghiệm – các giao dịch tài chính không phát sinh chuyển tiền thật.</p>
            </div>
          </div>
        </div>

        {/* THỐNG KÊ KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Doanh Thu</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {totalRevenue.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-400">đ</span>
            </div>
            <p className="text-[11px] text-emerald-600 font-bold mt-1">Doanh thu vận hành sân</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Lượt Đặt</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">{totalBookings} <span className="text-xs font-bold text-slate-400">đơn</span></div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Lượt giữ chỗ qua hệ thống</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Số Sân Sở Hữu</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">{totalFields} <span className="text-xs font-bold text-slate-400">cụm sân</span></div>
            <p className="text-[11px] text-amber-600 font-bold mt-1">Đang đăng ký vận hành</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đánh Giá Uy Tín</span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">4.9 / 5.0</div>
            <p className="text-[11px] text-purple-600 font-bold mt-1">Đánh giá từ khách hàng</p>
          </div>

        </div>

        {/* FEATURE 01: BANNER KHOẢN BẢO ĐẢM KÝ QUỸ (1.000.000 VND) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shadow-md shrink-0 ${
              depositData?.trangthai === 'HOP_LE' ? 'bg-emerald-600 text-white' :
              depositData?.trangthai === 'CHO_XAC_MINH' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                Khoản Bảo Đảm Trách Nhiệm Chủ Sân (Ký Quỹ)
                <span className={`px-2.5 py-0.5 text-white text-[10px] font-black rounded-full uppercase tracking-wider ${
                  depositData?.trangthai === 'HOP_LE' ? 'bg-emerald-600' :
                  depositData?.trangthai === 'CHO_XAC_MINH' ? 'bg-amber-600' : 'bg-rose-600'
                }`}>
                  {depositData?.trangthai === 'HOP_LE' ? (depositData.is_legacy ? 'ĐÃ KÝ QUỸ (CHỦ SÂN HIỆN HỮU)' : 'ĐÃ KÝ QUỸ 1.000.000đ') :
                   depositData?.trangthai === 'CHO_XAC_MINH' ? 'CHỜ ADMIN XÁC MINH' : 'CHƯA NỘP BẢO ĐẢM'}
                </span>
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {depositData?.trangthai === 'HOP_LE'
                  ? `Số dư quỹ bảo đảm hiện tại: ${Number(depositData.sodu_hientai || 1000000).toLocaleString('vi-VN')} đ. Khoản bảo đảm có hoàn lại khi ngừng kinh doanh.`
                  : depositData?.trangthai === 'CHO_XAC_MINH'
                  ? 'Bạn đã gửi thông tin nộp ký quỹ. Admin đang đối soát giao dịch để kích hoạt.'
                  : 'Quy định sàn: Chủ sân cần nộp khoản bảo đảm 1.000.000đ có hoàn lại để sân mới được nhận đặt lịch và phê duyệt hoạt động.'
                }
              </p>
            </div>
          </div>
          {depositData?.trangthai !== 'HOP_LE' && depositData?.trangthai !== 'CHO_XAC_MINH' && (
            <button
              onClick={handleStartDepositPayment}
              className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap active:scale-95"
            >
              <QrCode className="w-4 h-4" /> Nộp khoản bảo đảm 1.000.000đ
            </button>
          )}
        </div>

        {/* SỔ NỢ HOA HỒNG BANNER CẦN NỘP ADMIN */}
        {totalPendingCommission > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                  Thông Báo: Quyết Toán Hoa Hồng Sàn
                  <span className="px-2.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                    {pendingCommissionBookings.length} đơn tiền mặt
                  </span>
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Các ca thi đấu tiền mặt đã hoàn thành thu trực tiếp. Hoa hồng 10% cần quyết toán về sàn:
                  <span className="ml-1.5 text-base font-black text-rose-600">
                    {totalPendingCommission.toLocaleString('vi-VN')} đ
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettleModal(true)}
              style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}
              className="px-5 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap active:scale-95"
            >
              <QrCode className="w-4 h-4" /> Quyết toán hoa hồng nền tảng
            </button>
          </div>
        )}

        {/* PHÂN HỆ QUẢN LÝ DẠNG TAB */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* TAB HEADERS */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50/50 px-6 pt-4 gap-6">
            <button
              onClick={() => setActiveTab('BOOKINGS')}
              className={`pb-4 text-xs font-extrabold transition relative ${
                activeTab === 'BOOKINGS' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Danh Sách Đơn Đặt Sân & Khách Hàng ({bookingList.length})
            </button>
            <button
              onClick={() => setActiveTab('FIELDS')}
              className={`pb-4 text-xs font-extrabold transition relative ${
                activeTab === 'FIELDS' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Danh Sách Sân Của Tôi ({sanList.length})
            </button>
            <button
              onClick={() => setActiveTab('REFUNDS')}
              className={`pb-4 text-xs font-extrabold transition relative ${
                activeTab === 'REFUNDS' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hoàn Tiền Khách Hủy ({refundsList.length})
            </button>
          </div>

          <div className="p-6">
            
            {/* TAB 1: DANH SÁCH ĐƠN ĐẶT SÂN & KHÁCH HÀNG */}
            {activeTab === 'BOOKINGS' && (
              <div>
                {/* THANH BỘ LỌC ĐA NĂNG: TRẠNG THÁI + NGÀY + CA + TÌM KIẾM */}
                <div className="space-y-3 mb-6 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                  {/* Hàng 1: Bộ lọc trạng thái đơn & Tìm kiếm */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                      {[
                        { key: 'ALL', label: 'Tất cả đơn' },
                        { key: 'CHO_THI_DAU', label: 'Chờ đấu (Tiền mặt)' },
                        { key: 'DA_THANH_TOAN', label: 'Đã TT (QR)' },
                        { key: 'HOAN_THANH', label: 'Hoàn thành' },
                        { key: 'DA_HUY', label: 'Đã hủy / Bùng' }
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setBookingFilterStatus(f.key)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                            bookingFilterStatus === f.key 
                              ? 'bg-slate-900 text-white shadow-sm' 
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Ô tìm kiếm */}
                    <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Tìm tên khách, SĐT, sân..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs" 
                      />
                    </div>
                  </div>

                  {/* Hàng 2: Lọc theo Ngày Đá & Ca thi đấu */}
                  <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-200/60 text-xs">
                    {/* Tiêu đề & Dãy Nút Chọn Nhanh Ngày */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-600 text-[11px] flex items-center gap-1 shrink-0 mr-0.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Ngày đá:
                      </span>

                      {/* Nút Tất cả ngày */}
                      <button
                        type="button"
                        onClick={() => setDateFilter('')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer ${
                          !dateFilter
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        Tất cả ngày
                      </button>

                      {/* Dãy nút chọn ngày nhanh */}
                      {quickDates.map((item) => {
                        const isSelected = dateFilter === item.full;
                        return (
                          <button
                            key={item.full}
                            type="button"
                            onClick={() => setDateFilter(item.full)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isSelected && item.title === 'Hôm nay' && <Check className="w-3 h-3 text-white" />}
                            <span>{item.title}</span>
                            <span className="opacity-80 font-normal text-[11px]">({item.label})</span>
                          </button>
                        );
                      })}

                      {/* Chọn ngày khác qua Date Picker */}
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-xs hover:border-emerald-500 transition">
                        <span className="text-[11px] font-semibold text-slate-400">Khác:</span>
                        <input 
                          type="date" 
                          value={dateFilter} 
                          onChange={e => setDateFilter(e.target.value)} 
                          onClick={e => {
                            try {
                              e.currentTarget.showPicker();
                            } catch (err) {}
                          }}
                          className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer" 
                        />
                      </div>
                    </div>

                    <span className="text-slate-300 hidden md:inline mx-1">|</span>

                    {/* Lọc theo Ca */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-slate-600 text-[11px] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" /> Ca đá:
                      </span>
                      <select 
                        value={shiftFilter} 
                        onChange={e => setShiftFilter(e.target.value)} 
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                      >
                        <option value="ALL">Tất cả ca trong ngày</option>
                        <option value="SANG">Ca Sáng (05:00 - 12:00)</option>
                        <option value="CHIEU">Ca Chiều (12:00 - 17:00)</option>
                        <option value="TOI">Ca Tối (17:00 - 23:00)</option>
                      </select>
                    </div>

                    {/* Nút Đặt lại bộ lọc */}
                    {(bookingFilterStatus !== 'ALL' || dateFilter !== todayStr || shiftFilter !== 'ALL' || searchQuery) && (
                      <button
                        onClick={() => {
                          setBookingFilterStatus('ALL');
                          setDateFilter(todayStr);
                          setShiftFilter('ALL');
                          setSearchQuery('');
                        }}
                        className="ml-auto text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Đặt lại bộ lọc
                      </button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="py-16 text-center text-xs font-bold text-emerald-600">Đang tải danh sách đơn...</div>
                ) : filteredBookings.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-xs font-bold">Chưa có đơn đặt sân nào phù hợp với bộ lọc.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="py-3 px-4">Khách Hàng & SĐT</th>
                          <th className="py-3 px-4">Tên Sân & Lịch Thi Đấu</th>
                          <th className="py-3 px-4">Tổng Tiền</th>
                          <th className="py-3 px-4">Hình Thức Thanh Toán</th>
                          <th className="py-3 px-4">Trạng Thái</th>
                          <th className="py-3 px-4 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBookings.map((b) => {
                          const khachHang = b.nguoidung || {};
                          const meta = parseMeta(b.ghichu);
                          const method = meta.paymentMethod || (b.trangthai === 'CHO_THI_DAU' ? 'TIEN_MAT' : 'QR');
                          const commissionAmt = meta.commissionAmount || Math.round(Number(b.tongtien || 0) * 0.1);
                          const isCash = method === 'TIEN_MAT';
                          const isPendingCash = isCash && (b.trangthai === 'CHO_THI_DAU' || b.trangthai === 'CHOXACNHAN');
                          const isPendingQR = !isCash && (b.trangthai === 'DA_THANH_TOAN' || b.trangthai === 'DACANCOC' || b.trangthai === 'CHOXACNHAN' || b.trangthai === 'CHO_THI_DAU');
                          const isCompleted = b.trangthai === 'HOAN_THANH' || b.trangthai === 'HOANTHANH';
                          const isCancelled = b.trangthai === 'DA_HUY' || b.trangthai === 'DAHUY';

                          // Trích xuất khung giờ đặt
                          const slotTimes = (b.datsan_khunggio || [])
                            .map(k => {
                              const start = k.khunggio?.giobatdau ? k.khunggio.giobatdau.slice(0, 5) : '';
                              const end = k.khunggio?.gioketthuc ? k.khunggio.gioketthuc.slice(0, 5) : '';
                              return start && end ? `${start} - ${end}` : '';
                            })
                            .filter(Boolean)
                            .join(', ');

                          return (
                            <tr key={b.madatsan} className="hover:bg-slate-50/60">
                              <td className="py-4 px-4 font-bold text-slate-900">
                                <div>{khachHang.hoten || 'Khách vãng lai'}</div>
                                <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-mono mt-0.5">
                                  <Phone className="w-3 h-3" /> {khachHang.sodienthoai || 'Chưa có SĐT'}
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="font-extrabold text-slate-800">{b.san?.tensan}</div>
                                <div className="text-[11px] text-slate-500 font-medium">{b.ngaysudung}</div>
                                {slotTimes ? (
                                  <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3 text-emerald-600" /> Ca: {slotTimes}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400 italic">Ca thi đấu</div>
                                )}
                              </td>
                              <td className="py-4 px-4 font-black text-rose-600">
                                {Number(b.tongtien).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="py-4 px-4">
                                {isCash ? (
                                  <div>
                                    <span className="font-bold text-blue-700 flex items-center gap-1">
                                      <DollarSign className="w-3.5 h-3.5" /> Tiền mặt
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      {isCompleted && meta.commissionStatus === 'CHO_CHUSAN_NOP' 
                                        ? <span className="text-amber-600 font-bold">Chờ nộp hoa hồng: {commissionAmt.toLocaleString('vi-VN')} đ</span>
                                        : isCompleted && meta.commissionStatus === 'DA_QUYET_TOAN'
                                        ? <span className="text-emerald-600 font-bold">Đã đối soát hoa hồng</span>
                                        : isCancelled
                                        ? <span>Đã hủy</span>
                                        : <span>Hoa hồng sàn 10%: {commissionAmt.toLocaleString('vi-VN')} đ</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                                      <QrCode className="w-3.5 h-3.5" /> Chuyển khoản QR
                                    </span>
                                    <div className="text-[10px] text-emerald-600 mt-0.5">
                                      Đã đối soát tự động
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                {isPendingCash && (
                                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                                    Chờ thi đấu (Tiền mặt)
                                  </span>
                                )}
                                {isPendingQR && (
                                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                                    Đã thanh toán (QR)
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                                    isCash && meta.commissionStatus === 'CHO_CHUSAN_NOP'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {isCash && meta.commissionStatus === 'CHO_CHUSAN_NOP' ? 'Chờ nộp hoa hồng' : 'Hoàn thành'}
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                                    Đã hủy
                                  </span>
                                )}
                                {!isPendingCash && !isPendingQR && !isCompleted && !isCancelled && (
                                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                                    {b.trangthai || 'Chờ xác nhận'}
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                                {isPendingCash && (
                                  <>
                                    <button
                                      disabled={isSettling}
                                      onClick={() => handleSettleAction('CONFIRM_CASH', b.madatsan)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm cursor-pointer"
                                    >
                                      ✓ Xác nhận thu tiền mặt
                                    </button>
                                    <button
                                      disabled={isSettling}
                                      onClick={() => handleSettleAction('CANCEL_NO_SHOW', b.madatsan)}
                                      className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] rounded-lg cursor-pointer"
                                    >
                                      ✕ Hủy vắng mặt
                                    </button>
                                  </>
                                )}
                                {!isCompleted && !isCancelled && (
                                  <button
                                    disabled={isSettling}
                                    onClick={() => handleSettleAction('COMPLETE_MATCH', b.madatsan)}
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg shadow-sm cursor-pointer"
                                  >
                                    Hoàn tất ca đấu
                                  </button>
                                )}
                                {isCompleted && isCash && meta.commissionStatus === 'CHO_CHUSAN_NOP' && (
                                  <button
                                    onClick={() => setShowSettleModal(true)}
                                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg shadow-sm"
                                  >
                                    Quét QR nộp hoa hồng
                                  </button>
                                )}
                                {isCompleted && (!isCash || meta.commissionStatus === 'DA_QUYET_TOAN') && (
                                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn tất
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="text-[11px] text-slate-400">Không tính phí</span>
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
            )}

            {/* TAB 2: DANH SÁCH SÂN CỦA TÔI */}
            {activeTab === 'FIELDS' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sanList.map((san) => (
                  <div key={san.masan} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="h-40 bg-slate-200 relative">
                      <img 
                        src={san.hinhanh || 'https://images.unsplash.com/photo-1529900248057-5e632c63c574?auto=format&fit=crop&w=800&q=80'} 
                        alt={san.tensan}
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute top-3 right-3">
                        {san.trangthai === 'CHO_DUYET' ? (
                          <span className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full shadow-md">
                            Chờ Admin Duyệt
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-full shadow-md">
                            Đang Hoạt Động
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-extrabold text-base text-slate-900 mb-1">{san.tensan}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {san.vitri?.diachi}, Q. {san.vitri?.quan}
                      </p>
                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-700">{Number(san.giasan).toLocaleString('vi-VN')} đ / ca</span>
                        <button 
                          onClick={() => navigate('/')}
                          className="text-xs font-bold text-slate-600 hover:text-emerald-600 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem ngoài web
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: DANH SÁCH HOÀN TIỀN KHÁCH HỦY (FEATURE 02) */}
            {activeTab === 'REFUNDS' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Yêu Cầu Hoàn Tiền Do Khách Hủy Trước Giờ Đấu</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Khách hàng tự hủy hợp lệ (&ge; 4 tiếng trước giờ đấu) được hoàn 100%. Chủ sân có trách nhiệm chuyển khoản hoàn tiền trong vòng 24 giờ.
                    </p>
                  </div>
                  <button
                    onClick={fetchOwnerRefundsData}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingRefunds ? 'animate-spin' : ''}`} />
                    Làm mới
                  </button>
                </div>

                {loadingRefunds ? (
                  <div className="py-16 text-center text-xs font-bold text-slate-500">
                    Đang tải danh sách hoàn tiền...
                  </div>
                ) : refundsList.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-500" />
                    <p className="text-xs font-bold">Hiện không có yêu cầu hoàn tiền nào cần xử lý.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Mã Đơn / Ngày Tạo</th>
                          <th className="py-3 px-4">Số Tiền Hoàn (100%)</th>
                          <th className="py-3 px-4">Tài Khoản Nhận</th>
                          <th className="py-3 px-4">Hạn Xử Lý (24h)</th>
                          <th className="py-3 px-4">Trạng Thái</th>
                          <th className="py-3 px-4 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {refundsList.map((rf) => {
                          const refundId = rf.mahoantien || rf.id;
                          const refundAmount = rf.sotien_canhoan ?? rf.sotien_hoan;
                          const receiverHolder = rf.chutaikhoan_nhan || rf.tentaikhoan_nhan || '—';
                          const isOverdue = (rf.trangthai === 'CHO_HOAN' || rf.trangthai === 'QUA_HAN') && new Date(rf.han_xuly) < new Date();
                          return (
                            <tr key={refundId || rf.madatsan} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4">
                                <div className="font-extrabold text-slate-900">Đơn #{rf.madatsan}</div>
                                <div className="text-[10px] text-slate-400">Yêu cầu: #{refundId || '—'}</div>
                              </td>
                              <td className="py-3 px-4 font-black text-rose-600">
                                {formatMoneySafe(refundAmount)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-800">{rf.nganhang_nhan || 'MB Bank'} - {rf.sotaikhoan_nhan || '—'}</div>
                                <div className="text-[10px] text-slate-500">{receiverHolder}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className={`text-[11px] font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                                  {new Date(rf.han_xuly).toLocaleString('vi-VN')}
                                </div>
                                {isOverdue && (
                                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                    Quá hạn 24h
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {rf.trangthai === 'CHO_HOAN' && (
                                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-600" /> Chờ chuyển hoàn
                                  </span>
                                )}
                                {rf.trangthai === 'QUA_HAN' && (
                                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" /> Quá hạn - Cần giải trình
                                  </span>
                                )}
                                {rf.trangthai === 'DANG_XAC_MINH_GIAI_TRINH' && (
                                  <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-purple-600" /> Admin thẩm định giải trình
                                  </span>
                                )}
                                {(rf.trangthai === 'DA_CHUYEN' || rf.trangthai === 'OWNER_BAO_DA_CHUYEN') && (
                                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-blue-600" /> Đã chuyển (Chờ khách)
                                  </span>
                                )}
                                {(rf.trangthai === 'DA_NHAN' || rf.trangthai === 'DA_HOAN') && (
                                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Khách đã nhận
                                  </span>
                                )}
                                {rf.trangthai === 'TRANH_CHAP' && (
                                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" /> Tranh chấp
                                  </span>
                                )}
                                {rf.trangthai === 'BOI_HOAN_HOAN_TAT' && (
                                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sàn đã bồi hoàn khách
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {rf.trangthai === 'CHO_HOAN' && (
                                  <button
                                    onClick={() => {
                                      setSelectedRefundForAction(rf);
                                      setRefundTxIdInput('');
                                      setRefundProofUrlInput('');
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                                  >
                                    Báo đã chuyển khoản
                                  </button>
                                )}
                                {rf.trangthai === 'DA_CHUYEN' && (
                                  <span className="text-[11px] text-slate-400">
                                    Mã GD: {rf.magiaodich_owner || rf.chusan_nganhang_txid || 'Đã gửi'}
                                  </span>
                                )}
                                {rf.trangthai === 'DA_NHAN' && (
                                  <span className="text-[11px] text-emerald-600 font-bold">
                                    ✓ Hoàn tất
                                  </span>
                                )}
                                {rf.trangthai === 'TRANH_CHAP' && (
                                  <span className="text-[11px] text-rose-600 font-bold">
                                    Admin đang xử lý
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
            )}

          </div>

        </div>

        {/* MODAL NỘP HOA HỒNG CHO SÀN */}
        {showSettleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100">
              <button 
                onClick={() => setShowSettleModal(false)}
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-4">
                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                  Quyết Toán Doanh Thu Sàn
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">Nộp Hoa Hồng Nền Tảng (10%)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Thanh toán hoa hồng cho {pendingCommissionBookings.length} đơn tiền mặt đã thu
                </p>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-center mb-5">
                <div className="text-xs font-bold text-slate-700 mb-2">Mã QR Nộp Hoa Hồng Nền Tảng (10%)</div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-sm">
                  <img 
                    src={getMockBookingQrSvg(totalPendingCommission, `HOAHONG-${ownerId}`)} 
                    alt="QR Commission Payment" 
                    className="w-48 h-48 mx-auto object-contain"
                  />
                </div>
                <div className="mt-3 text-[11px] text-slate-600 space-y-0.5">
                  <div>Ngân hàng: <strong className="text-slate-800">Vietcombank</strong> | STK: <strong className="text-slate-800 font-mono">0011008888888</strong></div>
                  <div>Người nhận: <strong className="text-slate-800">DATSAN ONLINE QUAN TRI</strong></div>
                  <div className="text-base font-black text-rose-600 mt-2">
                    Tổng tiền nộp: {totalPendingCommission.toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 italic">
                    Giao dịch thử nghiệm – không phát sinh chuyển tiền thật.
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSettleModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Để sau
                </button>
                <button
                  disabled={isSettling}
                  onClick={() => handleSettleAction('SETTLE_ALL_COMMISSIONS')}
                  style={{ backgroundColor: '#059669', color: '#ffffff' }}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSettling ? 'Đang xử lý...' : 'Xác nhận quyết toán hoa hồng'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 01: MODAL NỘP KHOẢN BẢO ĐẢM KÝ QUỸ (1.000.000 VND) */}
        {showDepositModal && depositPaymentReq && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setShowDepositModal(false)}
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-3">
                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                  Bảo Đảm Trách Nhiệm Sân Bãi
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">Nộp Ký Quỹ 1.000.000đ</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Thu một lần cho mỗi tài khoản Chủ sân. Khoản bảo đảm có hoàn lại khi ngừng kinh doanh.
                </p>
              </div>

              {/* THÔNG BÁO TÀI CHÍNH THỬ NGHIỆM */}
              <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <div className="text-xs font-bold text-slate-800">Cổng Thanh Toán Ký Quỹ</div>
                <div className="text-[10px] text-slate-600 font-medium">Giao dịch thử nghiệm – không phát sinh chuyển tiền thật.</div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-center mb-4">
                <div className="text-xs font-bold text-slate-700 mb-2">Mã QR Nộp Ký Quỹ Sàn</div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-sm">
                  <img 
                    src={depositPaymentReq.bankInfo?.qrUrl || depositPaymentReq.qrUrl || getMockBookingQrSvg(1000000, depositPaymentReq.transferContent || 'KYQUY')} 
                    alt="QR Deposit" 
                    className="w-48 h-48 mx-auto object-contain"
                  />
                </div>
                <div className="mt-3 text-[11px] text-slate-600 space-y-1 text-left bg-white p-3 rounded-xl border border-slate-200">
                  <div>Ngân hàng: <strong className="text-slate-800">{depositPaymentReq.bankInfo?.bankName || 'Vietcombank'}</strong></div>
                  <div>Số tài khoản: <strong className="text-slate-800 font-mono">{depositPaymentReq.bankInfo?.accountNumber || '0011009999999'}</strong></div>
                  <div>Tên người nhận: <strong className="text-slate-800">{depositPaymentReq.bankInfo?.accountHolder || 'DATSAN ONLINE KY QUY'}</strong></div>
                  <div>Số tiền: <strong className="text-emerald-700 font-black">1.000.000 đ</strong></div>
                  <div className="pt-1 border-t border-slate-100">
                    Nội dung: <strong className="text-emerald-700 font-mono bg-emerald-50 px-1 py-0.5 rounded">{depositPaymentReq.transferContent || depositPaymentReq.content}</strong>
                  </div>
                </div>
              </div>

              {/* PAYMENT CONTROLLER */}
              <div className="space-y-2 mb-4">
                <button
                  disabled={isSubmittingDepositProof}
                  onClick={() => handleSimulateDepositPayment('SIMULATE_SUCCESS')}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmittingDepositProof ? 'Đang xử lý...' : 'Xác nhận hoàn tất nộp ký quỹ'}
                </button>
                <button
                  disabled={isSubmittingDepositProof}
                  onClick={() => handleSimulateDepositPayment('SIMULATE_PENDING')}
                  className="w-full py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                >
                  Gửi yêu cầu chờ đối soát thủ công
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Đóng Cửa Sổ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 02: MODAL BÁO ĐÃ HOÀN TIỀN CHO KHÁCH HỦY */}
        {selectedRefundForAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setSelectedRefundForAction(null)}
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-4">
                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                  Chuyển Tiền Hoàn Trả Khách
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">Xác Nhận Đã Chuyển Khoản Hoàn Tiền</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Đơn đặt sân #{selectedRefundForAction.madatsan} • Hoàn 100%
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 text-xs space-y-1.5">
                <div className="font-extrabold text-slate-800 uppercase text-[11px] mb-2 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Thông tin tài khoản thụ hưởng của Khách
                </div>
                <div>Ngân hàng: <strong className="text-slate-900">{selectedRefundForAction.nganhang_nhan || 'MB Bank'}</strong></div>
                <div>Số tài khoản: <strong className="text-slate-900 font-mono text-sm">{selectedRefundForAction.sotaikhoan_nhan || '—'}</strong></div>
                <div>Chủ tài khoản: <strong className="text-slate-900 uppercase">{selectedRefundForAction.chutaikhoan_nhan || selectedRefundForAction.tentaikhoan_nhan || '—'}</strong></div>
                <div className="pt-2 border-t border-slate-200 text-sm">
                  Số tiền cần hoàn: <strong className="text-rose-600 font-black">
                    {formatMoneySafe(selectedRefundForAction.sotien_canhoan ?? selectedRefundForAction.sotien_hoan)}
                  </strong>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mã giao dịch đối soát (Transaction ID)</label>
                  <input
                    type="text"
                    placeholder="TXN_REFUND_123456"
                    value={refundTxIdInput}
                    onChange={(e) => setRefundTxIdInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Hệ thống tự động sinh mã đối soát nếu để trống</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ghi chú đối soát (tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Ghi chú hoàn tiền"
                    value={refundProofUrlInput}
                    onChange={(e) => setRefundProofUrlInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-700 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">Xử lý hoàn tiền trực tuyến</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Giao dịch thử nghiệm – không phát sinh chuyển tiền thật. Bạn có thể nhấn <strong>Xác nhận hoàn tiền</strong> để hệ thống tự động sinh mã đối soát và hoàn tất quy trình.
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  disabled={isSubmittingRefundSent}
                  onClick={() => handleSimulateRefundPayment(selectedRefundForAction.mahoantien || selectedRefundForAction.id)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  {isSubmittingRefundSent ? 'Đang xử lý...' : 'Xác nhận hoàn tiền cho khách'}
                </button>

                <div className="flex gap-3 mt-1">
                  <button
                    onClick={() => setSelectedRefundForAction(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                  >
                    Đóng
                  </button>
                  <button
                    disabled={isSubmittingRefundSent}
                    onClick={handleConfirmRefundSent}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmittingRefundSent ? 'Đang gửi...' : 'Nhập mã thủ công'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL ĐĂNG NHẬP CHỦ SÂN */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={(loggedInUser) => {
          setCurrentUser(loggedInUser);
          if (typeof setUser === 'function') setUser(loggedInUser);
          fetchOwnerData();
        }}
      />
    </div>
  );
}
