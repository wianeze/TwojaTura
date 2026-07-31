import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// api/push jest wyłączone celowo: Route Handler dispatchera wywołuje cron
// Vercela, który nie ma ciasteczek sesji — updateSession przekierowałby go na
// /logowanie zamiast wykonać wysyłkę. Autoryzację robi tam CRON_SECRET,
// więc wyłączenie z proxy nie oznacza publicznego endpointu.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/push|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff2?)$).*)",
  ],
};
