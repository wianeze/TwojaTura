import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalPath } from "@/features/auth/safe-redirect";
import { getSafeAuthErrorInfo } from "@/features/auth/recovery-session";
import { buildAppUrl } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  const next = getSafeInternalPath(
    request.nextUrl.searchParams.get("next"),
    "/",
  );

  // Diagnostic only — param names, never their values (no token_hash, no
  // full URL, no cookies/session/email/keys).
  console.info(
    "[auth/callback] query params present:",
    Array.from(request.nextUrl.searchParams.keys()),
  );

  const hasSupportedOtpType =
    requestedType === "invite" || requestedType === "recovery";

  if (!code && (!tokenHash || !hasSupportedOtpType)) {
    const loginUrl = buildAppUrl("/logowanie");
    loginUrl.searchParams.set("authError", "invalid_callback");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: requestedType as "invite" | "recovery",
      });

  if (error) {
    // Diagnostic only — the four whitelisted fields, never the raw error
    // (which could carry request/token details in other SDK error shapes).
    console.error(
      "[auth/callback] verifyOtp/exchangeCodeForSession failed:",
      getSafeAuthErrorInfo(error),
    );
    const loginUrl = buildAppUrl("/logowanie");
    loginUrl.searchParams.set("authError", "callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(buildAppUrl(next));
}
