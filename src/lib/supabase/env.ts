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

/**
 * Storage SDK calls (createSignedUrl/createSignedUrls) made with the
 * server-side client build their returned URL by prefixing the *server's*
 * own configured base URL (SUPABASE_URL, e.g. http://127.0.0.1:54321) onto
 * the path Supabase returns — that's correct for the server's own use, but
 * this string then gets sent to and loaded by the *browser* (an <img src>).
 * When SUPABASE_URL differs from NEXT_PUBLIC_SUPABASE_URL (LAN testing:
 * server talks loopback, phone needs the LAN IP), the resulting <img> tries
 * to load from the phone's own loopback and never resolves — no error, no
 * timeout, just a photo that silently never appears. Rewriting the host
 * here is a pure string fix: it doesn't change which URL the server itself
 * used to talk to Supabase (already completed by this point), only what
 * host ends up in the value handed to the browser.
 */
export function toPublicStorageUrl(url: string): string {
  const serverUrl = getServerSupabaseEnv().url;
  const publicUrl = getPublicSupabaseEnv().url;

  if (serverUrl === publicUrl || !url.startsWith(serverUrl)) {
    return url;
  }

  return publicUrl + url.slice(serverUrl.length);
}
