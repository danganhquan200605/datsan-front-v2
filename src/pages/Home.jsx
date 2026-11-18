import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MapPin, Calendar, Clock, ChevronDown, Bell, User, 
  Flame, Award, ShieldCheck, Zap, Phone, CheckCircle, ArrowRight,
  Sparkles, Star, Heart, Navigation, ExternalLink, Ticket, Check, RefreshCw, Eye, Users, MessageSquare, X
} from 'lucide-react';
import { requestPhoneOtp, supabase, verifyPhoneOtp } from '../supabaseClient';
import Header from '../components/Header';

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1529900248057-5e632c63c574?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1626248801379-51a0748a5f96?auto=format&fit=crop&w=800&q=80'
];

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

export default function Home() {
  const navigate = useNavigate();
  // Duy trì phiên đăng nhập chuẩn SPA
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem('datsan_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error('Lỗi đọc sessionStorage:', error);
      return null;
    }
  });

  const [loaiSanList, setLoaiSanList] = useState([]);
  const [timeSlotList, setTimeSlotList] = useState([]);
  const [allKhungGio, setAllKhungGio] = useState([]);
  const [sanList, setSanList] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaLoaiSan, setSelectedMaLoaiSan] = useState(0); 
  const [selectedQuan, setSelectedQuan] = useState(''); 
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateValue());
  const [loadError, setLoadError] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Booking Modal States
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState(null);
  const [bookingSuccessModal, setBookingSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Login modal remains visible until a real Supabase Auth flow is configured.
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginStep, setLoginStep] = useState(1);
  const [loginError, setLoginError] = useState('');

  // Reg Pitch (Đăng ký chủ sân) Modal State
  const [showRegPitchModal, setShowRegPitchModal] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login') === '1') {
      setShowLoginModal(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [lsResult, vtResult, sanResult, slotResult, bookingResult] = await Promise.all([
        supabase.from('loaisan').select('*'),
        supabase.from('vitri').select('*'),
        supabase.from('san').select('*'),
        supabase.from('khunggio').select('*').order('makhunggio'),
        supabase.availability(selectedDate)
      ]);
      const failedResult = [lsResult, vtResult, sanResult, slotResult, bookingResult].find((result) => result.error);
      if (failedResult) throw failedResult.error;
      const lsData = lsResult.data || [];
      const vtData = vtResult.data || [];
      const sanData = sanResult.data || [];
      const slotData = slotResult.data || [];
      setLoaiSanList(lsData);
      setAllKhungGio(slotData);

      const uniqueSlots = [];
      const seenRanges = new Set();
      slotData.forEach((slot) => {
        const start = String(slot.giobatdau ?? slot.GioBatDau ?? '').slice(0, 5);
        const end = String(slot.gioketthuc ?? slot.GioKetThuc ?? '').slice(0, 5);
        const rangeKey = `${start}-${end}`;
        if (start && end && !seenRanges.has(rangeKey)) {
          seenRanges.add(rangeKey);
          const hour = Number(start.slice(0, 2));
          uniqueSlots.push({ id: rangeKey, start, end, label: `${start} - ${end}`, isGold: hour >= 17 && hour <= 20 });
        }
      });
      uniqueSlots.sort((a, b) => a.start.localeCompare(b.start));
      setTimeSlotList(uniqueSlots);
      setBookedSlots(bookingResult.data || []);
      
      if (sanData) {
        const formatted = sanData.map((san, idx) => {
          const maSan = san.masan || san.MaSan;
          const maViTri = san.mavitri || san.MaViTri;
          const maLoaiSan = san.maloaisan || san.MaLoaiSan;
          const giaSan = san.giasan || san.GiaSan || 300000;
          const vt = vtData?.find((v) => (v.mavitri || v.MaViTri) === maViTri) || {};
          const ls = lsData?.find((l) => (l.maloaisan || l.MaLoaiSan) === maLoaiSan) || {};
          const imageUrl = san.hinhanh || san.HinhAnh || DEFAULT_IMAGES[idx % DEFAULT_IMAGES.length];
          return {
            MaSan: maSan,
            TenSan: san.tensan || san.TenSan || 'Sân Thể Thao',
            MoTa: san.mota || san.MoTa || 'Sân tiêu chuẩn chất lượng cao, có hệ thống chiếu sáng LED hiện đại.',
            GiaSan: giaSan,
            MaLoaiSan: maLoaiSan,
            LoaiSanText: ls.tenloaisan || ls.TenLoaiSan || 'Bóng đá Sân 7',
            ViTri: {
              DiaChi: vt.diachi || vt.DiaChi || 'Chưa cập nhật địa chỉ',
              Quan: vt.quan || vt.Quan || 'Đà Nẵng'
            },
            Rating: (4.7 + (maSan % 3) * 0.1).toFixed(1),
            TotalReviews: 60 + maSan * 9,
            Image: imageUrl
          };
        });
        setSanList(formatted);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu Supabase:', err);
      setLoadError('Không tải được dữ liệu sân. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchData, 0);
    const channel = supabase
      .channel('datsan-home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'san' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'datsan' }, () => fetchData())
      .subscribe();
    return () => {
      window.clearTimeout(initialFetch);
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const getSlotStatus = (maSan, slotId) => {
    const isBookedInDB = bookedSlots.some(
      (b) => Number(b.masan) === Number(maSan)
        && !['DAHUY', 'DA_HUY', 'HUY'].includes(String(b.trangthai || '').toUpperCase())
        && (Number(b.makhunggio) === Number(slotId)
          || b.datsan_khunggio?.some((k) => Number(k.makhunggio) === Number(slotId)))
    );
    return isBookedInDB ? 'DADAT' : 'TRONG';
  };

  const displayedSlots = useMemo(() => {
    if (selectedTimeSlot === 'ALL') return timeSlotList;
    return timeSlotList.filter(s => getSlotShift(s.start) === selectedTimeSlot);
  }, [timeSlotList, selectedTimeSlot]);

  const filteredSan = sanList.filter((san) => {
    const matchLoaiSan = selectedMaLoaiSan === 0 || san.MaLoaiSan === selectedMaLoaiSan;
    const matchQuan = !selectedQuan || san.ViTri.Quan.toLowerCase().includes(selectedQuan.toLowerCase());
    const matchSearch = !searchTerm || 
      san.TenSan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      san.ViTri.DiaChi.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTimeSlot = selectedTimeSlot === 'ALL' || allKhungGio.some((kg) => 
      Number(kg.masan || kg.MaSan) === Number(san.MaSan) &&
      getSlotShift(String(kg.giobatdau || kg.GioBatDau).slice(0, 5)) === selectedTimeSlot &&
      getSlotStatus(san.MaSan, kg.makhunggio || kg.MaKhungGio) === 'TRONG'
    );
    return matchLoaiSan && matchQuan && matchSearch && matchTimeSlot;
  });

  const handleQuickBook = (san, slot) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    const gia = Math.round(Number(san.GiaSan) * getSlotDurationHours(slot.start, slot.end));
    setSelectedSlotForBooking({ san, slot, gia });
    setBookingSuccessModal(true);
  };

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
      setCurrentUser(session.user);
      sessionStorage.setItem('datsan_user', JSON.stringify(session.user));
      setShowLoginModal(false);
      resetAuthForm();
    } catch (error) {
      setLoginError(error.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // XỬ LÝ NÂNG QUYỀN TỪ KHACHHANG THÀNH CHUSAN
  const handleRegisterOwnerSubmit = async (e) => {
    e.preventDefault();
    setShowRegPitchModal(false);
    navigate('/register-field');
  };

  const confirmBookingToSupabase = async () => {
    if (!selectedSlotForBooking || !currentUser) return;
    try {
      setIsSubmitting(true);
      const { san, slot } = selectedSlotForBooking;
      const { error: bookingErr } = await supabase.createBooking({
        masan: san.MaSan,
        date: selectedDate,
        slotIds: [slot.id],
      });
      if (bookingErr) throw bookingErr;
      alert('Tạo đơn đặt sân thành công!');
      setBookingSuccessModal(false);
      fetchData();
      navigate('/profile');
    } catch (err) {
      console.error('Lỗi khi lưu đơn:', err);
      alert('Lỗi đặt sân: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased">
      <Header 
        user={currentUser} 
        setUser={setCurrentUser} 
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm}
        onLoginClick={() => setShowLoginModal(true)}
        setShowRegPitchModal={setShowRegPitchModal}
      />
      
      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-b from-[#064e3b] via-[#046c4e] to-[#065f46] text-white pt-10 pb-16 px-6">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-semibold mb-4 border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Nền tảng giữ chỗ sân trực tiếp theo thời gian thực tại TP. Đà Nẵng
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-3">
            Đặt Sân Bóng & Sân Thể Thao Dễ Dàng Chỉ Với 3 Bước
          </h1>
          <p className="text-emerald-100/90 text-sm max-w-2xl mx-auto mb-8">
            Dữ liệu sân bãi, vị trí quận huyện và khung giờ thi đấu được kết nối trực tiếp với CSDL thời gian thực.
          </p>
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-6 text-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-5 overflow-x-auto">
              <button
                onClick={() => setSelectedMaLoaiSan(0)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  selectedMaLoaiSan === 0 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất Cả Môn Thi Đấu
              </button>
              {loaiSanList.map((ls) => {
                const maLS = ls.maloaisan || ls.MaLoaiSan;
                const tenLS = ls.tenloaisan || ls.TenLoaiSan;
                return (
                  <button
                    key={maLS}
                    onClick={() => setSelectedMaLoaiSan(maLS)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      selectedMaLoaiSan === maLS ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tenLS}
                  </button>
                );
              })}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 text-left">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  1. Quận Huyện
                </label>
                <select 
                  value={selectedQuan}
                  onChange={(e) => setSelectedQuan(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="">Toàn Thành Phố (Tất cả)</option>
                  <option value="Hải Châu">Q. Hải Châu (Trung tâm)</option>
                  <option value="Cẩm Lệ">Q. Cẩm Lệ (Hòa Xuân)</option>
                  <option value="Thanh Khê">Q. Thanh Khê</option>
                  <option value="Sơn Trà">Q. Sơn Trà</option>
                  <option value="Ngũ Hành Sơn">Q. Ngũ Hành Sơn</option>
                  <option value="Liên Chiểu">Q. Liên Chiểu</option>
                </select>
              </div>
              <div className="p-3 bg-slate-50 border border-emerald-500 rounded-xl ring-2 ring-emerald-500/20">
                <label className="block text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 2. Ngày Sử Dụng
                </label>
                <input 
                  type="date" 
                  value={selectedDate}
                  min={getLocalDateValue()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 cursor-pointer focus:outline-none"
                />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  3. Ca Thi Đấu
                </label>
                <select 
                  value={selectedTimeSlot}
                  onChange={(e) => setSelectedTimeSlot(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả khung giờ (07:00 - 23:00)</option>
                  <option value="MORNING">Ca Sáng (07:00 - 11:00)</option>
                  <option value="AFTERNOON">Ca Chiều (13:00 - 17:00)</option>
                  <option value="EVENING">Ca Tối (17:00 - 23:00)</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span>Hiển thị <b>{filteredSan.length} / {sanList.length} cụm sân</b> ngày <b>{selectedDate}</b></span>
              <button 
                onClick={() => document.getElementById('venues-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition"
              >
                XEM KẾT QUẢ TÌM KIẾM
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* REAL-TIME AVAILABILITY MATRIX */}
      <section id="matrix-section" className="max-w-[1440px] mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>BẢNG KHUNG GIỜ (TỰ CẬP NHẬT)</span>
              </div>
              <h2 className="text-xl font-black text-slate-900">Bảng Giờ Thi Đấu Ngày {selectedDate}</h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-600"></span> Còn Trống</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-500"></span> Giờ Vàng</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-200"></span> Đã Cọc</span>
            </div>
          </div>
          {loading ? (
            <div className="py-12 text-center text-emerald-600 font-bold">Đang tải bảng giờ...</div>
          ) : loadError ? (
            <div role="alert" className="py-12 text-center text-rose-600 font-semibold">
              <p>{loadError}</p>
              <button onClick={fetchData} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-white">Thử tải lại</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4 w-72">Sân Thi Đấu & Địa Chỉ</th>
                    {displayedSlots.map(s => (
                      <th key={s.id} className="py-3 px-3 text-center min-w-[125px]">{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSan.map((san) => (
                    <tr key={san.MaSan} className="hover:bg-slate-50/50">
                      <td className="py-4 px-4">
                        <div 
                          className="font-extrabold text-sm text-slate-900 cursor-pointer hover:text-emerald-600 transition"
                          onClick={() => navigate(`/field/${san.MaSan}`)}
                        >
                          {san.TenSan}
                        </div>
                        <div className="text-[11px] text-slate-400">📍 {san.ViTri.DiaChi}, Q. {san.ViTri.Quan}</div>
                      </td>
                      {displayedSlots.map((slot) => {
                        const vSlot = allKhungGio.find((kg) => 
                          Number(kg.masan || kg.MaSan) === Number(san.MaSan) &&
                          String(kg.giobatdau || kg.GioBatDau).slice(0, 5) === slot.start &&
                          String(kg.gioketthuc || kg.GioKetThuc).slice(0, 5) === slot.end
                        );
                        const slotId = vSlot ? Number(vSlot.makhunggio || vSlot.MaKhungGio) : null;
                        const status = slotId ? getSlotStatus(san.MaSan, slotId) : 'DADAT';
                        const isAvailable = Boolean(slotId && status === 'TRONG');
                        let btnClass = 'bg-slate-100 text-slate-400 cursor-not-allowed';
                        let labelText = 'Đã cọc';
                        const hourlyPriceK = Math.round(Number(san.GiaSan || 300000) / 1000);
                        if (isAvailable) {
                          if (slot.isGold) {
                            btnClass = 'bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-sm';
                            labelText = `${hourlyPriceK}k • HOT`;
                          } else {
                            btnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm';
                            labelText = `${hourlyPriceK}k • Đặt ngay`;
                          }
                        }
                        return (
                          <td key={slot.id} className="py-3 px-1.5 text-center">
                            <button
                              disabled={!isAvailable}
                              onClick={() => vSlot && handleQuickBook(san, { ...slot, id: slotId })}
                              className={`w-full py-2 px-1 rounded-xl text-xs transition flex flex-col items-center justify-center ${btnClass}`}
                            >
                              <div className="font-extrabold text-[11px] leading-tight">{slot.label}</div>
                              <div className="text-[10px] opacity-90">{labelText}</div>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* DANH SÁCH THẺ CỤM SÂN */}
      <section id="venues-section" className="max-w-[1440px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSan.map((san) => (
            <div key={san.MaSan} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col group">
              <div 
                className="relative h-48 bg-slate-100 overflow-hidden cursor-pointer"
                onClick={() => navigate(`/field/${san.MaSan}`)}
              >
                <img 
                  src={san.Image} 
                  alt={san.TenSan} 
                  onError={(e) => { e.target.src = DEFAULT_IMAGES[0]; }}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 
                    onClick={() => navigate(`/field/${san.MaSan}`)}
                    className="font-extrabold text-base text-slate-900 group-hover:text-emerald-600 transition mb-1 cursor-pointer"
                  >
                    {san.TenSan}
                  </h3>
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{san.ViTri.DiaChi}, Q. {san.ViTri.Quan}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">Giá thuê/giờ:</span>
                    <span className="text-base font-black text-slate-900">
                      {Number(san.GiaSan).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <button 
                    onClick={() => navigate(`/field/${san.MaSan}`)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    Đặt Ngay
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL ĐĂNG NHẬP / XÁC THỰC OTP / ADMIN 2FA */}
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
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><Phone className="w-6 h-6 text-emerald-600" /></div>
              <h2 className="text-xl font-black text-slate-900">{loginStep === 1 ? 'Đăng nhập / Đăng ký' : 'Xác thực OTP'}</h2>
              <p className="text-xs text-slate-500 mt-1">{loginStep === 1 ? 'Nhập số điện thoại để nhận mã xác thực.' : `Nhập mã được gửi đến ${normalizedPhone}`}</p>
            </div>
            {loginStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">Số điện thoại
                  <input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d+ ]/g, ''))} placeholder="0912345678" className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" required />
                </label>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left">
                  <div className="text-[11px] font-bold text-slate-500 mb-1.5">💡 Số thử nghiệm có sẵn (OTP: 123456):</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setPhoneNumber('0912345678')} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-emerald-700 hover:bg-emerald-50">0912345678</button>
                    <button type="button" onClick={() => setPhoneNumber('0905123456')} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100">0905123456 (Khách)</button>
                    <button type="button" onClick={() => setPhoneNumber('0905888999')} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-blue-700 hover:bg-blue-50">0905888999 (Chủ sân)</button>
                  </div>
                </div>
                {loginError && <p role="alert" className="text-xs text-rose-600">{loginError}</p>}
                <button disabled={isSubmitting} className="w-full py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl disabled:opacity-50">{isSubmitting ? 'Đang gửi...' : 'Gửi mã OTP'}</button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">Mã OTP (Thử nghiệm: 123456)
                  <input type="text" inputMode="numeric" maxLength={8} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))} placeholder="123456" className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center tracking-widest text-sm" required />
                </label>
                {loginError && <p role="alert" className="text-xs text-rose-600">{loginError}</p>}
                <button disabled={isSubmitting} className="w-full py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl disabled:opacity-50">{isSubmitting ? 'Đang xác minh...' : 'Xác nhận đăng nhập'}</button>
                <button type="button" onClick={() => { setLoginStep(1); setLoginError(''); }} className="w-full text-xs text-emerald-700">Đổi số điện thoại</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* YÊU CẦU ĐĂNG KÝ CHỦ SÂN */}
      {showRegPitchModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowRegPitchModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-slate-900">Đăng ký làm chủ sân</h2>
              <p className="text-sm text-slate-600 mt-2">Quyền Chủ Sân chỉ được cấp sau khi quản trị viên duyệt thông tin sân.</p>
            </div>
            <button onClick={handleRegisterOwnerSubmit} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition">Tiếp tục gửi thông tin sân</button>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN ĐẶT SÂN */}
      {bookingSuccessModal && selectedSlotForBooking && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-black text-slate-900 text-center mb-1">Xác Nhận Đặt Sân</h3>
            <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-2.5 my-5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Sân thi đấu:</span>
                <span className="font-bold">{selectedSlotForBooking.san.TenSan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Khung giờ:</span>
                <span className="font-bold text-emerald-700">{selectedSlotForBooking.slot.start} - {selectedSlotForBooking.slot.end}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-600 font-bold">Tổng thanh toán:</span>
                <span className="font-black text-base text-rose-600">
                  {Number(selectedSlotForBooking.gia).toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setBookingSuccessModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                Hủy
              </button>
              <button 
                disabled={isSubmitting}
                onClick={confirmBookingToSupabase}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
              >
                Xác Nhận Đặt
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-8 px-6 text-center text-xs text-slate-400">
        © 2026 DatSanOnline VN.
      </footer>
    </div>
  );
}
