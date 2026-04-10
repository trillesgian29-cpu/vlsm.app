// lib/api.js — Flask API client

const BASE = '';  // same origin (Vite proxies /api to Flask in dev)

async function req(path, opts = {}) {
  const res  = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    credentials: 'include',
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  login:    body => req('/api/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  signup:   body => req('/api/auth/signup',   { method: 'POST', body: JSON.stringify(body) }),
  logout:   ()   => req('/api/auth/logout',   { method: 'POST' }),
  me:       ()   => req('/api/auth/me'),
  calculate:body => req('/api/calculate',     { method: 'POST', body: JSON.stringify(body) }),
  history:  ()   => req('/api/history'),
  getCalc:  id   => req(`/api/history/${id}`),
};
