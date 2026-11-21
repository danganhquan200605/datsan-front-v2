// Compatibility adapter: UI components keep their familiar query-chain syntax,
// while every database/storage request goes through the separate DatSan API.
const isBrowserRemote = typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

let rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
if (isBrowserRemote) {
  // If running online (e.g. Vercel), route directly to live Render backend
  if (!rawApiUrl || rawApiUrl.includes('datsan-back-v2.vercel.app') || rawApiUrl.includes('localhost')) {
    rawApiUrl = 'https://datsan-back-v2.onrender.com';
  }
} else if (!rawApiUrl) {
  rawApiUrl = 'http://localhost:5000';
}

const apiUrl = rawApiUrl.replace(/\/$/, '');
const activeChannels = new WeakMap();

export function getCurrentUser() {
  try {
    const saved = sessionStorage.getItem('datsan_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function broadcastAuthChange(user) {
  if (user) {
    sessionStorage.setItem('datsan_user', JSON.stringify(user));
  } else {
    sessionStorage.removeItem('datsan_user');
    sessionStorage.removeItem('datsan_access_token');
    sessionStorage.removeItem('datsan_refresh_token');
  }
  window.dispatchEvent(new CustomEvent('datsan_auth_change', { detail: user }));
}

const getAccessToken = () => sessionStorage.getItem('datsan_access_token');

export async function refreshAuthSession() {
  const refreshToken = sessionStorage.getItem('datsan_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.accessToken) {
      sessionStorage.setItem('datsan_access_token', data.accessToken);
      if (data.refreshToken) sessionStorage.setItem('datsan_refresh_token', data.refreshToken);
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

async function apiRequest(path, options = {}) {
  let token = getAccessToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  let response = await fetch(`${apiUrl}${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) });

  // Tự động làm mới access token nếu gặp lỗi 401 hết hạn phiên
  if (response.status === 401 && path !== '/api/auth/refresh' && sessionStorage.getItem('datsan_refresh_token')) {
    const refreshed = await refreshAuthSession();
    if (refreshed?.accessToken) {
      headers.Authorization = `Bearer ${refreshed.accessToken}`;
      response = await fetch(`${apiUrl}${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) });
    }
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'API request failed');
  return result;
}

export async function requestPhoneOtp(phone) {
  return apiRequest('/api/auth/otp', { method: 'POST', body: JSON.stringify({ phone }) });
}

export async function verifyPhoneOtp(phone, token) {
  return apiRequest('/api/auth/verify', { method: 'POST', body: JSON.stringify({ phone, token }) });
}

export async function settleOwnerBooking(action, bookingId, ownerId) {
  return apiRequest('/api/owner/settle-booking', {
    method: 'POST',
    body: JSON.stringify({ action, bookingId, ownerId }),
  });
}

export async function fetchNotifications(userId, role) {
  try {
    const query = new URLSearchParams();
    if (userId) query.set('manguoidung', userId);
    if (role) query.set('role', role);
    const res = await apiRequest(`/api/notifications?${query.toString()}`);
    return res.data || [];
  } catch (err) {
    console.warn('Lỗi lấy thông báo:', err);
    return [];
  }
}

export async function sendNotification({ manguoidung, tieude, noidung, loaithongbao = 'SYSTEM' }) {
  return apiRequest('/api/notifications', {
    method: 'POST',
    body: JSON.stringify({ manguoidung, tieude, noidung, loaithongbao }),
  });
}

export async function markNotificationAsRead(mathongbao, manguoidung, all = false, role = null) {
  return apiRequest('/api/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ mathongbao, manguoidung, all, role }),
  });
}

export async function triggerAutoComplete() {
  try {
    return await apiRequest('/api/bookings/auto-complete', { method: 'POST' });
  } catch {
    return null;
  }
}

export async function fetchAdminOverview() {
  return apiRequest('/api/admin/overview');
}

export async function fetchOwnerOverview() {
  return apiRequest('/api/owner/overview');
}

