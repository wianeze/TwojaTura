import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalPath } from "@/features/auth/safe-redirect";
import { buildAppUrl } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  const next = getSafeInternalPath(
    request.nextUrl.searchParams.get("next"),
    "/",
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
    const loginUrl = buildAppUrl("/logowanie");
    loginUrl.searchParams.set("authError", "callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(buildAppUrl(next));
}
