//kaito pls proofread bcs chilly is illiterate in js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient("https://qqfbpvbsadtjevuelavg.supabase.co", "sb_publishable_8w-0sxYD9kDXK8433umVAw_5BTxKLgp");
export const API = "http://127.0.0.1:8000";   // "" for later once deployed on Vercel, still placeholder


export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { ...(options.headers || {}) };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  return fetch(API + path, { ...options, headers });
}