export async function updateAdminFieldStatus(masan, status, reason = '') {
  return apiRequest(`/api/admin/fields/${masan}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, reason }),
  });
}

export async function updateAdminUserRole(userId, role) {
  return apiRequest(`/api/admin/users/${userId}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

// FEATURE 01: OWNER SECURITY DEPOSIT HELPERS
export async function fetchOwnerDeposit() {
  return apiRequest('/api/owner/deposit');
}

export async function requestOwnerDeposit() {
  return apiRequest('/api/owner/deposit/request', { method: 'POST' });
}

export async function submitOwnerDepositProof(data) {
  return apiRequest('/api/owner/deposit/submit-proof', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchAdminDeposits() {
  return apiRequest('/api/admin/deposits');
}

export async function verifyAdminDeposit(data) {
  return apiRequest('/api/admin/deposits/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function requestOwnerDepositRefund(data) {
  return apiRequest('/api/owner/deposit/refund-request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function settleAdminDepositRefund(data) {
  return apiRequest('/api/admin/deposits/settle-refund', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// FEATURE 02: CUSTOMER CANCELLATION & REFUND HELPERS
export async function checkCustomerCancellation(bookingId) {
  return apiRequest(`/api/customer/cancellation-check/${bookingId}`);
}

export async function cancelCustomerBooking(data) {
  return apiRequest('/api/customer/cancel-booking', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchOwnerRefunds() {
  return apiRequest('/api/owner/refunds');
}

export async function confirmOwnerRefundSent(refundId, data) {
  return apiRequest(`/api/owner/refunds/${refundId}/confirm-sent`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function confirmCustomerRefundReceived(refundId, data) {
  return apiRequest(`/api/customer/refunds/${refundId}/confirm-received`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchCustomerRefunds() {
  return apiRequest('/api/customer/refunds');
}

export async function fetchAdminRefunds() {
  return apiRequest('/api/admin/refunds');
}

export async function resolveAdminRefundDispute(refundId, data) {
  return apiRequest(`/api/admin/refunds/${refundId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitOwnerRefundExplanation(refundId, data) {
  return apiRequest(`/api/owner/refunds/${refundId}/explain`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitOwnerRefundAppeal(refundId, data) {
  return apiRequest(`/api/owner/refunds/${refundId}/appeal`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function adjudicateAdminRefund(refundId, data) {
  return apiRequest(`/api/admin/refunds/${refundId}/adjudicate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function disburseCustomerRefund(refundId, data) {
  return apiRequest(`/api/admin/refunds/${refundId}/disburse-customer`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function topUpOwnerDeposit(data) {
  return apiRequest('/api/owner/deposit/top-up', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function checkAdminOverdueRefunds() {
  return apiRequest('/api/admin/refunds/check-overdue', {
    method: 'POST',
  });
}

class ApiQuery {
  constructor(table) {
    this.payload = { table, action: 'select', columns: '*', filters: [] };
  }
  select(columns = '*') { this.payload.columns = columns; return this; }
  insert(values) { this.payload.action = 'insert'; this.payload.values = values; return this; }
  update(values) {
    this.payload.action = 'update';
    this.payload.values = values;
    if (this.payload.table === 'nguoidung') this.payload.columns = 'manguoidung';
    return this;
  }
  eq(column, value) { this.payload.filters.push({ operator: 'eq', column, value }); return this; }
  neq(column, value) { this.payload.filters.push({ operator: 'neq', column, value }); return this; }
  in(column, value) { this.payload.filters.push({ operator: 'in', column, value }); return this; }
  gte(column, value) { this.payload.filters.push({ operator: 'gte', column, value }); return this; }
  lte(column, value) { this.payload.filters.push({ operator: 'lte', column, value }); return this; }
  order(column, options = {}) { this.payload.order = { column, ascending: options.ascending }; return this; }
  limit(value) { this.payload.limit = value; return this; }
  single() { this.payload.single = 'single'; return this.execute(); }
  maybeSingle() { this.payload.single = 'maybeSingle'; return this.execute(); }
  async execute() {
    try {
      const result = await apiRequest('/api/data', { method: 'POST', body: JSON.stringify(this.payload) });
      return { data: result.data, error: null };
    } catch (error) { return { data: null, error }; }
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

const storage = {
  from(bucket) {
    let uploadedUrl;
    return {
      async upload(path, file) {
        const body = new FormData(); body.append('file', file); body.append('path', path);
        const token = sessionStorage.getItem('datsan_access_token');
        const response = await fetch(`${apiUrl}/api/storage/${encodeURIComponent(bucket)}`, {
          method: 'POST', body,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const result = await response.json(); uploadedUrl = result.publicUrl;
        return response.ok ? { data: result.data, error: null } : { data: null, error: new Error(result.error || 'Upload failed') };
      },
      getPublicUrl() { return { data: { publicUrl: uploadedUrl || '' } }; },
    };
  },
};

export const supabase = {
  from(table) { return new ApiQuery(table); },
  async availability(date, masan) {
    try {
      const query = new URLSearchParams({ date });
      if (masan != null) query.set('masan', masan);
      const result = await apiRequest(`/api/availability?${query}`);
      return { data: result.data, error: null };
    } catch (error) { return { data: null, error }; }
  },
  async createBooking({ masan, date, slotIds, services = {}, paymentMethod = 'QR' }) {
    try {
      const result = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ masan, date, slotIds, services, paymentMethod }),
      });
      return { data: result.data, error: null };
    } catch (error) { return { data: null, error }; }
  },
  async settleOwnerBooking(action, bookingId, ownerId) {
    try {
      const result = await settleOwnerBooking(action, bookingId, ownerId);
      return { data: result, error: null };
    } catch (error) { return { data: null, error }; }
  },
  async getNotifications(userId, role) {
    return fetchNotifications(userId, role);
  },
  async sendNotification(payload) {
    return sendNotification(payload);
  },
  async markNotificationRead(mathongbao, userId, all) {
    return markNotificationAsRead(mathongbao, userId, all);
  },
  async triggerAutoComplete() {
    return triggerAutoComplete();
  },
  storage,
  // The REST adapter refreshes subscribed queries periodically; it is not a WebSocket subscription.
  channel() {
    const callbacks = [];
    const channel = {
      on(_event, _filter, callback) {
        if (typeof callback === 'function') callbacks.push(callback);
        return this;
      },
      subscribe() {
        const timer = window.setInterval(() => {
          callbacks.forEach((callback) => Promise.resolve(callback()).catch((error) => console.error('Lỗi tự làm mới dữ liệu:', error)));
        }, 30000);
        activeChannels.set(this, timer);
        return this;
      }
    };
    return channel;
  },
  removeChannel(channel) {
    const timer = activeChannels.get(channel);
    if (timer) window.clearInterval(timer);
    activeChannels.delete(channel);
  },
};

export async function registerField(fieldData) {
  return apiRequest('/api/fields/register', {
    method: 'POST',
    body: JSON.stringify(fieldData),
  });
}

export async function processMockPayment(payload) {
  return apiRequest('/api/mock-payment/process', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function simulateBookingPayment({ bookingId, simulationAction = 'SIMULATE_SUCCESS', fallbackAction = null }) {
  return apiRequest('/api/mock-payment/process', {
    method: 'POST',
    body: JSON.stringify({
      transactionType: 'BOOKING',
      transactionId: Number(bookingId),
      simulationAction,
      fallbackAction
    })
  });
}

export async function getMockPaymentConfig() {
  return apiRequest('/api/mock-payment/config');
}

export function getMockBookingQrSvg(amount = 0, info = 'DATSAN') {
  const formattedAmount = (Number(amount || 0)).toLocaleString('vi-VN');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="#f8fafc" rx="16"/>
    <rect x="15" y="15" width="270" height="270" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" rx="12"/>
    <rect x="35" y="35" width="55" height="55" fill="#0f172a" rx="6"/>
    <rect x="45" y="45" width="35" height="35" fill="#ffffff" rx="3"/>
    <rect x="52" y="52" width="21" height="21" fill="#0f172a"/>
    <rect x="210" y="35" width="55" height="55" fill="#0f172a" rx="6"/>
    <rect x="220" y="45" width="35" height="35" fill="#ffffff" rx="3"/>
    <rect x="227" y="52" width="21" height="21" fill="#0f172a"/>
    <rect x="35" y="210" width="55" height="55" fill="#0f172a" rx="6"/>
    <rect x="45" y="220" width="35" height="35" fill="#ffffff" rx="3"/>
    <rect x="52" y="227" width="21" height="21" fill="#0f172a"/>
    <rect x="25" y="105" width="250" height="90" fill="#fee2e2" stroke="#ef4444" stroke-width="1.5" rx="10"/>
    <text x="150" y="132" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#b91c1c" text-anchor="middle">⚡ MÔ PHỎNG THANH TOÁN ⚡</text>
    <text x="150" y="153" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#7f1d1d" text-anchor="middle">KHÔNG QUÉT BẰNG APP NGÂN HÀNG THẬT</text>
    <text x="150" y="174" font-family="system-ui, sans-serif" font-size="10" fill="#991b1b" text-anchor="middle">DEMO ONLY - ${info}</text>
    <text x="150" y="245" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle">DATSAN ONLINE SIMULATION</text>
    <text x="150" y="265" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">${formattedAmount} đ</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
