import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { pushDispatchErrorResponse } from "@/features/push/dispatch-errors";
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
 *
 * Kontrakt odpowiedzi:
 *   200 + podsumowanie — kolejka została przetworzona; `claimed: 0` znaczy
 *                        wtedy dokładnie tyle, że nie było czego wysyłać,
 *   500 push_dispatch_claim_failed — claim padł, kolejka NIE przetworzona,
 *   503 push_dispatch_not_configured — brak konfiguracji środowiska,
 *   401 — zły albo brakujący sekret crona.
 *
 * Awaria zapisu wyniku POJEDYNCZEJ dostawy nie jest awarią biegu: reszta
 * urządzeń została obsłużona, więc odpowiedź to nadal 200 — ale z niezerowym
 * `internalFailed` w podsumowaniu. To celowo nie jest 500: cron ma się nie
 * zapętlić w ponawianiu całego biegu, a odzysk rekordów `processing` i tak
 * odbywa się w bazie. Monitoring ma czego pilnować — `internalFailed > 0` jest
 * jawne w treści odpowiedzi, więc sukces nigdy nie jest pozorny.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Brak sekretu to błąd konfiguracji, nie zaproszenie do wejścia bez niego.
  if (!secret) {
    return NextResponse.json(
      { error: "push_dispatch_not_configured" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  try {
    const summary = await dispatchPendingPushDeliveries();

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const { status, body } = pushDispatchErrorResponse(error);

    return NextResponse.json(body, { status });
  }
}
