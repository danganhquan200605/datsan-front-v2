import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Phone, Mail, Shield, Calendar, Clock, MapPin, 
  Star, CheckCircle2, AlertCircle, XCircle, ChevronLeft, 
  Edit3, Save, MessageSquare, ExternalLink, Award, ArrowRight,
  AlertTriangle, RefreshCw, DollarSign, CreditCard
} from 'lucide-react';
import { 
  supabase, 
  broadcastAuthChange, 
  checkCustomerCancellation, 
  cancelCustomerBooking, 
  cancelPartialCustomerBooking,
  confirmCustomerRefundReceived,
  fetchCustomerRefunds 
} from '../supabaseClient';
import Header from '../components/Header';

export default function UserProfile({ user: propUser, setUser: propSetUser }) {
  const navigate = useNavigate();

  // 1. Lấy thông tin user hiện tại từ LocalStorage / State
  const [user, setUser] = useState(() => {
    if (propUser) return propUser;
    try {
      const savedUser = sessionStorage.getItem('datsan_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (propUser !== undefined) setUser(propUser);
  }, [propUser]);

  useEffect(() => {
    const handleAuthChange = (e) => {
      setUser(e.detail !== undefined ? e.detail : null);
    };
    window.addEventListener('datsan_auth_change', handleAuthChange);
    return () => window.removeEventListener('datsan_auth_change', handleAuthChange);
  }, []);

  // 2. Profile Form State
  const [hoTen, setHoTen] = useState(user?.HoTen || user?.hoten || '');
  const [email, setEmail] = useState(user?.Email || user?.email || '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // 3. Booking History & Reviews State
  const [bookingList, setBookingList] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');

  // 4. Rating Modal State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedBookingForRating, setSelectedBookingForRating] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [evaluatedBookings, setEvaluatedBookings] = useState([]);

  // 5. Customer Self-Cancellation & Refund States
  const [customerRefunds, setCustomerRefunds] = useState([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState(null);
  const [cancelCheckResult, setCancelCheckResult] = useState(null);
  const [cancelReason, setCancelReason] = useState('Bận việc đột xuất');
  const [refundBank, setRefundBank] = useState({
    nganhang: 'Vietcombank',
    sotaikhoan: '001100888888',
    tentaikhoan: ''
  });
  const [isCheckingCancel, setIsCheckingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // 6. Partial Cancellation States (TASK 02)
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [selectedBookingForPartial, setSelectedBookingForPartial] = useState(null);
  const [partialCheckResult, setPartialCheckResult] = useState(null);
  const [selectedSlotIdsToCancel, setSelectedSlotIdsToCancel] = useState([]);
  const [isCheckingPartial, setIsCheckingPartial] = useState(false);
  const [isSubmittingPartial, setIsSubmittingPartial] = useState(false);
  const [partialCancelError, setPartialCancelError] = useState('');
  const [partialReason, setPartialReason] = useState('Thay đổi kế hoạch thi đấu');

  // Tải danh sách đơn đặt sân từ Supabase
  const fetchUserBookings = async () => {
    if (!user?.MaNguoiDung && !user?.manguoidung) {
      setLoadingBookings(false);
      return;
    }
    const userId = user.MaNguoiDung || user.manguoidung;

    try {
      setLoadingBookings(true);
      const { data: bookingsData, error } = await supabase
        .from('datsan')
        .select(`
          madatsan,
          ngaydat,
          ngaysudung,
          tongtien,
          trangthai,
          ghichu,
          san (
            masan,
            tensan,
            giasan,
            hinhanh,
            vitri (diachi, quan)
          ),
          datsan_khunggio (
            makhunggio,
            khunggio (giobatdau, gioketthuc)
          )
        `)
        .eq('makhachhang', userId)
        .order('ngaydat', { ascending: false });

      if (error) throw error;

      if (bookingsData) {
        setBookingList(bookingsData);
      }

      const { data: reviewsData } = await supabase
        .from('danhgia')
        .select('madatsan')
        .eq('makhachhang', userId);

      if (reviewsData) {
        setEvaluatedBookings(reviewsData.map(r => r.madatsan));
      }

      // Tải danh sách hoàn tiền
      try {
        const refundRes = await fetchCustomerRefunds();
        if (refundRes?.refunds) {
          setCustomerRefunds(refundRes.refunds);
        }
      } catch (rErr) {
        console.warn('Lỗi tải danh sách hoàn tiền:', rErr);
      }

    } catch (err) {
      console.error('Lỗi lấy lịch sử đặt sân:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchUserBookings, 0);
    return () => window.clearTimeout(initialFetch);
  }, []);

  // Xử lý Mở Modal Hủy Sân & Kiểm Tra Thời Hạn
  const handleOpenCancelModal = async (booking) => {
    setSelectedBookingForCancel(booking);
    setShowCancelModal(true);
    setIsCheckingCancel(true);
    setCancelError('');
    setCancelCheckResult(null);
    try {
      const res = await checkCustomerCancellation(booking.madatsan);
      setCancelCheckResult(res);
      if (res?.isOnlinePaid) {
        setRefundBank(prev => ({
          ...prev,
          tentaikhoan: user?.HoTen || user?.hoten || ''
        }));
      }
    } catch (err) {
      setCancelError(err?.message || 'Lỗi kiểm tra điều kiện hủy');
    } finally {
      setIsCheckingCancel(false);
    }
  };

  // Thực hiện Hủy Sân
  const handleExecuteCancel = async () => {
    if (!selectedBookingForCancel) return;
    setIsCancelling(true);
    setCancelError('');
    try {
      const isOnline = cancelCheckResult?.isOnlinePaid;
      const effectiveAccount = refundBank.sotaikhoan?.trim() || '001100888888';
      const effectiveHolder = refundBank.tentaikhoan?.trim() || user?.hoten || 'KHACH HANG';
      const effectiveBank = refundBank.nganhang || 'Vietcombank';

      const res = await cancelCustomerBooking({
        bookingId: selectedBookingForCancel.madatsan,
        reason: cancelReason,
        bankName: isOnline ? effectiveBank : undefined,
        bankAccount: isOnline ? effectiveAccount : undefined,
        accountHolder: isOnline ? effectiveHolder : undefined
      });

      if (res?.success) {
        alert('✅ Hủy đơn đặt sân thành công!' + (isOnline ? ' Yêu cầu hoàn tiền đã gửi đến Chủ sân (thời hạn 24h).' : ''));
        setShowCancelModal(false);
        fetchUserBookings();
      } else {
        throw new Error(res?.reason || 'Hủy thất bại');
      }
    } catch (err) {
      setCancelError(err?.message || 'Lỗi khi hủy đặt sân');
    } finally {
      setIsCancelling(false);
    }
  };

  // Mở Modal Điều chỉnh hủy một phần khung giờ
  const handleOpenPartialModal = async (booking) => {
    setSelectedBookingForPartial(booking);
    setShowPartialModal(true);
    setIsCheckingPartial(true);
    setSelectedSlotIdsToCancel([]);
    setPartialCancelError('');
    setPartialCheckResult(null);
    try {
      const res = await checkCustomerCancellation(booking.madatsan);
      setPartialCheckResult(res);
      if (res?.isOnlinePaid) {
        setRefundBank(prev => ({
          ...prev,
          tentaikhoan: user?.HoTen || user?.hoten || prev.tentaikhoan || 'KHACH HANG'
        }));
      }
    } catch (err) {
      setPartialCancelError(err?.message || 'Lỗi kiểm tra điều kiện hủy khung giờ');
    } finally {
      setIsCheckingPartial(false);
    }
  };

  const handleToggleSlotSelection = (slotId) => {
    setSelectedSlotIdsToCancel(prev => 
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  // Thực hiện Hủy một phần khung giờ
  const handleExecutePartialCancel = async () => {
    if (!selectedBookingForPartial || selectedSlotIdsToCancel.length === 0) return;
    setIsSubmittingPartial(true);
    setPartialCancelError('');
    try {
      const isOnline = partialCheckResult?.isOnlinePaid;
      const effectiveAccount = refundBank.sotaikhoan?.trim() || '001100888888';
      const effectiveHolder = refundBank.tentaikhoan?.trim() || user?.hoten || 'KHACH HANG';
      const effectiveBank = refundBank.nganhang || 'Vietcombank';

      const res = await cancelPartialCustomerBooking({
        bookingId: selectedBookingForPartial.madatsan,
        slotIds: selectedSlotIdsToCancel,
        reason: partialReason,
        bankName: isOnline ? effectiveBank : undefined,
        bankAccount: isOnline ? effectiveAccount : undefined,
        accountHolder: isOnline ? effectiveHolder : undefined
      });

      if (res?.success) {
        alert(res?.message || '✅ Đã điều chỉnh hủy khung giờ thành công!');
        setShowPartialModal(false);
        fetchUserBookings();
      } else {
        throw new Error(res?.message || res?.reason || 'Lỗi xử lý điều chỉnh khung giờ');
      }
    } catch (err) {
      setPartialCancelError(err?.message || 'Lỗi khi điều chỉnh khung giờ');
    } finally {
      setIsSubmittingPartial(false);
    }
  };

  // Khách xác nhận nhận tiền hoàn hoặc khiếu nại tranh chấp
  const handleConfirmRefund = async (refundId, action) => {
    let disputeReason = '';
    if (action === 'DISPUTE') {
      const reason = window.prompt('Nhập lý do chưa nhận được tiền hoặc khiếu nại:', 'Chủ sân báo đã chuyển nhưng tài khoản tôi chưa nhận được tiền');
      if (reason === null) return;
      disputeReason = reason.trim() || 'Chưa nhận được tiền vào tài khoản';
    }

    try {
      const res = await confirmCustomerRefundReceived(refundId, { action, disputeReason });
      if (res?.success) {
        alert(action === 'CONFIRM' ? '✅ Đã xác nhận nhận tiền thành công!' : '⚠️ Đã mở khiếu nại tranh chấp. Admin sàn sẽ can thiệp kiểm tra.');
        fetchUserBookings();
      } else {
        alert('Lỗi: ' + (res?.error || 'Không thể thực hiện'));
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  // Xử lý Cập nhật thông tin cá nhân
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const userId = user.MaNguoiDung || user.manguoidung;
    if (!userId) return;

    try {
      setIsUpdatingUser(true);
      const { error } = await supabase
        .from('nguoidung')
        .update({
          hoten: hoTen,
          email: email
        })
        .eq('manguoidung', userId);

      if (error) throw error;

      const updatedUser = {
        ...user,
        HoTen: hoTen,
        hoten: hoTen,
        Email: email,
        email: email
      };
      setUser(updatedUser);
      if (typeof propSetUser === 'function') propSetUser(updatedUser);
      broadcastAuthChange(updatedUser);
      sessionStorage.setItem('datsan_user', JSON.stringify(updatedUser));

      setIsEditingProfile(false);
      alert('Cập nhật thông tin cá nhân thành công!');
    } catch (err) {
      alert('Lỗi khi cập nhật thông tin: ' + err.message);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // Xử lý Gửi Đánh Giá Sân
  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!selectedBookingForRating) return;
    const userId = user.MaNguoiDung || user.manguoidung;
    const maDatSan = selectedBookingForRating.madatsan;

    try {
      setIsSubmittingRating(true);
      const { error } = await supabase
        .from('danhgia')
        .insert([
          {
            madatsan: maDatSan,
            makhachhang: userId,
            sosao: ratingStars,
            noidung: ratingComment
          }
        ]);

      if (error) throw error;

      alert('Cảm ơn bạn đã gửi đánh giá!');
      setEvaluatedBookings((prev) => [...prev, maDatSan]);
      setShowRatingModal(false);
      setSelectedBookingForRating(null);
      setRatingComment('');
      setRatingStars(5);
    } catch (err) {
      alert('Lỗi khi gửi đánh giá: ' + (err.message || 'Mỗi đơn đặt sân chỉ được đánh giá 1 lần.'));
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const parseBookingMeta = (ghichu) => {
    try {
      return JSON.parse(ghichu || '{}');
    } catch (e) {
      return {};
    }
  };

  const filteredBookings = bookingList.filter((b) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return b.trangthai === 'CHO_THI_DAU' || b.trangthai === 'CHOXACNHAN' || b.trangthai === 'DA_THANH_TOAN';
    if (activeTab === 'HOANTHANH') return b.trangthai === 'HOAN_THANH' || b.trangthai === 'HOANTHANH' || b.trangthai === 'DACANCOC';
    if (activeTab === 'DAHUY') return b.trangthai === 'DA_HUY' || b.trangthai === 'DAHUY';
    return true;
  });

  const getStatusBadge = (item) => {
    const trangThai = item.trangthai;
    const meta = parseBookingMeta(item.ghichu);
    const method = meta.paymentMethod || 'QR';

    if (trangThai === 'DA_THANH_TOAN') {
      return (
        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full inline-flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ĐÃ THANH TOÁN 100% (QR)
        </span>
      );
    }
    if (trangThai === 'CHO_THI_DAU') {
      return (
        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full inline-flex items-center gap-1 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-blue-600" /> TIỀN MẶT (Trả tại sân)
        </span>
      );
    }
    if (trangThai === 'HOAN_THANH' || trangThai === 'HOANTHANH') {
      return (
        <span className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-full inline-flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" /> HOÀN THÀNH {method === 'TIEN_MAT' ? '(ĐÃ THU TIỀN MẶT)' : '(QR)'}
        </span>
      );
    }
    if (trangThai === 'DA_HUY' || trangThai === 'DAHUY') {
      return (
        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-full inline-flex items-center gap-1 shadow-sm">
          <XCircle className="w-3.5 h-3.5 text-rose-600" /> ĐÃ HỦY / BÙNG TRẬN
        </span>
      );
    }
    if (trangThai === 'DACANCOC') {
      return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Đã xác nhận</span>;
    }
    if (trangThai === 'CHOXACNHAN') {
      return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full inline-flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Chờ xác nhận</span>;
    }
    return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full">{trangThai}</span>;
  };

  const userRole = user?.VaiTro || user?.vaitro || 'KHACHHANG';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-16">
      <Header user={user} setUser={setUser} />

      <main className="max-w-[1200px] mx-auto px-4 pt-6">
        {/* Nút quay lại trang chủ bằng useNavigate */}
        <button 
          onClick={() => navigate('/')} 
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-700 transition mb-6 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Quay lại trang chủ
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CỘT TRÁI: THÔNG TIN TÀI KHOẢN */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600 absolute top-0 left-0 right-0"></div>
              
              <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-black text-2xl border-4 border-white shadow-md mb-3">
                  {(hoTen || 'U').charAt(0).toUpperCase()}
                </div>
                <h2 className="text-lg font-black text-slate-900">{hoTen || 'Khách hàng'}</h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold mt-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  {userRole === 'CHUSAN' ? 'Chủ Sân Thể Thao' : userRole === 'ADMIN' ? 'Quản Trị Viên' : 'Khách Hàng'}
                </div>
              </div>

              {/* Form Thông tin */}
              <form onSubmit={handleUpdateProfile} className="pt-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Thông Tin Cá Nhân</span>
                  {!isEditingProfile && (
                    <button 
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Họ và tên
                  </label>
                  {isEditingProfile ? (
                    <input 
                      type="text" 
                      value={hoTen}
                      onChange={(e) => setHoTen(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                      required
                    />
                  ) : (
                    <div className="px-3.5 py-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-800 border border-transparent">
                      {hoTen || 'Chưa cập nhật'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Số điện thoại (Tài khoản OTP)
                  </label>
                  <div className="px-3.5 py-2.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed border border-slate-200 flex justify-between items-center">
                    <span>{user?.Sdt || user?.sodienthoai || user?.TenDangNhap}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Đã xác thực</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email liên hệ
                  </label>
                  {isEditingProfile ? (
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Nhập email..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <div className="px-3.5 py-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-800 border border-transparent">
                      {email || 'Chưa có email'}
                    </div>
                  )}
                </div>

                {isEditingProfile && (
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsEditingProfile(false)}
                      className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button 
                      type="submit" 
                      disabled={isUpdatingUser}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" /> Lưu lại
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Khối Đăng ký làm Chủ Sân - ĐÃ SỬA MÀU SẮC SẮC NÉT VÀ CHUYỂN ROUTE CHUẨN XÁC */}
            {userRole === 'KHACHHANG' && (
              <div className="bg-[#064e3b] text-white rounded-2xl p-6 shadow-xl border border-emerald-900 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-emerald-500/30 rounded-xl flex items-center justify-center mb-3 text-amber-300 border border-emerald-400/40">
                    <Award className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-base text-white mb-1.5">Bạn có sân thể thao?</h3>
                  <p className="text-xs text-emerald-100/90 font-medium leading-relaxed mb-5">
                    Đăng ký làm Chủ Sân để quản lý lịch đặt, nhận cọc tự động và gia tăng doanh thu hàng tháng.
                  </p>
                  <button 
                    onClick={() => navigate('/register-field')}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md"
                  >
                    <span>Đăng Ký Làm Chủ Sân ngay</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CỘT PHẢI: LỊCH SỬ ĐẶT SÂN & ĐÁNH GIÁ */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[500px]">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Lịch Sử Đặt Sân</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Theo dõi danh sách sân đã đặt và thực hiện đánh giá sau khi sử dụng</p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 my-5 overflow-x-auto pb-1">
                {[
                  { key: 'ALL', label: 'Tất cả' },
                  { key: 'PENDING', label: 'Chờ thi đấu / Thanh toán' },
                  { key: 'HOANTHANH', label: 'Đã hoàn thành' },
                  { key: 'DAHUY', label: 'Đã hủy' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      activeTab === tab.key 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Danh sách đơn đặt sân */}
              {loadingBookings ? (
                <div className="py-20 text-center text-xs font-bold text-emerald-600">
                  Đang tải lịch sử đặt sân...
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-xs font-bold">Chưa có đơn đặt sân nào thuộc mục này.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((item) => {
                    const sanInfo = item.san || {};
                    const viTriInfo = sanInfo.vitri || {};
                    const isEvaluated = evaluatedBookings.includes(item.madatsan);

                    // TASK 03 (P0): Chỉ đơn HOÀN TẤT THI ĐẤU và đã QUA GIỜ KẾT THÚC mới đủ điều kiện đánh giá
                    const slots = item.datsan_khunggio || [];
                    let latestEnd = '00:00:00';
                    for (const s of slots) {
                      const end = s.khunggio?.gioketthuc || '00:00:00';
                      if (end > latestEnd) latestEnd = end;
                    }
                    const isStatusCompleted = item.trangthai === 'HOAN_THANH' || item.trangthai === 'HOANTHANH';
                    let matchHasEnded = false;
                    if (latestEnd !== '00:00:00' && item.ngaysudung) {
                      const endHourMin = latestEnd.slice(0, 5);
                      const matchEndDateTime = new Date(`${item.ngaysudung}T${endHourMin}:00+07:00`);
                      matchHasEnded = Date.now() >= matchEndDateTime.getTime();
                    }
                    const isEligibleForReview = isStatusCompleted && matchHasEnded;

                    return (
                      <div key={item.madatsan} className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                              <img 
                                src={sanInfo.hinhanh || 'https://images.unsplash.com/photo-1529900248057-5e632c63c574?auto=format&fit=crop&w=800&q=80'} 
                                alt={sanInfo.tensan}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900">{sanInfo.tensan || 'Sân Thể Thao'}</h4>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" /> {viTriInfo.diachi || 'Đà Nẵng'}, Q. {viTriInfo.quan || 'Hải Châu'}
                              </p>
                            </div>
                          </div>
                          <div>{getStatusBadge(item)}</div>
                        </div>

                        <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Ngày thi đấu</span>
                            <span className="font-extrabold text-slate-800">{item.ngaysudung}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Tổng tiền</span>
                            <span className="font-black text-emerald-700">{Number(item.tongtien).toLocaleString('vi-VN')} đ</span>
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex items-center justify-start sm:justify-end gap-2 flex-wrap">
                            {/* Nút Viết đánh giá cho đơn hoàn thành (TASK 03 P0: chỉ mở khi đã kết thúc trận và hoàn tất) */}
                            {isEligibleForReview && (
                              isEvaluated ? (
                                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Đã đánh giá
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedBookingForRating(item);
                                    setShowRatingModal(true);
                                  }}
                                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1"
                                >
                                  <Star className="w-3.5 h-3.5" /> Viết Đánh Giá
                                </button>
                              )
                            )}

                            {/* Nút Điều Chỉnh Khung Giờ & Hủy Đặt Sân (FEATURE 02: Tự hủy trước >= 4h) */}
                            {['CHO_THI_DAU', 'CHOXACNHAN', 'DA_THANH_TOAN'].includes(item.trangthai) && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenPartialModal(item)}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5" /> Điều Chỉnh Khung Giờ
                                </button>
                                <button
                                  onClick={() => handleOpenCancelModal(item)}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Hủy Toàn Bộ Đơn
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Thông tin hoàn tiền cho đơn đã hủy */}
                        {(item.trangthai === 'DA_HUY' || item.trangthai === 'DAHUY') && (() => {
                          const refund = customerRefunds.find(r => r.madatsan === item.madatsan);
                          if (!refund) return null;
                          return (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 bg-amber-50/50 rounded-xl p-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Hoàn tiền: <strong className="text-emerald-700">{Number(refund.sotien_hoan).toLocaleString('vi-VN')} đ</strong> (Hoàn 100%)</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {refund.trangthai === 'CHO_HOAN' && '⏳ Chờ Chủ Sân chuyển khoản (Hạn chót 24h từ lúc hủy)'}
                                    {refund.trangthai === 'DA_CHUYEN' && `✅ Chủ sân đã báo chuyển khoản ${refund.chusan_nganhang_txid ? `(Mã GD: ${refund.chusan_nganhang_txid})` : ''} - Bạn vui lòng xác nhận`}
                                    {refund.trangthai === 'DA_NHAN' && '🎉 Bạn đã xác nhận nhận đủ 100% tiền hoàn'}
                                    {refund.trangthai === 'TRANH_CHAP' && '⚠️ Đang mở khiếu nại tranh chấp - Admin sàn đang đối soát xử lý'}
                                  </div>
                                </div>
                                {refund.trangthai === 'DA_CHUYEN' && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleConfirmRefund(refund.id, 'CONFIRM')}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                                    >
                                      Đã nhận tiền
                                    </button>
                                    <button
                                      onClick={() => handleConfirmRefund(refund.id, 'DISPUTE')}
                                      className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-lg"
                                    >
                                      Chưa nhận được
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* MODAL ĐÁNH GIÁ SÂN */}
      {showRatingModal && selectedBookingForRating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowRatingModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition"
            >
              ✕
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Đánh Giá Chất Lượng Sân</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedBookingForRating.san?.tensan} • Ngày {selectedBookingForRating.ngaysudung}
              </p>
            </div>

            <form onSubmit={handleSubmitRating} className="space-y-4">
              <div className="flex justify-center items-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingStars(star)}
                    className="p-1 transition hover:scale-110"
                  >
                    <Star 
                      className={`w-8 h-8 ${
                        star <= ratingStars 
                          ? 'fill-amber-400 text-amber-400' 
                          : 'text-slate-200'
                      }`} 
                    />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bình luận / Góp ý</label>
                <textarea 
                  rows={4}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm thực tế về mặt sân, ánh sáng, dịch vụ..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 transition"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowRatingModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingRating}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition"
                >
                  {isSubmittingRating ? 'Đang gửi...' : 'Gửi Đánh Giá'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL HỦY ĐẶT SÂN & HOÀN TIỀN (FEATURE 02) */}
      {showCancelModal && selectedBookingForCancel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowCancelModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition"
            >
              ✕
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Hủy Đặt Sân & Chính Sách Hoàn Tiền</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedBookingForCancel.san?.tensan} • Ngày {selectedBookingForCancel.ngaysudung}
              </p>
            </div>

            {isCheckingCancel ? (
              <div className="py-8 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                Đang kiểm tra thời hạn và điều kiện hủy...
              </div>
            ) : cancelCheckResult ? (
              <div className="space-y-4">
                {/* Kết quả kiểm tra */}
                {cancelCheckResult.eligible ? (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Hợp lệ tự hủy (Còn {cancelCheckResult.hoursRemaining} giờ trước trận)</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      {cancelCheckResult.reason}
                    </p>
                    {cancelCheckResult.isOnlinePaid ? (
                      <>
                        <p className="text-[11px] font-bold text-emerald-950 mt-1">
                          💰 Số tiền hoàn trả 100%: <span className="text-sm font-black text-emerald-600">{Number(cancelCheckResult.refundAmount).toLocaleString('vi-VN')} đ</span>. Chủ sân sẽ chuyển hoàn theo thông tin tài khoản ngân hàng của bạn.
                        </p>
                        <div className="text-[10px] text-slate-600 bg-slate-100 p-2 rounded-lg border border-slate-200 font-medium mt-1">
                          ℹ️ Giao dịch thử nghiệm – không phát sinh chuyển tiền thật.
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] font-bold text-emerald-950 mt-1">
                        ℹ️ Đơn thanh toán tiền mặt tại sân: Lịch sân sẽ được giải phóng ngay lập tức mà không phát sinh chi phí.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5 text-rose-900">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Không thể tự hủy đơn đặt sân này</span>
                    </div>
                    <p className="text-[11px] text-rose-700">
                      {cancelCheckResult.reason}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Chính sách quy định: Khách hàng chỉ được tự hủy trước giờ thi đấu tối thiểu 4 tiếng.
                    </p>
                  </div>
                )}

                {/* Form tài khoản nhận hoàn tiền nếu đã thanh toán Online */}
                {cancelCheckResult.eligible && cancelCheckResult.isOnlinePaid && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Thông tin tài khoản nhận hoàn tiền</span>
                    </div>

                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-700">
                      ℹ️ Giao dịch thử nghiệm – không phát sinh chuyển tiền thật. Vui lòng chọn ngân hàng và số tài khoản để nhận chuyển khoản hoàn tất đối soát.
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Ngân hàng thụ hưởng</label>
                        <select
                          value={refundBank.nganhang}
                          onChange={(e) => setRefundBank({ ...refundBank, nganhang: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Vietcombank">Vietcombank</option>
                          <option value="MB Bank">MB Bank</option>
                          <option value="Techcombank">Techcombank</option>
                          <option value="BIDV">BIDV</option>
                          <option value="VietinBank">VietinBank</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Số tài khoản nhận hoàn tiền</label>
                        <input
                          type="text"
                          placeholder="001100888888"
                          value={refundBank.sotaikhoan}
                          onChange={(e) => setRefundBank({ ...refundBank, sotaikhoan: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên chủ tài khoản</label>
                        <input
                          type="text"
                          placeholder="NGUYEN VAN A"
                          value={refundBank.tentaikhoan}
                          onChange={(e) => setRefundBank({ ...refundBank, tentaikhoan: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Lý do hủy */}
                {cancelCheckResult.eligible && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Lý do hủy đặt sân</label>
                    <select
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Bận việc đột xuất">Bận việc đột xuất</option>
                      <option value="Thời tiết không thuận lợi">Thời tiết không thuận lợi</option>
                      <option value="Thiếu người tham gia">Thiếu người tham gia</option>
                      <option value="Đặt nhầm khung giờ hoặc sân">Đặt nhầm khung giờ hoặc sân</option>
                      <option value="Khác">Lý do khác</option>
                    </select>
                  </div>
                )}

                {cancelError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                    ⚠️ {cancelError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Đóng
                  </button>
                  {cancelCheckResult.eligible && (
                    <button 
                      type="button"
                      disabled={isCancelling}
                      onClick={handleExecuteCancel}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isCancelling ? 'Đang hủy...' : 'Xác Nhận Hủy Sân'}
                    </button>
                  )}
                </div>
              </div>
            ) : null}

          </div>
        </div>
      )}

      {/* MODAL ĐIỀU CHỈNH KHUNG GIỜ (TASK 02: PARTIAL CANCELLATION) */}
      {showPartialModal && selectedBookingForPartial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowPartialModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                Điều Chỉnh Khung Giờ
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                Hủy Một Phần Khung Giờ Đặt Sân
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Đơn #{selectedBookingForPartial.madatsan} • {selectedBookingForPartial.san?.tensan} • Ngày {selectedBookingForPartial.ngaysudung}
              </p>
            </div>

            {isCheckingPartial ? (
              <div className="py-8 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                Đang tải danh sách khung giờ và kiểm tra điều kiện hủy...
              </div>
            ) : partialCheckResult ? (
              <div className="space-y-4">
                {/* Hướng dẫn quy tắc 4 tiếng */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700">
                  <p className="font-bold text-slate-900 mb-1">Chính sách hủy từng phần:</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    • Bạn có thể chọn hủy 1 hoặc nhiều khung giờ trong đơn. Khung giờ được hủy phải trước giờ thi đấu tối thiểu 4 tiếng.
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    • Các khung giờ không chọn hủy vẫn được giữ nguyên để bạn thi đấu.
                  </p>
                </div>

                {/* Danh sách các khung giờ trong đơn */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex justify-between items-center">
                    <span>Chọn khung giờ bạn muốn hủy:</span>
                    <span className="text-[11px] text-slate-500">Đã chọn: {selectedSlotIdsToCancel.length}/{partialCheckResult.slots?.length || 0}</span>
                  </div>

                  {partialCheckResult.slots && partialCheckResult.slots.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {partialCheckResult.slots.map((slot) => {
                        const isSelected = selectedSlotIdsToCancel.includes(slot.makhunggio);
                        return (
                          <div
                            key={slot.makhunggio}
                            onClick={() => slot.canCancel && handleToggleSlotSelection(slot.makhunggio)}
                            className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                              !slot.canCancel
                                ? 'bg-slate-50/80 border-slate-200 opacity-60 cursor-not-allowed'
                                : isSelected
                                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20 cursor-pointer'
                                : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!slot.canCancel}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                              />
                              <div>
                                <div className="text-xs font-black text-slate-900">
                                  {slot.giobatdau} - {slot.gioketthuc}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {slot.canCancel ? (
                                    <span className="text-emerald-700 font-bold">Hợp lệ hủy (còn {slot.hoursRemaining}h)</span>
                                  ) : (
                                    <span className="text-rose-600 font-bold">Không thể hủy (còn {slot.hoursRemaining}h &lt; 4h)</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-black text-slate-900">
                                {Number(slot.giadat || 0).toLocaleString('vi-VN')} đ
                              </div>
                              <span className="text-[10px] text-slate-400">Giá đặt</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 text-center text-xs text-slate-500 rounded-xl">
                      Không tìm thấy khung giờ nào khả dụng trong đơn.
                    </div>
                  )}
                </div>

                {/* Tóm tắt tính toán động */}
                {selectedSlotIdsToCancel.length > 0 && (() => {
                  const selectedSlots = (partialCheckResult.slots || []).filter(s => selectedSlotIdsToCancel.includes(s.makhunggio));
                  const refundEst = selectedSlots.reduce((sum, s) => sum + Number(s.giadat || 0), 0);
                  const currentTotal = Number(selectedBookingForPartial.tongtien || 0);
                  const newTotalEst = Math.max(0, currentTotal - refundEst);
                  const isOnline = partialCheckResult.isOnlinePaid;
                  const isAll = selectedSlotIdsToCancel.length >= (partialCheckResult.slots?.length || 0);

                  return (
                    <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs space-y-2">
                      <div className="font-extrabold text-amber-950 flex items-center justify-between">
                        <span>Tạm tính điều chỉnh ({selectedSlotIdsToCancel.length} khung giờ):</span>
                        {isAll && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                            Hủy toàn bộ đơn
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between text-slate-700 text-[11px]">
                        <span>Số tiền {isOnline ? 'hoàn lại (100%)' : 'giảm trừ tại sân'}:</span>
                        <strong className="text-rose-600 text-xs">-{refundEst.toLocaleString('vi-VN')} đ</strong>
                      </div>
                      <div className="flex justify-between text-slate-900 text-xs pt-1.5 border-t border-amber-200/60 font-bold">
                        <span>Tổng tiền còn lại sau điều chỉnh:</span>
                        <strong className="text-emerald-700 text-sm">{newTotalEst.toLocaleString('vi-VN')} đ</strong>
                      </div>
                    </div>
                  );
                })()}

                {/* Form tài khoản nhận hoàn tiền nếu đã thanh toán Online */}
                {partialCheckResult.isOnlinePaid && selectedSlotIdsToCancel.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Thông tin tài khoản nhận hoàn tiền</span>
                    </div>

                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-700">
                      ℹ️ Giao dịch thử nghiệm – không phát sinh chuyển tiền thật. Chủ sân sẽ đối soát và thực hiện hoàn tiền theo tài khoản này.
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Ngân hàng thụ hưởng</label>
                        <select
                          value={refundBank.nganhang}
                          onChange={(e) => setRefundBank({ ...refundBank, nganhang: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Vietcombank">Vietcombank</option>
                          <option value="MB Bank">MB Bank</option>
                          <option value="Techcombank">Techcombank</option>
                          <option value="BIDV">BIDV</option>
                          <option value="VietinBank">VietinBank</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Số tài khoản nhận hoàn tiền</label>
                        <input
                          type="text"
                          placeholder="001100888888"
                          value={refundBank.sotaikhoan}
                          onChange={(e) => setRefundBank({ ...refundBank, sotaikhoan: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên chủ tài khoản</label>
                        <input
                          type="text"
                          placeholder="NGUYEN VAN A"
                          value={refundBank.tentaikhoan}
                          onChange={(e) => setRefundBank({ ...refundBank, tentaikhoan: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Lý do điều chỉnh */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lý do điều chỉnh khung giờ</label>
                  <select
                    value={partialReason}
                    onChange={(e) => setPartialReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Thay đổi kế hoạch thi đấu">Thay đổi kế hoạch thi đấu</option>
                    <option value="Giảm thời gian thi đấu">Giảm thời gian thi đấu</option>
                    <option value="Thiếu người tham gia khung giờ này">Thiếu người tham gia khung giờ này</option>
                    <option value="Đặt nhầm khung giờ">Đặt nhầm khung giờ</option>
                    <option value="Khác">Lý do khác</option>
                  </select>
                </div>

                {partialCancelError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                    ⚠️ {partialCancelError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowPartialModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button 
                    type="button"
                    disabled={selectedSlotIdsToCancel.length === 0 || isSubmittingPartial}
                    onClick={handleExecutePartialCancel}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isSubmittingPartial ? 'Đang xử lý...' : `Xác Nhận Hủy (${selectedSlotIdsToCancel.length} ca)`}
                  </button>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      )}

    </div>
  );
}
