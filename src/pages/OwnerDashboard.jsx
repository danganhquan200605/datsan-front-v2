import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, DollarSign, Calendar, Users, Star, CheckCircle2, 
  Clock, MapPin, Phone, AlertCircle, PlusCircle, RefreshCw, ChevronRight, Eye,
  QrCode, X, Check, XCircle
} from 'lucide-react';
import { supabase, settleOwnerBooking } from '../supabaseClient';
import Header from '../components/Header';

export default function OwnerDashboard() {
  const navigate = useNavigate();

  // Lấy thông tin chủ sân đang đăng nhập
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem('datsan_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const ownerId = currentUser?.MaNguoiDung || currentUser?.manguoidung;

  // States dữ liệu
  const [sanList, setSanList] = useState([]);
  const [bookingList, setBookingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('BOOKINGS'); // BOOKINGS | FIELDS
  const [bookingFilterStatus, setBookingFilterStatus] = useState('ALL');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  // Helper parse metadata ghichu
  const parseMeta = (ghichu) => {
    try {
      return JSON.parse(ghichu || '{}');
    } catch {
      return {};
    }
  };

  // Fetch dữ liệu của riêng Chủ sân từ Supabase
  const fetchOwnerData = async () => {
    if (!ownerId) return;
    try {
      setLoading(true);

      // 1. Lấy danh sách sân thuộc sở hữu của chủ sân này
      const { data: mySanData, error: sanErr } = await supabase
        .from('san')
        .select(`
          masan,
          tensan,
          giasan,
          hinhanh,
          trangthai,
          vitri (diachi, quan)
        `)
        .eq('machusan', ownerId);

      if (sanErr) throw sanErr;
      setSanList(mySanData || []);

      const sanIds = (mySanData || []).map(s => s.masan);

      if (sanIds.length > 0) {
        // 2. Lấy danh sách đơn đặt sân thuộc các sân của chủ sân này (bao gồm cả ghichu)
        const { data: bookingsData, error: bookingErr } = await supabase
          .from('datsan')
          .select(`
            madatsan,
            ngaydat,
            ngaysudung,
            tongtien,
            trangthai,
            ghichu,
            san (tensan),
            nguoidung:makhachhang (hoten, sodienthoai),
            datsan_khunggio (
              khunggio (giobatdau, gioketthuc)
            )
          `)
          .in('masan', sanIds)
          .order('ngaydat', { ascending: false });

        if (bookingErr) throw bookingErr;
        setBookingList(bookingsData || []);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu Owner Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchOwnerData, 0);
    return () => window.clearTimeout(initialFetch);
  }, [ownerId]);

  // Cập nhật trạng thái đơn đặt sân thông thường
  const handleUpdateBookingStatus = async (maDatSan, newStatus) => {
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

  // Xử lý xác nhận thu tiền mặt / hủy trận / nộp hoa hồng
  const handleSettleAction = async (action, bookingId = null) => {
    try {
      setIsSettling(true);
      const res = await settleOwnerBooking(action, bookingId, ownerId);
      if (res && res.error) throw new Error(res.error);

      if (action === 'CONFIRM_CASH') {
        alert('✅ Đã xác nhận thu 100% tiền mặt & hoàn thành trận! Phí hoa hồng 10% đã được ghi vào Sổ Nợ.');
      } else if (action === 'CANCEL_NO_SHOW') {
        alert('✅ Đã hủy trận (khách bùng/hủy). Phí hoa hồng là 0 đ.');
      } else if (action === 'SETTLE_ALL_COMMISSIONS') {
        alert('🎉 Đã nộp hoa hồng thành công! Số nợ hoa hồng đã về 0 đ.');
        setShowSettleModal(false);
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
    if (bookingFilterStatus === 'ALL') return true;
    if (bookingFilterStatus === 'CHO_THI_DAU') return b.trangthai === 'CHO_THI_DAU' || b.trangthai === 'CHOXACNHAN';
    if (bookingFilterStatus === 'DA_THANH_TOAN') return b.trangthai === 'DA_THANH_TOAN' || b.trangthai === 'DACANCOC';
    if (bookingFilterStatus === 'HOAN_THANH') return b.trangthai === 'HOAN_THANH' || b.trangthai === 'HOANTHANH';
    if (bookingFilterStatus === 'DA_HUY') return b.trangthai === 'DA_HUY' || b.trangthai === 'DAHUY';
    return b.trangthai === bookingFilterStatus;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-16">
      <Header user={currentUser} setUser={setCurrentUser} />

      <main className="max-w-[1440px] mx-auto px-6 pt-8">
        
        {/* HEADER DASHBOARD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
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
            <p className="text-[11px] text-emerald-600 font-bold mt-1">Từ các đơn 100% thanh toán & tiền mặt</p>
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
            <p className="text-[11px] text-purple-600 font-bold mt-1">Dựa trên nhận xét thực tế</p>
          </div>

        </div>

        {/* SỔ NỢ HOA HỒNG BANNER CẦN NỘP ADMIN */}
        {totalPendingCommission > 0 && (
          <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-5 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                  THÔNG BÁO: SỔ NỢ HOA HỒNG HỆ THỐNG
                  <span className="px-2.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                    {pendingCommissionBookings.length} đơn tiền mặt thành công
                  </span>
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Bạn có các ca thi đấu tiền mặt đã hoàn thành thu tiền trực tiếp từ khách. Tổng số tiền hoa hồng 10% cần nộp về cho Ban Quản Trị:
                  <span className="ml-1.5 text-base font-black text-rose-600">
                    {totalPendingCommission.toLocaleString('vi-VN')} đ
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettleModal(true)}
              className="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap"
            >
              <QrCode className="w-4 h-4" /> QUÉT QR NỘP HOA HỒNG CHO ADMIN
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
          </div>

          <div className="p-6">
            
            {/* TAB 1: DANH SÁCH ĐƠN ĐẶT SÂN & KHÁCH HÀNG */}
            {activeTab === 'BOOKINGS' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2 overflow-x-auto">
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                          bookingFilterStatus === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="py-16 text-center text-xs font-bold text-emerald-600">Đang tải danh sách đơn...</div>
                ) : filteredBookings.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-xs font-bold">Chưa có đơn đặt sân nào trong danh mục này.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="py-3 px-4">Khách Hàng & SĐT</th>
                          <th className="py-3 px-4">Tên Sân & Ngày Đá</th>
                          <th className="py-3 px-4">Tổng Tiền (100%)</th>
                          <th className="py-3 px-4">Hình Thức & Hoa Hồng</th>
                          <th className="py-3 px-4">Trạng Thái</th>
                          <th className="py-3 px-4 text-right">Thao Tác Chủ Sân</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBookings.map((b) => {
                          const khachHang = b.nguoidung || {};
                          const meta = parseMeta(b.ghichu);
                          const method = meta.paymentMethod || (b.trangthai === 'CHO_THI_DAU' ? 'TIEN_MAT' : 'QR');
                          const commissionAmt = meta.commissionAmount || Math.round(Number(b.tongtien || 0) * 0.1);
                          const isCash = method === 'TIEN_MAT';
                          const isPendingCash = (b.trangthai === 'CHO_THI_DAU' || b.trangthai === 'CHOXACNHAN') && isCash;
                          const isPendingQR = b.trangthai === 'DA_THANH_TOAN' || b.trangthai === 'DACANCOC';
                          const isCompleted = b.trangthai === 'HOAN_THANH' || b.trangthai === 'HOANTHANH';
                          const isCancelled = b.trangthai === 'DA_HUY' || b.trangthai === 'DAHUY';

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
                              </td>
                              <td className="py-4 px-4 font-black text-rose-600">
                                {Number(b.tongtien).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="py-4 px-4">
                                {isCash ? (
                                  <div>
                                    <span className="font-bold text-blue-700 flex items-center gap-1">
                                      <DollarSign className="w-3.5 h-3.5" /> Tiền mặt tại sân
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      {isCompleted && meta.commissionStatus === 'CHO_CHUSAN_NOP' 
                                        ? <span className="text-amber-600 font-bold">Nợ Admin: {commissionAmt.toLocaleString('vi-VN')} đ</span>
                                        : isCompleted && meta.commissionStatus === 'DA_QUYET_TOAN'
                                        ? <span className="text-emerald-600 font-bold">Đã nộp Admin 10%</span>
                                        : isCancelled
                                        ? <span>Hoa hồng: 0 đ</span>
                                        : <span>Ghi nợ 10% khi xong: {commissionAmt.toLocaleString('vi-VN')} đ</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                                      <QrCode className="w-3.5 h-3.5" /> VietQR (100%)
                                    </span>
                                    <div className="text-[10px] text-emerald-600 mt-0.5">
                                      Sàn đã thu & trích 10% hoa hồng
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                {isPendingCash && (
                                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                                    Chờ đấu (Thu tiền mặt)
                                  </span>
                                )}
                                {isPendingQR && (
                                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                                    Đã TT 100% (QR)
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                                    isCash && meta.commissionStatus === 'CHO_CHUSAN_NOP'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {isCash && meta.commissionStatus === 'CHO_CHUSAN_NOP' ? 'Hoàn thành (Chờ nộp 10%)' : 'Hoàn thành'}
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                                    Đã hủy / Bùng trận
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                                {isPendingCash && (
                                  <>
                                    <button
                                      disabled={isSettling}
                                      onClick={() => handleSettleAction('CONFIRM_CASH', b.madatsan)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                                    >
                                      ✓ Đã thu tiền mặt & Xong
                                    </button>
                                    <button
                                      disabled={isSettling}
                                      onClick={() => handleSettleAction('CANCEL_NO_SHOW', b.madatsan)}
                                      className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] rounded-lg"
                                    >
                                      ✕ Bùng / Hủy
                                    </button>
                                  </>
                                )}
                                {isPendingQR && (
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.madatsan, 'HOAN_THANH')}
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg shadow-sm"
                                  >
                                    Hoàn thành trận
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

          </div>

        </div>

        {/* MODAL NỘP HOA HỒNG CHO ADMIN QUA VIETQR */}
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
                  Sổ Nợ Hoa Hồng Admin
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">Nộp Hoa Hồng 10% Cho Sàn</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Thanh toán hoa hồng cho {pendingCommissionBookings.length} đơn tiền mặt đã thu
                </p>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-center mb-5">
                <div className="text-xs font-bold text-slate-700 mb-2">Quét mã VietQR MBBank để nộp hoa hồng</div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-sm">
                  <img 
                    src={`https://img.vietqr.io/image/970422-0901111111-compact2.png?amount=${totalPendingCommission}&addInfo=HOAHONG%20${ownerId}&accountName=DATSAN%20ONLINE`} 
                    alt="VietQR MBBank Admin" 
                    className="w-48 h-48 mx-auto object-contain"
                  />
                </div>
                <div className="mt-3 text-[11px] text-slate-600 space-y-0.5">
                  <div>Ngân hàng: <strong className="text-slate-800">MBBank</strong> | STK: <strong className="text-slate-800">0901111111</strong></div>
                  <div>Người nhận: <strong className="text-slate-800">LÊ HOÀNG QUẢN TRỊ (ADMIN)</strong></div>
                  <div className="text-base font-black text-rose-600 mt-2">
                    Tổng tiền nộp: {totalPendingCommission.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSettleModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Để sau
                </button>
                <button
                  disabled={isSettling}
                  onClick={() => handleSettleAction('SETTLE_ALL_COMMISSIONS')}
                  className="flex-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSettling ? 'ĐANG QUYẾT TOÁN...' : '⚡ XÁC NHẬN ĐÃ NỘP HOA HỒNG (DEMO)'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
