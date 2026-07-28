export type AuthHashSessionKind = "recovery" | "invite" | "error" | null;

export type ParsedAuthHash = {
  kind: AuthHashSessionKind;
  errorDescription?: string;
};

export function parseAuthHashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

/**
 * Supabase's implicit/hash flow (GoTrue's /verify redirect) appends either
 * an error (`error`/`error_code`/`error_description`, e.g. an expired
 * recovery/invite link) or a successful session (`access_token` + a `type`
 * of `recovery` or `invite`) to the redirect URL's fragment. This never
 * reaches the server — only the browser sees it — so detection has to
 * happen client-side.
 */
export function getAuthHashSessionKind(
  params: URLSearchParams,
): ParsedAuthHash {
  const error = params.get("error") ?? params.get("error_code");
  if (error) {
    return {
      kind: "error",
      errorDescription: params.get("error_description") ?? undefined,
    };
  }

  const type = params.get("type");
  if (type === "recovery") return { kind: "recovery" };
  if (type === "invite") return { kind: "invite" };

  return { kind: null };
}

export type AuthHashTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

/**
 * Pulls the raw session tokens out of the fragment so the caller can pass
 * them straight to supabase.auth.setSession() — the explicit, reliable way
 * to establish the session, rather than waiting on the SDK's own implicit
 * detectSessionInUrl handling (onAuthStateChange/getSession) to notice them
 * on its own. Never log or persist the return value of this function.
 */
export function getAuthHashTokens(params: URLSearchParams): AuthHashTokens {
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

export type SafeAuthErrorInfo = {
  name: string | null;
  code: string | null;
  status: number | null;
  message: string | null;
};

/**
 * Whitelists exactly the four fields safe to log or show in the UI from a
 * Supabase auth error (name/code/status/message) — never the raw error
 * object itself, which must never be logged as-is: tokens/session/email
 * are not part of these fields, but nothing here assumes that stays true
 * of every future SDK error shape either.
 */
export function getSafeAuthErrorInfo(error: unknown): SafeAuthErrorInfo {
  if (!error || typeof error !== "object") {
    return { name: null, code: null, status: null, message: null };
  }

  const record = error as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : null,
    code: typeof record.code === "string" ? record.code : null,
    status: typeof record.status === "number" ? record.status : null,
    message: typeof record.message === "string" ? record.message : null,
  };
}

/**
 * A short, safe-to-display summary — code/status only, never the full
 * Supabase error message (which can occasionally echo request details).
 */
export function formatAuthErrorMessage(info: SafeAuthErrorInfo): string {
  const status = info.status ?? "?";
  const code = info.code ?? info.name ?? "unknown_error";
  return `Nie udało się potwierdzić linku (Auth ${status}: ${code}).`;
}

/**
 * Hostname only — never call this with intent to log/display the full URL
 * or any key. Used for a temporary "which Supabase project is this build
 * actually talking to" diagnostic.
 */
export function getUrlHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
