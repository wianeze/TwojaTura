# Powiadomienia Web Push

Prawdziwe powiadomienia przeglądarki i PWA. **To nie jest centrum powiadomień**:
w aplikacji nie ma dzwonka, listy wiadomości ani stanu przeczytane/nieprzeczytane.
Od przypomnień wewnątrz aplikacji są questy na Stole.

## Co wysyła powiadomienia

| Wyzwalacz                                           | Kto dostaje                                                               | Kiedy                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| **Utworzenie spotkania** — jedyny automatyczny push | aktywni `member` i `admin` z aktywnym urządzeniem (autor spotkania też)   | natychmiast po zapisaniu spotkania                  |
| **Ręczna kampania administratora**                  | wybrani odbiorcy albo wszyscy aktywni z urządzeniem, **w tym `observer`** | po świadomym potwierdzeniu w `/admin/powiadomienia` |

Żadne inne zdarzenie — punkty, osiągnięcia, głosowanie, wyniki, nowe gry, zmiany
rankingu — nie generuje pusha automatycznie.

## Architektura w skrócie

```
insert do public.meetings
  └─ trigger z_meetings_enqueue_push   (ta sama transakcja)
       └─ push_campaigns + push_deliveries          ← outbox
                                        commit
createMeetingAction
  └─ after(dispatchPendingPushDeliveries)           ← pierwsza próba
       └─ claim_push_deliveries (FOR UPDATE SKIP LOCKED)
            └─ web-push  →  complete_push_delivery
```

Rozdzielenie jest celowe:

- **błąd zapisu do outboxa przerywa transakcję** — spotkanie nie powstanie;
  cichy zanik zdarzenia byłby gorszy niż odrzucony formularz,
- **błąd zewnętrznej wysyłki nie robi nic spotkaniu** — dzieje się po commicie,
  a nieudane dostawy czekają w kolejce na crona albo przycisk administratora.

Kod wysyłający żyje w `src/features/push/server/` i jest oznaczony `server-only`.
`SUPABASE_SERVICE_ROLE_KEY` używa wyłącznie `service-role-client.ts`, a bibliotekę
`web-push` importuje wyłącznie `web-push-client.ts`.

## Konfiguracja

### 1. Wygenerowanie pary kluczy VAPID

```bash
npx web-push generate-vapid-keys
```

Polecenie wypisze `Public Key` i `Private Key`. Para identyfikuje serwer aplikacji
wobec dostawców push (FCM, Mozilla, Apple).

### 2. Zmienne środowiskowe

| Zmienna                        | Zasięg        | Do czego                                           |
| ------------------------------ | ------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | publiczna     | `pushManager.subscribe()` w przeglądarce           |
| `VAPID_PRIVATE_KEY`            | **serwerowa** | podpisywanie żądań do dostawców                    |
| `VAPID_SUBJECT`                | serwerowa     | `mailto:` administratora, wymagane przez dostawców |
| `SUPABASE_SERVICE_ROLE_KEY`    | serwerowa     | dispatcher czyta i aktualizuje kolejkę             |
| `CRON_SECRET`                  | serwerowa     | autoryzacja `GET /api/push/dispatch`               |

Prywatny klucz VAPID **nigdy** nie może trafić do zmiennej z prefiksem
`NEXT_PUBLIC_` ani do repozytorium.

### 3. Lokalnie

Uzupełnij `.env.local` (plik jest poza repozytorium — wzorzec nazw znajdziesz
w `.env.example`). `CRON_SECRET` lokalnie jest potrzebny tylko wtedy, gdy chcesz
ręcznie sprawdzić Route Handler.

### 4. Vercel

Project Settings → Environment Variables, zakres **Production** i **Preview**:
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

Gdy `CRON_SECRET` jest ustawiony, Vercel sam dokłada nagłówek
`Authorization: Bearer <CRON_SECRET>` do żądań crona. Harmonogram opisuje
`vercel.json` (`0 17 * * *`, czyli ok. 18:00–19:00 czasu polskiego).

> Na planie **Hobby** cron może działać najwyżej raz na dobę. Model danych
> (`next_attempt_at`) jest niezależny od częstotliwości — po przejściu na Pro
> wystarczy zmienić `schedule` w `vercel.json`, bez migracji.

Supabase nie potrzebuje żadnych sekretów: cała wysyłka dzieje się po stronie
Next.js.

## Testowanie na urządzeniu

Service worker rejestruje się automatycznie tylko w produkcji, ale kontrolka na
`/profil` rejestruje go w razie potrzeby sama — push da się więc sprawdzić także
lokalnie. `localhost` jest kontekstem bezpiecznym, więc HTTPS nie jest tam
wymagany.

