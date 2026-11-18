// Compatibility adapter: UI components keep their familiar query-chain syntax,
// while every database/storage request goes through the separate DatSan API.
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const activeChannels = new WeakMap();

const getAccessToken = () => sessionStorage.getItem('datsan_access_token');

async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) });
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
  async createBooking({ masan, date, slotIds, services = {} }) {
    try {
      const result = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ masan, date, slotIds, services }),
      });
      return { data: result.data, error: null };
    } catch (error) { return { data: null, error }; }
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
