import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchPendingPushDeliveries } from "@/features/push/server/dispatch";

// web-push używa node:crypto — Edge runtime nie wchodzi w grę.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const provided = Buffer.from(header);
  const reference = Buffer.from(expected);

  // timingSafeEqual wymaga równych długości, a samo porównanie długości
  // wycieka tylko rozmiar sekretu — nie jego treść.
  if (provided.length !== reference.length) return false;

  return timingSafeEqual(provided, reference);
}

/**
 * Wyzwalacz dispatchera dla Vercel Cron.
 *
 * Cron Vercela wysyła GET z nagłówkiem `Authorization: Bearer $CRON_SECRET`.
 * Handler świadomie ignoruje całe wejście: nie przyjmuje odbiorców, treści
 * powiadomienia ani listy subskrypcji. Jedyne, co potrafi zlecić, to
 * przetworzenie dostaw już zapisanych w outboxie.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Brak sekretu to błąd konfiguracji, nie zaproszenie do wejścia bez niego.
  if (!secret) {
    return NextResponse.json(
      { error: "Dispatcher nie jest skonfigurowany." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const summary = await dispatchPendingPushDeliveries();

  return NextResponse.json(summary, { status: 200 });
}