```bash
pnpm build && pnpm start
```

1. `/profil` → **Włącz powiadomienia push** → zaakceptuj zgodę systemową.
2. Utwórz spotkanie w Kalendarium → powiadomienie „Nowe spotkanie!” powinno
   dotrzeć na wszystkie urządzenia, także autora.
3. Kliknij powiadomienie → aplikacja otwiera `/kalendarium/<id>`; jeśli karta
   jest już otwarta, zostaje wyniesiona na wierzch zamiast otwierać drugą.
4. `/admin/powiadomienia` → wybierz szablon → potwierdź → sprawdź liczniki
   w historii po kliknięciu **Odśwież**.

### Android / Chrome

Pełne wsparcie. Aplikacja nie ustawia pola `badge` (brak monochromatycznego
assetu), więc w pasku stanu pojawia się domyślna ikona przeglądarki.

### Desktop

Chrome, Edge i Firefox działają bez dodatkowych kroków. Safari wymaga zgody
per-origin i nie pokazuje badge'a.

### iOS / iPadOS

Wymagany **iOS 16.4+** oraz aplikacja **dodana do ekranu głównego**. W zwykłej
karcie Safari Push API nie jest dostępne — kontrolka wykrywa to i zamiast
martwego przycisku pokazuje instrukcję (Udostępnij → „Do ekranu początkowego”).

## Rotacja kluczy VAPID

Zmiana pary kluczy **unieważnia każdą istniejącą subskrypcję**: endpointy zostały
wystawione pod stary `applicationServerKey`, więc dostawcy zaczną odrzucać
wysyłki (typowo `403`).

**Wyłączenie starych subskrypcji jest krokiem jawnym i obowiązkowym.** Kod
celowo _nie_ wyłącza subskrypcji po `403` — ten kod oznacza najczęściej literówkę
w `VAPID_PRIVATE_KEY`, czyli błąd konfiguracji, a automatyczne kasowanie
subskrypcji skasowałoby wtedy powiadomienia wszystkim naraz. `disabled_at`
ustawiają wyłącznie `404` i `410`.

Procedura:

1. Wygeneruj nową parę kluczy.
2. Ustaw `NEXT_PUBLIC_VAPID_PUBLIC_KEY` i `VAPID_PRIVATE_KEY` **jednocześnie** —
   rozjazd oznacza, że wszystkie wysyłki kończą się `403`.
3. Jednorazowo wyłącz istniejące subskrypcje (po uzgodnieniu z właścicielem
   projektu, bo to operacja na danych):

   ```sql
   update public.push_subscriptions
   set disabled_at = now()
   where disabled_at is null;
   ```

4. Poproś grupę o ponowne kliknięcie **Włącz powiadomienia push**. Kontrolka na
   `/profil` pokazuje stan „wyłączone”, więc widać, kto jeszcze tego nie zrobił.

Rotacja jest zdarzeniem widocznym dla wszystkich użytkowników i wymaga
zapowiedzi.

## Statusy dostaw

| Status       | Znaczenie                                                      |
| ------------ | -------------------------------------------------------------- |
| `queued`     | czeka na pierwszą próbę albo na retry (`next_attempt_at`)      |
| `processing` | przejęta przez dispatcher; po 10 minutach wraca do `queued`    |
| `sent`       | przyjęta przez usługę push                                     |
| `failed`     | **stan końcowy**: wygasła subskrypcja, błąd trwały albo 5 prób |
| `skipped`    | subskrypcja została wyłączona już **po** utworzeniu dostawy    |

`skipped` to nie to samo co „użytkownik bez powiadomień”. Osoba bez aktywnego
urządzenia **nie dostaje rekordu dostawy w ogóle** i jest raportowana osobno,
jako „bez aktywnego urządzenia” przy doborze odbiorców.

### Ponawianie

Backoff: 5 min → 30 min → 2 h → 12 h, potem `failed`. Przycisk **Ponów oczekujące
teraz** w panelu administratora przesuwa `next_attempt_at` wyłącznie dostawom
`queued` z `attempt_count` w przedziale `(0, 5)` i od razu uruchamia kolejkę.
Statusów `failed`, `sent` i `skipped` nie da się tą drogą wskrzesić.

## Testy

```bash
pnpm test                        # testy jednostkowe, web-push zamockowany
pnpm db:test                     # pgTAP, w tym 007_push_notifications.test.sql
```

Żaden test nie wysyła prawdziwego żądania do dostawcy push.
