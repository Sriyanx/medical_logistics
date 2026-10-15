import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_URL = 'http://10.0.2.2:3000/api';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, '');

let session = { token: null, user: null };

export async function restoreSession() {
  const raw = await AsyncStorage.getItem('medisales_session');
  if (!raw) return session;
  try { session = JSON.parse(raw); } catch { await AsyncStorage.removeItem('medisales_session'); }
  return session;
}

export function getSession() { return session; }

export async function setSession(next) {
  session = next;
  await AsyncStorage.setItem('medisales_session', JSON.stringify(session));
}

export async function clearSession() {
  session = { token: null, user: null };
  await AsyncStorage.removeItem('medisales_session');
}

export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

export const endpoints = {
  apiUrl: API_URL,
  login: (email, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  dashboard: () => api('/dashboard'),
  catalogue: () => api('/catalogue'),
  autocomplete: q => api(`/medicines/autocomplete?q=${encodeURIComponent(q)}`),
  products: () => api('/products'),
  inventory: () => api('/inventory/batches'),
  orders: () => api('/orders'),
  order: id => api(`/orders/${id}`),
  createOrder: payload => api('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  updateOrderStatus: (id, status) => api(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  invoices: () => api('/invoices'),
  invoice: id => api(`/invoices/${id}`),
  generateInvoice: orderId => api('/invoices/generate', { method: 'POST', body: JSON.stringify({ orderId }) }),
  updatePayment: (id, payload) => api(`/invoices/${id}/payment`, { method: 'PATCH', body: JSON.stringify(payload) }),
  requirements: () => api('/requirements'),
  createRequirement: payload => api('/requirements', { method: 'POST', body: JSON.stringify(payload) })
};
