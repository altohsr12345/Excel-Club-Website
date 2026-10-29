//kaito pls proofread bcs chilly is illiterate in js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient("https://qqfbpvbsadtjevuelavg.supabase.co", "sb_publishable_8w-0sxYD9kDXK8433umVAw_5BTxKLgp");
export const API = "";   // "" for later once deployed on Vercel, still placeholder


export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { ...(options.headers || {}) };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  return fetch(API + path, { ...options, headers });
}

export function apiPost(path, body, method = "POST") {
  return apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const apiPatch = (path, body) => apiPost(path, body, "PATCH");

// pulls the message out of a failed response; fastapi sends {detail: "..."} or a list for validation errors
export async function errorDetail(res) {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg).join("; ");
  return `Request failed (${res.status})`;
}

// returns { profile, status, error }; status 0 means the backend couldnt be reached
export async function getMe() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { profile: null, status: 401, error: "Not logged in" };

  try {
    const res = await apiFetch("/api/me");
    if (res.ok) return { profile: await res.json(), status: res.status, error: null };
    return { profile: null, status: res.status, error: await errorDetail(res) };
  } catch {
    return { profile: null, status: 0, error: "Couldn't reach the server" };
  }
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}