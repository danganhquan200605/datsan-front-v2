// Compatibility adapter: UI components keep their familiar query-chain syntax,
// while every database/storage request goes through the separate DatSan API.
const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

class ApiQuery {
  constructor(table) {
    this.payload = { table, action: 'select', columns: '*', filters: [] };
  }
  select(columns = '*') { this.payload.columns = columns; return this; }
  insert(values) { this.payload.action = 'insert'; this.payload.values = values; return this; }
  update(values) { this.payload.action = 'update'; this.payload.values = values; return this; }
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
      const response = await fetch(`${apiUrl}/api/data`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.payload),
      });
      const result = await response.json();
      if (!response.ok) return { data: null, error: new Error(result.error || 'API request failed') };
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
        const response = await fetch(`${apiUrl}/api/storage/${encodeURIComponent(bucket)}`, { method: 'POST', body });
        const result = await response.json(); uploadedUrl = result.publicUrl;
        return response.ok ? { data: result.data, error: null } : { data: null, error: new Error(result.error || 'Upload failed') };
      },
      getPublicUrl(path) { return { data: { publicUrl: uploadedUrl || '' } }; },
    };
  },
};

export const supabase = {
  from(table) { return new ApiQuery(table); },
  storage,
  // Realtime subscriptions are intentionally not provided by the REST API.
  channel() { return { on() { return this; }, subscribe() { return this; } }; },
  removeChannel() {},
};
