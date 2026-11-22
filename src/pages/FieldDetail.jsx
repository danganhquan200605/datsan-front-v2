import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link, useParams, useLocation } from 'react-router-dom';
import { 
  MapPin, Calendar, Clock, ArrowLeft, ShieldCheck, Zap, Star, 
  Check, Phone, CheckCircle, Navigation, Coffee, Award, ChevronRight, Video, Sparkles, Car, Wifi, Info,
  Tv, Heart, ExternalLink, Shield, RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2, User, Users,
  Search, Bell, LogIn, LogOut, Building2, PlusCircle, LayoutDashboard, X, QrCode, DollarSign
} from 'lucide-react';
import { requestPhoneOtp, supabase, verifyPhoneOtp, broadcastAuthChange, getMockBookingQrSvg, simulateBookingPayment, isSlotInPast, getVietnamNow, calculateSlotsDurationMinutes } from '../supabaseClient';

const getLocalDateValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const getSlotDurationHours = (start, end) => {
  const toMinutes = (value) => {
    const [hours, minutes] = String(value).split(':').map(Number);
    return hours * 60 + minutes;
  };
  let minutes = toMinutes(end) - toMinutes(start);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
};

const getSlotShift = (start) => {
  const hour = Number(String(start).slice(0, 2));
  if (hour >= 7 && hour < 11) return 'MORNING';
  if (hour >= 13 && hour < 17) return 'AFTERNOON';
  if (hour >= 17 && hour < 23) return 'EVENING';
  return 'OTHER';
};

const getQuickDateList = (selectedDateStr) => {
  const todayStr = getLocalDateValue();
  const selected = new Date(`${selectedDateStr || todayStr}T12:00:00`);
  const today = new Date(`${todayStr}T12:00:00`);
  
  const diffDays = Math.round((selected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  let startOffset = 0;
  if (diffDays > 2) {
    startOffset = diffDays - 2;
  }
  if (startOffset < 0) startOffset = 0;
  
  const list = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime());
    d.setDate(today.getDate() + startOffset + i);
    const full = getLocalDateValue(d);
    const dateLabel = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const weekday = d.toLocaleDateString('vi-VN', { weekday: 'short' });
    const weekdayLong = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    
    let title = weekday;
    if (full === todayStr) {
      title = 'Hôm nay';
    } else {
      const tomorrow = new Date(today.getTime());
      tomorrow.setDate(today.getDate() + 1);
      if (full === getLocalDateValue(tomorrow)) {
        title = 'Ngày mai';
      }
    }
    
    list.push({
      full,
      label: `${title} (${dateLabel})`,
      shortLabel: `${dateLabel}`,
      title,
      weekdayLong,
      isSelected: full === selectedDateStr
    });
  }
  return { list, isNotToday: diffDays > 0, todayStr };
};

