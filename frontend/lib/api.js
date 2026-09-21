// frontend/src/lib/api.js
//
// One place that knows how to talk to the backend and remember who's
// logged in. Every page imports from here instead of hand-rolling fetch
// calls and reading localStorage directly — keeps that logic in one spot.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TOKEN_KEY = "sanjeevani_token";
const USER_KEY = "sanjeevani_user";

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  if (typeof window === "undefined") return null; // guards against server-side rendering
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * A small wrapper around fetch that automatically points at the backend,
 * attaches the Authorization header when a token exists, and throws a
 * real Error (with the server's message) on non-2xx responses instead of
 * silently returning a failed response you'd forget to check.
 */
export async function apiFetch(path, { method = "GET", body, isFormData = false } = {}) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}