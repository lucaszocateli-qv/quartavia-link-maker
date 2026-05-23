import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let supabaseClient: SupabaseClient | null = null;

function getSupabaseConfig() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase não está configurado.");
  }

  return {
    publishableKey: supabasePublishableKey,
    url: supabaseUrl.replace(/\/+$/, ""),
  };
}

export function getSupabaseClient() {
  const config = getSupabaseConfig();

  if (!supabaseClient) {
    supabaseClient = createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
        persistSession: true,
      },
    });
  }

  return supabaseClient;
}

export function getSupabaseAuthUrl() {
  return `${getSupabaseConfig().url}/auth/v1`;
}
