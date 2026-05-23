import type { Session } from "@supabase/supabase-js";

import { getSupabaseAuthUrl, getSupabaseClient } from "@/lib/supabase";

export const allowedEmailDomain = import.meta.env.VITE_AUTH_ALLOWED_DOMAIN || "quartavia.com.br";

export function isAllowedQuartaviaSession(session: Session | null) {
  const email = session?.user.email?.trim().toLowerCase();
  return Boolean(email && email.endsWith(`@${allowedEmailDomain.toLowerCase()}`));
}

export function getGoogleOAuthUrl(origin: string) {
  const authorizeUrl = new URL(`${getSupabaseAuthUrl()}/authorize`);
  const redirectTo = `${origin.replace(/\/+$/, "")}/`;

  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", redirectTo);
  authorizeUrl.searchParams.set("hd", allowedEmailDomain);
  authorizeUrl.searchParams.set("prompt", "select_account");

  return authorizeUrl.toString();
}

export async function signOut() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
}
