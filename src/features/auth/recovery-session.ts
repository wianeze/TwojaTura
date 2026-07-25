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
