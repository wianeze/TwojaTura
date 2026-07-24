const PUBLIC_ENV_ERROR =
  "Brakuje konfiguracji Supabase. Uzupełnij NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(PUBLIC_ENV_ERROR);
  }

  return { url, publishableKey };
}

/**
 * Server-side callers (Server Components/Actions, proxy/middleware) run on
 * the same machine as Supabase itself, so they can always reach it at
 * NEXT_PUBLIC_SUPABASE_URL's value directly — no LAN hop involved. The
 * optional SUPABASE_URL override exists only for local LAN testing (e.g. a
 * phone hitting the Next.js server over Wi-Fi): the *browser* then needs
 * NEXT_PUBLIC_SUPABASE_URL set to the machine's LAN address (Supabase must
 * be reachable from the phone too), while the server keeps talking to
 * Supabase over 127.0.0.1. SUPABASE_URL has no NEXT_PUBLIC_ prefix, so it's
 * never bundled into client-side JS. Falls back to the public URL when
 * unset, so this is a no-op everywhere the two already match (production,
 * or dev accessed only via localhost).
 */
export function getServerSupabaseEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(PUBLIC_ENV_ERROR);
  }

  return { url, publishableKey };
}
