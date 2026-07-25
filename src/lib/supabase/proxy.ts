import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeAuthErrorInfo } from "@/features/auth/recovery-session";
import type { Database } from "@/types/database.generated";
import { getServerSupabaseEnv } from "./env";

const AUTH_ROUTES = [
  "/logowanie",
  "/auth/callback",
  "/ustaw-haslo",
  "/potwierdz-reset",
];
const ACCESS_DENIED_ROUTE = "/brak-dostepu";

function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);

  sessionResponse.cookies
    .getAll()
    .forEach((cookie) => redirectResponse.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) redirectResponse.headers.set(header, value);
  }

  return redirectResponse;
}

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getServerSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    matchesRoute(pathname, route),
  );
  const isAccessDeniedRoute = matchesRoute(pathname, ACCESS_DENIED_ROUTE);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (typeof userId !== "string") {
    if (!isAuthRoute && !isAccessDeniedRoute) {
      return redirectWithSession(request, response, "/logowanie");
    }
    return response;
  }

  if (
    matchesRoute(pathname, "/auth/callback") ||
    matchesRoute(pathname, "/ustaw-haslo")
  ) {
    return response;
  }

  const { data: membershipRows, error: membershipError } = await supabase.rpc(
    "get_own_membership_status",
  );

  // Diagnostic only — no email/user_id/token/cookie/JWT/URL/session data,
  // just enough to tell "RPC errored" apart from "genuinely not an active
  // member" (today those two cases are indistinguishable below).
  console.info("[proxy] get_own_membership_status:", {
    hasUser: true,
    rpcError: membershipError ? getSafeAuthErrorInfo(membershipError) : null,
    rowCount: membershipRows?.length ?? 0,
    role: membershipRows?.[0]?.role ?? null,
    is_active: membershipRows?.[0]?.is_active ?? null,
  });

  const isActiveMember = membershipRows?.[0]?.is_active === true;

  if (!isActiveMember && !isAccessDeniedRoute) {
    return redirectWithSession(request, response, ACCESS_DENIED_ROUTE);
  }

  if (
    isActiveMember &&
    (matchesRoute(pathname, "/logowanie") || isAccessDeniedRoute)
  ) {
    return redirectWithSession(request, response, "/");
  }

  return response;
}