export default function FieldDetail({ sanId: propSanId, onBack, user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: urlSanId } = useParams();
  
  const currentSanId = Number(urlSanId || propSanId || sessionStorage.getItem('activeSanId') || 1);

  const dropdownRef = useRef(null);
  const datePickerRef = useRef(null);
  const [sanInfo, setSanInfo] = useState(null);
  const [timeSlotList, setTimeSlotList] = useState([]);
  const [pageError, setPageError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [bookedSlotsFromDB, setBookedSlotsFromDB] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(() => {
    return location.state?.selectedDate || new URLSearchParams(window.location.search).get('date') || getLocalDateValue();
  });
  const quickDateInfo = useMemo(() => getQuickDateList(selectedDate), [selectedDate]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedShift, setSelectedShift] = useState('ALL');

  const [currentClock, setCurrentClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const clockFormatted = currentClock.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = currentClock.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  
  // Login Modal States
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginStep, setLoginStep] = useState(1);
  const [loginError, setLoginError] = useState('');

  // States các dịch vụ cộng thêm
  const [services, setServices] = useState({
    water: false,
    bibs: false,
    racketBadminton: false,
    shuttlecock: false,
    racketTennis: false
  });

  // Modal Chọn phương thức thanh toán 100% (QR vs Tiền mặt)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('QR');
  const [pendingBookingData, setPendingBookingData] = useState(null);
  const [simulationFailed, setSimulationFailed] = useState(false);

  const resetAuthForm = () => {
    setLoginStep(1);
    setPhoneNumber('');
    setNormalizedPhone('');
    setOtpCode('');
    setLoginError('');
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();
    const digits = phoneNumber.replace(/\D/g, '');
    const e164Phone = digits.startsWith('0') ? `+84${digits.slice(1)}` : digits.startsWith('84') ? `+${digits}` : `+84${digits}`;
    if (!/^\+84\d{9}$/.test(e164Phone)) {
      setLoginError('Nhập số điện thoại Việt Nam gồm 10 chữ số.');
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
      setLoginError(error.message || 'Không gửi được mã OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setLoginError('');
      const session = await verifyPhoneOtp(normalizedPhone, otpCode.trim());
      sessionStorage.setItem('datsan_access_token', session.accessToken);
      sessionStorage.setItem('datsan_refresh_token', session.refreshToken);
      sessionStorage.setItem('datsan_user', JSON.stringify(session.user));
      if (typeof setUser === 'function') setUser(session.user);
      setShowLoginModal(false);
      resetAuthForm();
    } catch (error) {
      setLoginError(error.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentSanId) sessionStorage.setItem('activeSanId', currentSanId);
    
    async function loadSanBaseInfo() {
      try {
        setInitialLoading(true);
        const [sanResult, vtResult, lsResult, slotResult] = await Promise.all([
          supabase.from('san')
          .select('*')
          .eq('masan', currentSanId)
          .single(),
          supabase.from('vitri').select('*'),
          supabase.from('loaisan').select('*'),
          supabase.from('khunggio').select('*').eq('masan', currentSanId).order('makhunggio')
        ]);
        const failedResult = [sanResult, vtResult, lsResult, slotResult].find((result) => result.error);
        if (failedResult) throw failedResult.error;
        const sanData = sanResult.data;
        const vtData = vtResult.data || [];
        const lsData = lsResult.data || [];
        setTimeSlotList((slotResult.data || []).map((slot) => {
          const id = Number(slot.makhunggio ?? slot.MaKhungGio);
          const start = String(slot.giobatdau ?? slot.GioBatDau ?? '').slice(0, 5);
          const end = String(slot.gioketthuc ?? slot.GioKetThuc ?? '').slice(0, 5);
          const hour = Number(start.slice(0, 2));
          return { id, start, end, isGold: hour >= 17 && hour <= 20, label: `${start} - ${end}` };
        }).filter((slot) => slot.id && slot.start && slot.end));

        if (sanData) {
          const vt = vtData?.find((v) => Number(v.mavitri || v.MaViTri) === Number(sanData.mavitri || sanData.MaViTri)) || {};
          const ls = lsData?.find((l) => Number(l.maloaisan || l.MaLoaiSan) === Number(sanData.maloaisan || sanData.MaLoaiSan)) || {};
          
          setSanInfo({
            MaSan: sanData.masan || sanData.MaSan,
            TenSan: sanData.tensan || sanData.TenSan,
            MoTa: sanData.mota || sanData.MoTa || 'Sân thể thao chất lượng cao.',
            GiaSan: sanData.giasan || sanData.GiaSan || 200000,
            LoaiSanText: ls.tenloaisan || ls.TenLoaiSan || 'Sân Thể Thao',
            ViTri: {
              DiaChi: vt.diachi || vt.DiaChi || 'Chưa cập nhật địa chỉ',
              Phuong: vt.phuong || vt.Phuong || '',
              Quan: vt.quan || vt.Quan || 'Đà Nẵng',
              ThanhPho: vt.thanhpho || vt.ThanhPho || 'Đà Nẵng'
            },
            Rating: 4.9,
            TotalReviews: 148,
            Image: sanData.hinhanh || sanData.HinhAnh || 'https://images.unsplash.com/photo-1529900248057-5e632c63c574?auto=format&fit=crop&w=1200&q=80'
          });
        } else {
          setPageError('Không tìm thấy sân này. Vui lòng quay lại danh sách sân.');
        }
      } catch (err) {
        console.error('Lỗi tải thông tin sân:', err);
        setPageError('Không tải được thông tin sân. Vui lòng thử tải lại trang.');
      } finally {
        setInitialLoading(false);
      }
    }
    loadSanBaseInfo();
  }, [currentSanId]);

  const fetchBookedSlots = async () => {
    try {
      const { data: datSanData, error } = await supabase.availability(selectedDate, currentSanId);
      if (error) throw error;
      setBookedSlotsFromDB(datSanData || []);
      setAvailabilityError('');
    } catch (err) {
      console.error('Lỗi tải lịch cọc:', err);
      setAvailabilityError('Không tải được tình trạng khung giờ. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    fetchBookedSlots();
  }, [currentSanId, selectedDate]);

  useEffect(() => {
    setSelectedSlots(prev => prev.filter(s => !isSlotInPast(selectedDate, s.start)));
  }, [currentClock, selectedDate]);

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setSelectedSlots([]);
  };

  const getCalculatedSlots = () => {
    return timeSlotList.map((slot) => {
      const isBookedInDB = bookedSlotsFromDB.some(
        (b) => Number(b.makhunggio) === Number(slot.id)
          && !['DAHUY', 'DA_HUY', 'HUY'].includes(String(b.trangthai || '').toUpperCase())
      );
      // TASK 01 (P0): Chặn đặt khung giờ trong quá khứ
      const isPast = isSlotInPast(selectedDate, slot.start);
      return {
        ...slot,
        price: Math.round(Number(sanInfo?.GiaSan || 0) * getSlotDurationHours(slot.start, slot.end)),
        isBooked: isBookedInDB,
        isPast,
        subText: isPast ? 'Đã qua giờ' : isBookedInDB ? 'Đã có đội đặt qua hệ thống' : 'Sân mới vừa trống'
      };
    });
  };

  const currentDynamicSlots = getCalculatedSlots();
  const filteredDynamicSlots = selectedShift === 'ALL'
    ? currentDynamicSlots
    : currentDynamicSlots.filter(s => getSlotShift(s.start) === selectedShift);

  const handleToggleSlot = (slot) => {
    // TASK 01: Vô hiệu hóa chọn khung giờ quá khứ
    if (isSlotInPast(selectedDate, slot.start)) {
      alert(`Khung giờ ${slot.start} đã qua thời gian bắt đầu. Quý khách chỉ có thể đặt những khung giờ trong tương lai.`);
      return;
    }
    const isExist = selectedSlots.some(s => s.id === slot.id);
    if (isExist) {
      setSelectedSlots(selectedSlots.filter(s => s.id !== slot.id));
    } else {
      setSelectedSlots([...selectedSlots, slot].sort((a, b) => a.id - b.id));
    }
  };

  // PHÂN LOẠI MÔN THỂ THAO ĐỂ BẬT DỊCH VỤ CHUẨN NGHIỆP VỤ
  const loaiSanLower = (sanInfo?.LoaiSanText || '').toLowerCase();
  
  const isFootball = loaiSanLower.includes('bóng đá') || loaiSanLower.includes('sân 5') || loaiSanLower.includes('sân 7') || loaiSanLower.includes('sân 11');
  const isBadminton = loaiSanLower.includes('cầu lông');
  const isTennis = loaiSanLower.includes('tennis');
  const isPickleball = loaiSanLower.includes('pickleball') || loaiSanLower.includes('pick');

  // Xác định số lượng áo bib theo từng loại sân bóng đá (Chỉ cấp cho 1 đội)
  let bibCountText;
  if (loaiSanLower.includes('sân 11')) {
    bibCountText = "1 bộ (11 áo)";
  } else if (loaiSanLower.includes('sân 7')) {
    bibCountText = "1 bộ (7 áo)";
  } else {
    bibCountText = "1 bộ (5 áo)";
  }

  // TÍNH TIỀN THUÊ SÂN VÀ CÁC DỊCH VỤ DỰA THEO SỐ GIỜ ĐÃ CHỌN
  const totalPitchPrice = selectedSlots.reduce((sum, item) => sum + item.price, 0);
  const totalHours = selectedSlots.length > 0
    ? selectedSlots.reduce((sum, slot) => sum + getSlotDurationHours(slot.start, slot.end), 0)
    : 1;

  // Giá nước uống: Bóng đá & Pickleball = 150k (12 chai); Cầu lông & Tennis = 90k (6 chai)
  const waterPrice = (isFootball || isPickleball) ? 150000 : 90000;
  const priceWater = services.water ? waterPrice : 0;
  
  // Giá áo bib: 50.000 đ
  const priceBibs = (isFootball && services.bibs) ? 50000 : 0;

  // Giá dịch vụ cầu lông: Vợt 80k/cặp/h; Hộp cầu 250k
  const priceRacketBadminton = (isBadminton && services.racketBadminton) ? (80000 * totalHours) : 0;
  const priceShuttlecock = (isBadminton && services.shuttlecock) ? 250000 : 0;

  // Giá dịch vụ Tennis: Vợt 100k/cây/h
  const priceRacketTennis = (isTennis && services.racketTennis) ? (100000 * totalHours) : 0;

  // TỔNG TIỀN THANH TOÁN
  const totalPrice = totalPitchPrice + priceWater + priceBibs + priceRacketBadminton + priceShuttlecock + priceRacketTennis;

  const currentUser = user || JSON.parse(sessionStorage.getItem('datsan_user'));
  const displayName = currentUser?.HoTen || currentUser?.hoten || 'Khách Hàng (Chưa Đăng Nhập)';
  const userRole = currentUser?.VaiTro || currentUser?.vaitro || 'KHACHHANG';

  const handleConfirmBooking = async (method = paymentMethod) => {
    if (selectedSlots.length === 0) return;
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }

    // TASK 01: Kiểm tra lại trước khi xác nhận đặt sân
    const pastSlot = selectedSlots.find(s => isSlotInPast(selectedDate, s.start));
    if (pastSlot) {
      alert(`Khung giờ ${pastSlot.start} đã qua thời gian bắt đầu. Quý khách chỉ có thể đặt những khung giờ trong tương lai.`);
      setSelectedSlots(prev => prev.filter(s => !isSlotInPast(selectedDate, s.start)));
      return;
    }

    try {
      setIsSubmitting(true);
      const { data: bResult, error: bookingError } = await supabase.createBooking({
        masan: sanInfo.MaSan,
        date: selectedDate,
        slotIds: selectedSlots.map((slot) => slot.id),
        services,
        paymentMethod: method,
      });
      if (bookingError) throw bookingError;

      if (method === 'TIEN_MAT') {
        setShowPaymentModal(false);
        alert('✅ Đặt sân thành công! Quý khách thanh toán tiền mặt trực tiếp cho Chủ sân khi đến sân thi đấu.');
        setSelectedSlots([]);
        setServices({
          water: false,
          bibs: false,
          racketBadminton: false,
          shuttlecock: false,
          racketTennis: false
        });
        fetchBookedSlots();
        navigate('/profile');
      } else {
        // QR trực tuyến: Chuyển sang bước xác nhận thanh toán
        const bookingId = bResult?.madatsan || bResult?.MaDatSan || (typeof bResult === 'number' ? bResult : null);
        setPendingBookingData({
          bookingId,
          total: totalPrice,
          sanName: sanInfo?.TenSan || 'Sân thể thao',
          slots: selectedSlots,
          durationMinutes: calculateSlotsDurationMinutes(selectedSlots)
        });
        setSimulationFailed(false);
      }
    } catch (e) {
      alert('Lỗi đặt sân: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteBookingSimulation = async (action, fallback = null) => {
    if (!pendingBookingData?.bookingId) return;
    try {
      setIsSubmitting(true);
      const res = await simulateBookingPayment({
        bookingId: pendingBookingData.bookingId,
        simulationAction: action,
        fallbackAction: fallback
      });

      if (action === 'SIMULATE_SUCCESS') {
        setShowPaymentModal(false);
        setPendingBookingData(null);
        alert('✅ Thanh toán thành công! Đơn đặt sân của bạn đã được xác nhận.');
        setSelectedSlots([]);
        fetchBookedSlots();
        navigate('/profile');
      } else if (action === 'SIMULATE_FAILURE') {
        if (fallback === 'SWITCH_CASH') {
          setShowPaymentModal(false);
          setPendingBookingData(null);
          alert('💵 Đã chuyển sang hình thức thanh toán tiền mặt tại sân. Khung giờ đặt sân của bạn được bảo toàn!');
          setSelectedSlots([]);
          fetchBookedSlots();
          navigate('/profile');
        } else if (fallback === 'CANCEL') {
          setShowPaymentModal(false);
          setPendingBookingData(null);
          alert('❌ Đã hủy đơn đặt sân thành công. Khung giờ đã được giải phóng.');
          setSelectedSlots([]);
          fetchBookedSlots();
        } else {
          setSimulationFailed(true);
        }
      }
    } catch (e) {
      alert('Lỗi xử lý giao dịch: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-emerald-600 font-bold gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span>Đang kết nối CSDL Supabase tải thông tin sân...</span>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <p role="alert" className="font-semibold text-rose-700">{pageError}</p>
        <button onClick={() => navigate('/')} className="rounded-lg bg-emerald-700 px-5 py-2 text-white">Về trang chủ</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-20">
      {/* TOP ANNOUNCEMENT BAR */}
      <div className="bg-[#046c4e] text-emerald-100 text-xs py-1.5 px-6 border-b border-emerald-700/50">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-300" /> Hotline hỗ trợ 24/7: <b className="text-white">1900 8899</b>
            </span>
            <span className="hidden md:inline text-emerald-300/80">|</span>
            <span className="hidden md:inline">Hệ thống giữ chỗ thời gian thực DatSanOnline</span>
          </div>
          <div className="flex items-center space-x-4 text-emerald-100">
            <span className="bg-emerald-700 px-2.5 py-0.5 rounded text-[11px] font-bold">Giữ chỗ 100%</span>
            <span>Đã phục vụ hơn 3.200+ trận đấu</span>
          </div>
        </div>
      </div>

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm font-sans">
        <div className="max-w-[1440px] mx-auto px-6 h-20 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link 
              to="/" 
              onClick={() => { if (typeof onBack === 'function') onBack(); }} 
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-md font-bold text-lg">
                DS
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-emerald-600 leading-none">
                  DatSan<span className="text-amber-500">Online</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                  Hệ Sinh Thái Thể Thao VN
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
          
          <div className="flex-1 max-w-xl hidden md:block">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Tìm theo tên sân, địa chỉ..."
                className="w-full h-11 pl-11 pr-4 rounded-full bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {userRole === 'CHUSAN' && (
                  <button onClick={() => navigate('/owner')} className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
                    <Shield className="w-4 h-4" /> Quản Lý Sân
                  </button>
                )}
                {userRole === 'ADMIN' && (
                  <button onClick={() => navigate('/admin')} className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
                    <LayoutDashboard className="w-4 h-4" /> Trang Admin
                  </button>
                )}
                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                </button>
                
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden xl:block text-left text-xs leading-tight">
                      <div className="font-bold text-slate-800">{displayName}</div>
                      <div className="text-[10px] text-emerald-600 font-medium font-mono uppercase">{userRole}</div>
                    </div>
                  </button>
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <button 
                        onClick={() => { setShowDropdown(false); navigate('/profile'); }}
                        className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-2.5 transition text-left"
                      >
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>Thông tin cá nhân</span>
                      </button>
                      {userRole === 'CHUSAN' && (
                        <button 
                          onClick={() => { setShowDropdown(false); navigate('/owner'); }}
                          className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-2.5 transition text-left"
                        >
                          <Building2 className="w-4 h-4 text-amber-500" />
                          <span>Bảng quản lý sân</span>
                        </button>
                      )}
                      {userRole === 'ADMIN' && (
                        <button 
                          onClick={() => { setShowDropdown(false); navigate('/admin'); }}
                          className="w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-2.5 transition text-left"
                        >
                          <LayoutDashboard className="w-4 h-4 text-purple-600" />
                          <span>Trang quản trị Admin</span>
                        </button>
                      )}
                      <div className="border-t border-slate-100 my-1"></div>
                      <button 
                        onClick={() => {
                          setShowDropdown(false);
                          broadcastAuthChange(null);
                          if (typeof setUser === 'function') setUser(null);
                        }} 
                        className="w-full px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 font-bold flex items-center gap-2.5 transition text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)} 
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm transition"
              >
                <LogIn className="w-4 h-4" /> Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-[1440px] mx-auto px-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <button onClick={onBack || (() => navigate('/'))} className="hover:text-emerald-600 font-bold flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Trang Chủ
            </button> 
            <ChevronRight className="w-3 h-3" />
            <span>Đà Nẵng</span> <ChevronRight className="w-3 h-3" />
            <span>Quận {sanInfo?.ViTri.Quan}</span> <ChevronRight className="w-3 h-3" />
            <span className="text-slate-700 font-bold">{sanInfo?.TenSan}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">SÂN MỚI 2026</span>
          <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase">TIÊU CHUẨN THI ĐẤU</span>
          <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase flex items-center gap-1">
            <Video className="w-3 h-3" /> CÓ CAMERA QUAY TRẬN ĐẤU
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{sanInfo?.TenSan}</h1>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-amber-400" /> {sanInfo?.Rating} ({sanInfo?.TotalReviews} đánh giá thực tế)
              </span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">Đã phục vụ hơn 3.200+ trận đấu</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {sanInfo?.ViTri.DiaChi}, P. {sanInfo?.ViTri.Phuong}, Q. {sanInfo?.ViTri.Quan}, TP. Đà Nẵng
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
              <Navigation className="w-3.5 h-3.5 text-emerald-600" /> Google Maps
            </button>
            <button className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
              <Phone className="w-3.5 h-3.5" /> Quản lý sân: 0905.123.456
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 relative h-[380px] rounded-2xl overflow-hidden shadow-sm bg-slate-100">
                <img src={sanInfo?.Image} alt="Main" className="w-full h-full object-cover" />
              </div>
              <div className="grid grid-rows-3 gap-2 h-[380px]">
                <div className="rounded-xl overflow-hidden bg-slate-100 relative">
                  <img src="https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=400&q=80" alt="Sub 1" className="w-full h-full object-cover" />
                </div>
                <div className="rounded-xl overflow-hidden bg-slate-100 relative">
                  <img src="https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=400&q=80" alt="Sub 2" className="w-full h-full object-cover" />
                </div>
                <div className="rounded-xl overflow-hidden bg-slate-100 relative">
                  <img src="https://images.unsplash.com/photo-1626248801379-51a0748a5f96?auto=format&fit=crop&w=400&q=80" alt="Sub 3" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Bảng Khung Giờ Thi Đấu Trực Quan</h3>
                  <p className="text-xs text-slate-400">Có thể bấm chọn nhiều ca liên tiếp để đặt 2-3 tiếng.</p>
                </div>
                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full flex items-center gap-1.5 font-mono shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{clockFormatted} • {dateFormatted}</span>
                </span>
              </div>

              {/* CHỌN NGÀY ĐÁ */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CHỌN NGÀY ĐÁ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {quickDateInfo.isNotToday && (
                      <button
                        type="button"
                        onClick={() => handleSelectDate(quickDateInfo.todayStr)}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition"
                      >
                        ↩ Về Hôm nay
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        try { datePickerRef.current?.showPicker(); } catch (e) { datePickerRef.current?.focus(); }
                      }}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Chọn lịch 📅</span>
                    </button>
                    <input 
                      ref={datePickerRef}
                      type="date"
                      value={selectedDate}
                      min={getLocalDateValue()}
                      onChange={(e) => handleSelectDate(e.target.value)}
                      className="sr-only"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {quickDateInfo.list.slice(0, 6).map((d) => (
                    <button
                      key={d.full}
                      onClick={() => handleSelectDate(d.full)}
                      className={`p-3 rounded-xl border text-center transition ${
                        d.isSelected 
                          ? 'bg-emerald-700 text-white border-emerald-700 font-extrabold shadow-md' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="text-[10px] opacity-80 uppercase">{d.title}</div>
                      <div className="text-base font-black my-0.5">{d.shortLabel}</div>
                      <div className="text-[10px] opacity-90">{d.weekdayLong}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* PHÂN LOẠI SÂN TỪ CSDL */}
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-400">Loại sân:</span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                  {sanInfo?.LoaiSanText}
                </span>
              </div>

              {/* CHỌN CA THI ĐẤU */}
              <div className="mb-5">
                <div className="text-xs font-bold uppercase text-slate-400 mb-2">CHỌN CA THI ĐẤU</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'ALL', label: 'Tất cả (14 ca)' },
                    { id: 'MORNING', label: 'Ca Sáng (07:00 - 11:00)' },
                    { id: 'AFTERNOON', label: 'Ca Chiều (13:00 - 17:00)' },
                    { id: 'EVENING', label: 'Ca Tối (17:00 - 23:00)' },
                  ].map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => setSelectedShift(shift.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        selectedShift === shift.id
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {shift.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* GRID KHUNG GIỜ */}
              {availabilityError ? (
                <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                  {availabilityError}
                  <button onClick={fetchBookedSlots} className="ml-3 font-bold underline">Thử lại</button>
                </div>
              ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredDynamicSlots.map((slot) => {
                    const isSelected = selectedSlots.some(s => s.id === slot.id);
                    const isPast = slot.isPast;
                    return (
                        <div key={slot.id} className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                            isPast
                              ? 'bg-slate-100/90 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed select-none'
                              : slot.isBooked 
                                ? 'bg-slate-100 opacity-60 border-slate-200 text-slate-500 cursor-not-allowed' 
                                : isSelected 
                                  ? 'bg-amber-50 border-2 border-amber-500 shadow-sm' 
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    {slot.isGold && !isPast && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-extrabold text-[9px] uppercase inline-block mb-1">VIP</span>}
                                    <div className={`font-extrabold text-sm ${isPast ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{slot.start} - {slot.end}</div>
                                </div>
                                <div className={`text-[10px] font-semibold ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>{slot.subText}</div>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200/60 pt-2">
                                <div className={`font-black text-sm ${isPast ? 'text-slate-400' : 'text-emerald-700'}`}>{slot.price.toLocaleString('vi-VN')} đ</div>
                                {isPast ? (
                                    <span className="px-2.5 py-1 bg-slate-200 text-slate-500 font-extrabold text-[10px] rounded-lg">Đã qua giờ</span>
                                ) : slot.isBooked ? (
                                    <span className="px-2 py-1 bg-slate-200 text-slate-500 font-bold text-[10px] rounded-lg">Đã cọc</span>
                                ) : (
                                    <button 
                                        type="button"
                                        onClick={() => handleToggleSlot(slot)} 
                                        className={`px-3 py-1 font-bold text-[11px] rounded-lg cursor-pointer ${isSelected ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                    >
                                        {isSelected ? 'Đã Chọn' : '+ Chọn'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
              </div>
              )}
            </div>

            {/* DỊCH VỤ CỘNG THÊM (CHUẨN ĐÚNG NGHIỆP VỤ BÁO GIÁ THEO MÔN) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-extrabold text-base text-slate-900 mb-1">Dịch Vụ Cộng Thêm Phục Vụ Trận Đấu (Tùy chọn)</h3>
              <p className="text-xs text-slate-400 mb-4">Các gói dịch vụ đi kèm chuẩn theo môn {sanInfo?.LoaiSanText}.</p>
              
              <div className="space-y-3">
                {/* 1. BÓNG ĐÁ */}
                {isFootball && (
                  <>
                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.water} 
                          onChange={(e) => setServices({ ...services, water: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Thùng nước uống 12 chai (ướp lạnh sẵn)</div>
                          <div className="text-[11px] text-slate-400">Nước ướp lạnh mang tận sân trước 15 phút giờ thi đấu</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+150.000 đ</span>
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.bibs} 
                          onChange={(e) => setServices({ ...services, bibs: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Thuê {bibCountText} thi đấu</div>
                          <div className="text-[11px] text-slate-400">Áo giặt sạch sẽ, cấp đủ số lượng cho 1 đội bóng</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+50.000 đ</span>
                    </label>
                  </>
                )}

                {/* 2. CẦU LÔNG */}
                {isBadminton && (
                  <>
                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.water} 
                          onChange={(e) => setServices({ ...services, water: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Block nước uống 6 chai (ướp lạnh sẵn)</div>
                          <div className="text-[11px] text-slate-400">Phù hợp cho nhóm thi đấu cầu lông</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+90.000 đ</span>
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.racketBadminton} 
                          onChange={(e) => setServices({ ...services, racketBadminton: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Thuê 1 cặp vợt cầu lông cao cấp</div>
                          <div className="text-[11px] text-slate-400">Tính giá 80.000 đ / 1 cặp / 1 giờ</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+{ (80000 * totalHours).toLocaleString('vi-VN') } đ</span>
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.shuttlecock} 
                          onChange={(e) => setServices({ ...services, shuttlecock: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Hộp cầu thi đấu mới (12 quả bóc tem tại sân)</div>
                          <div className="text-[11px] text-slate-400">Cầu bền, đường bay chuẩn</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+250.000 đ</span>
                    </label>
                  </>
                )}

                {/* 3. TENNIS */}
                {isTennis && (
                  <>
                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.water} 
                          onChange={(e) => setServices({ ...services, water: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Block nước uống 6 chai (ướp lạnh sẵn)</div>
                          <div className="text-[11px] text-slate-400">Nước ướp lạnh sẵn tại sân</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+90.000 đ</span>
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.racketTennis} 
                          onChange={(e) => setServices({ ...services, racketTennis: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Thuê 1 cây vợt Tennis chuyên nghiệp</div>
                          <div className="text-[11px] text-slate-400">Tính giá 100.000 đ / 1 cây / 1 giờ</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+{ (100000 * totalHours).toLocaleString('vi-VN') } đ</span>
                    </label>

                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Bóng Tennis đã được miễn phí bao gồm sẵn khi thuê sân!</span>
                    </div>
                  </>
                )}

                {/* 4. PICKLEBALL */}
                {isPickleball && (
                  <>
                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={services.water} 
                          onChange={(e) => setServices({ ...services, water: e.target.checked })} 
                          className="w-4 h-4 accent-emerald-600 rounded" 
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-800">Thùng nước uống 12 chai (ướp lạnh sẵn)</div>
                          <div className="text-[11px] text-slate-400">Ướp lạnh sẵn mang tận sân cho nhóm thi đấu</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-700">+150.000 đ</span>
                    </label>

                    <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-500">
                      Sân Pickleball hiện không hỗ trợ dịch vụ cho thuê vợt và bóng. Quý khách vui lòng tự chuẩn bị dụng cụ.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* CỘT TÍNH TIỀN BÊN PHẢI */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
                {selectedSlots.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Đang giữ chỗ: {selectedSlots.length} tiếng
                      </span>
                      <button onClick={() => setSelectedSlots([])} className="text-[10px] text-red-500 font-bold hover:underline">Hủy tất cả</button>
                    </div>
                    <h3 className="font-black text-base text-slate-900 mb-4">Chi Tiết Đặt Sân</h3>
                    <div className="space-y-3 text-xs border-b border-slate-100 pb-4 mb-4">
                      <div className="flex justify-between items-start">
                        <span className="text-slate-500">Sân thi đấu:</span>
                        <span className="font-extrabold text-slate-900 text-right">{sanInfo?.LoaiSanText}<br /><span className="text-[10px] font-normal text-slate-400">{sanInfo?.TenSan}</span></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ngày sử dụng:</span>
                        <span className="font-extrabold text-slate-900">{selectedDate}</span>
                      </div>
                      
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 mt-2">
                        <div className="font-bold text-slate-500 mb-1 border-b pb-1">Các ca đã chọn ({selectedSlots.length}):</div>
                        {selectedSlots.map(slot => (
                          <div key={slot.id} className="flex justify-between text-[11px]">
                            <span className="font-bold text-slate-700">{slot.label}</span>
                            <span className="font-extrabold text-emerald-700">{slot.price.toLocaleString('vi-VN')} đ</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* BẢNG BÓC TÁCH CHI TIẾT TỔNG TIỀN */}
                    <div className="space-y-2 text-xs border-b border-slate-100 pb-4 mb-4">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tổng tiền thuê sân:</span>
                        <span className="font-extrabold">{totalPitchPrice.toLocaleString('vi-VN')} đ</span>
                      </div>
                      {services.water && (
                        <div className="flex justify-between text-slate-600">
                          <span>Nước uống ({(isFootball || isPickleball) ? 'Thùng 12 chai' : 'Block 6 chai'}):</span>
                          <span className="font-bold">+{waterPrice.toLocaleString('vi-VN')} đ</span>
                        </div>
                      )}
                      {isFootball && services.bibs && (
                        <div className="flex justify-between text-slate-600">
                          <span>Thuê {bibCountText}:</span>
                          <span className="font-bold">+50.000 đ</span>
                        </div>
                      )}
                      {isBadminton && services.racketBadminton && (
                        <div className="flex justify-between text-slate-600">
                          <span>Thuê 1 cặp vợt ({totalHours}h):</span>
                          <span className="font-bold">+{(80000 * totalHours).toLocaleString('vi-VN')} đ</span>
                        </div>
                      )}
                      {isBadminton && services.shuttlecock && (
                        <div className="flex justify-between text-slate-600">
                          <span>Hộp cầu thi đấu mới:</span>
                          <span className="font-bold">+250.000 đ</span>
                        </div>
                      )}
                      {isTennis && services.racketTennis && (
                        <div className="flex justify-between text-slate-600">
                          <span>Thuê 1 cây vợt Tennis ({totalHours}h):</span>
                          <span className="font-bold">+{(100000 * totalHours).toLocaleString('vi-VN')} đ</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <div className="text-[11px] text-slate-400 uppercase font-bold">TỔNG TIỀN THANH TOÁN</div>
                        <div className="text-[10px] text-emerald-600 font-semibold">Đã bao gồm VAT & Dịch vụ</div>
                      </div>
                      <div className="text-2xl font-black text-amber-500">
                        {totalPrice.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                    
                    <button 
                      disabled={isSubmitting}
                      onClick={currentUser ? () => setShowPaymentModal(true) : () => setShowLoginModal(true)}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg shadow-amber-500/30 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? 'ĐANG LƯU CSDL...' : currentUser ? 'CHỌN THANH TOÁN (100%)' : 'ĐĂNG NHẬP ĐỂ ĐẶT SÂN'} <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="py-8 text-center space-y-3">
                    <AlertCircle className="w-5 h-5 text-slate-400 mx-auto" />
                    <h4 className="font-bold text-slate-800 text-sm">Chưa Chọn Khung Giờ</h4>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL THANH TOÁN 100% (MÔ PHỎNG DEMO HOẶC TIỀN MẶT) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-slate-100 max-h-[92vh] overflow-y-auto">
            <button 
              onClick={() => {
                setShowPaymentModal(false);
                setPendingBookingData(null);
                setSimulationFailed(false);
              }}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            {pendingBookingData ? (
              /* BƯỚC 2: CỔNG THANH TOÁN (TASK 04 & 05: GIAO DIỆN THƯƠNG MẠI CHUYÊN NGHIỆP) */
              <div>
                <div className="text-center mb-4">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-full uppercase tracking-wider border border-emerald-200">
                    Cổng Thanh Toán
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-2">Quét Mã QR Thanh Toán</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Đơn đặt sân #{pendingBookingData.bookingId} • {pendingBookingData.sanName}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center mb-4">
                  <div className="text-xs font-bold text-slate-700 mb-2">Mã QR Thanh Toán</div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-sm">
                    <img 
                      src={getMockBookingQrSvg(pendingBookingData.total, `DON-${pendingBookingData.bookingId}`)} 
                      alt="Payment QR" 
                      className="w-44 h-44 mx-auto object-contain"
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Số tiền thanh toán: <strong className="text-slate-900 font-black text-lg">{Number(pendingBookingData.total).toLocaleString('vi-VN')} đ</strong>
                  </div>
                </div>

                {!simulationFailed ? (
                  <div className="space-y-2">
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleExecuteBookingSimulation('SIMULATE_SUCCESS')}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isSubmitting ? 'Đang xử lý giao dịch...' : 'Xác Nhận & Hoàn Tất Thanh Toán'}
                    </button>

                    <p className="text-[11px] text-slate-500 text-center italic mt-1.5 font-medium">
                      Giao dịch thử nghiệm – không phát sinh chuyển tiền thật.
                    </p>

                    {/* Tùy chọn kiểm thử dành cho tester/admin */}
                    <details className="mt-3 pt-2 border-t border-slate-100 text-slate-400 text-center">
                      <summary className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer select-none">
                        🛠️ Tùy chọn kiểm thử (Dành cho Tester & Quản trị viên)
                      </summary>
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-left">
                        <p className="text-[10px] text-slate-500">Mô phỏng trường hợp thanh toán bị gián đoạn hoặc thất bại từ ngân hàng:</p>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleExecuteBookingSimulation('SIMULATE_FAILURE')}
                          className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          Thử nghiệm kịch bản thanh toán thất bại
                        </button>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="space-y-3 bg-rose-50/80 border border-rose-200 rounded-2xl p-4">
                    <div className="text-xs font-bold text-rose-800 text-center">
                      ⚠️ Thanh toán chưa hoàn tất. Khung giờ của bạn đang được tạm giữ an toàn:
                    </div>

                    {(pendingBookingData?.durationMinutes ?? 0) <= 120 ? (
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleExecuteBookingSimulation('SIMULATE_FAILURE', 'SWITCH_CASH')}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <DollarSign className="w-4 h-4" />
                        Chuyển sang thanh toán tiền mặt tại sân
                      </button>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] text-center font-medium">
                        ⚠️ Đơn đặt sân có thời lượng {pendingBookingData?.durationMinutes} phút (&gt; 2 giờ). Thanh toán tiền mặt chỉ áp dụng tối đa 2 giờ. Vui lòng thanh toán trực tuyến hoặc hủy đơn.
                      </div>
                    )}

                    <button
                      disabled={isSubmitting}
                      onClick={() => handleExecuteBookingSimulation('SIMULATE_FAILURE', 'CANCEL')}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Hủy đơn đặt sân và giải phóng khung giờ
                    </button>

                    <button
                      disabled={isSubmitting}
                      onClick={() => setSimulationFailed(false)}
                      className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Thử thanh toán lại
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* BƯỚC 1: CHỌN PHƯƠNG THỨC THANH TOÁN BAN ĐẦU */
              <div>
                <div className="text-center mb-5">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-full uppercase tracking-wider border border-emerald-200">
                    Đặt Sân & Thanh Toán
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-2">Chọn Phương Thức Thanh Toán</h3>
                  <p className="text-xs text-slate-500 mt-1">Kiểm tra thông tin chi tiết và chọn phương thức thanh toán phù hợp</p>
                </div>

                {/* TÓM TẮT ĐƠN HÀNG */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-5 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Sân thi đấu:</span>
                    <span className="font-bold text-slate-900">{sanInfo?.TenSan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Ngày & Ca thi đấu:</span>
                    <span className="font-bold text-slate-900">{selectedDate} ({selectedSlots.length} ca)</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 items-baseline">
                    <span className="font-bold text-slate-700">Tổng thanh toán:</span>
                    <span className="text-xl font-black text-slate-900">{totalPrice.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                {/* CHỌN PHƯƠNG THỨC */}
                {(() => {
                  const totalSelectedMinutes = calculateSlotsDurationMinutes(selectedSlots);
                  const isCashExceeded = totalSelectedMinutes > 120;
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('QR')}
                          className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-2 cursor-pointer ${
                            paymentMethod === 'QR'
                              ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                              <QrCode className="w-4 h-4 text-emerald-600" /> Thanh toán QR
                            </span>
                            {paymentMethod === 'QR' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <span className="text-[11px] text-slate-500 leading-tight">
                            Quét mã QR và xác nhận thanh toán trực tuyến
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('TIEN_MAT')}
                          className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-2 cursor-pointer ${
                            paymentMethod === 'TIEN_MAT'
                              ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4 text-emerald-600" /> Tiền mặt tại sân
                            </span>
                            {paymentMethod === 'TIEN_MAT' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <span className="text-[11px] text-slate-500 leading-tight">
                            Thanh toán trực tiếp cho Chủ sân (Tối đa 2 giờ)
                          </span>
                          {isCashExceeded && (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Quá 120 phút ({totalSelectedMinutes}p)
                            </span>
                          )}
                        </button>
                      </div>

                      {paymentMethod === 'QR' ? (
                        <div className="space-y-4">
                          <button
                            disabled={isSubmitting}
                            onClick={() => handleConfirmBooking('QR')}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {isSubmitting ? 'Đang tạo đơn...' : 'Tiến Hành Đặt Sân & Thanh Toán QR'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {isCashExceeded ? (
                            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs space-y-2 text-amber-900">
                              <div className="flex items-start gap-2.5">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <div className="font-bold text-amber-950">Không Áp Dụng Thanh Toán Tiền Mặt</div>
                                  <p className="text-[11px] leading-relaxed">
                                    Thanh toán tiền mặt chỉ áp dụng cho đơn đặt sân tối đa 2 giờ (Đơn hiện tại: {totalSelectedMinutes} phút). Vui lòng giảm thời lượng hoặc chọn thanh toán trực tuyến.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-700">
                              <div className="flex items-start gap-2.5">
                                <AlertCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-900">Quy trình thanh toán tiền mặt tại sân:</div>
                                  <p className="text-[11px] leading-relaxed text-slate-600">
                                    • Quý khách thanh toán <strong>{totalPrice.toLocaleString('vi-VN')} đ</strong> trực tiếp cho Chủ sân khi đến nhận sân.
                                  </p>
                                  <p className="text-[11px] leading-relaxed text-slate-600">
                                    • Khung giờ của bạn sẽ được giữ chỗ ngay sau khi xác nhận.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            disabled={isSubmitting || isCashExceeded}
                            onClick={() => handleConfirmBooking('TIEN_MAT')}
                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {isSubmitting ? 'ĐANG XỬ LÝ...' : isCashExceeded ? 'Vượt Quá Giới Hạn 2 Giờ Tiền Mặt' : 'Xác Nhận Đặt Sân (Trả Tiền Mặt)'}
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ĐĂNG NHẬP / XÁC THỰC OTP */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => { setShowLoginModal(false); resetAuthForm(); }}
              className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Đăng Nhập DatSanOnline</h3>
              <p className="text-xs text-slate-500 mt-1">
                {loginStep === 1 ? 'Nhập số điện thoại để nhận mã OTP' : `Mã OTP đã gửi tới ${normalizedPhone}`}
              </p>
            </div>

            {loginStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">Số điện thoại
                  <input 
                    type="tel" 
                    value={phoneNumber} 
                    onChange={(event) => setPhoneNumber(event.target.value)} 
                    placeholder="Ví dụ: 0905123456" 
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold" 
                    required 
                  />
                </label>
                {loginError && <p role="alert" className="text-xs text-rose-600 font-medium">{loginError}</p>}
                <button 
                  disabled={isSubmitting} 
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition shadow-md"
                >
                  {isSubmitting ? 'Đang gửi...' : 'Gửi mã OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">Mã OTP
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    maxLength={8} 
                    value={otpCode} 
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))} 
                    placeholder="------" 
                    className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center tracking-widest text-lg font-black focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" 
                    required 
                  />
                </label>
                <div className="text-[11px] text-slate-500 text-center">
                  Vui lòng nhập mã OTP 6 chữ số gửi qua SMS
                </div>
                {loginError && <p role="alert" className="text-xs text-rose-600 font-medium">{loginError}</p>}
                <button 
                  disabled={isSubmitting} 
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition shadow-md"
                >
                  {isSubmitting ? 'Đang xác minh...' : 'Xác nhận đăng nhập'}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setLoginStep(1); setLoginError(''); }} 
                  className="w-full text-xs text-emerald-700 font-semibold hover:underline"
                >
                  Đổi số điện thoại
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
