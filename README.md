# Twoja Tura!

Prywatna, responsywna aplikacja do zarządzania kolekcją planszówek, spotkaniami i historią rozgrywek grupy znajomych.

> Zbierz ekipę. Wybierz grę. Twoja tura.

Aktualny stan: Etapy 1–4 są zaimplementowane lokalnie. Auth działa z zaproszeniami i aktywnym członkostwem, a domeny `games` oraz `ratings` korzystają już z prawdziwych danych Supabase w sekcji Półka i na kartach gier.

## Wymagania

- Node.js 20.9 lub nowszy
- pnpm 10 lub nowszy
- Docker Desktop albo inny runtime zgodny z Docker API

## Instalacja i konfiguracja

```bash
pnpm install
copy .env.example .env.local
```

W `.env.local` ustaw wartości pokazane przez `pnpm supabase:status`:

- `NEXT_PUBLIC_SUPABASE_URL` — lokalny API URL,
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — lokalny publishable key,
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

`SUPABASE_SERVICE_ROLE_KEY` jest potrzebny wyłącznie zaufanemu skryptowi zaproszeń i dla lokalnego Auth Admin invite flow powinien być legacy JWT `service_role`, nie `sb_secret_...`. `SUPABASE_SECRET_KEY` może nadal istnieć dla innych operacji backendowych, ale operatorski invite nie korzysta już z niego. Żaden z tych sekretów nie może mieć prefiksu `NEXT_PUBLIC_`, trafiać do kodu klienta, logów ani repozytorium.

## Lokalne Supabase

```bash
pnpm supabase:start
pnpm supabase:status
pnpm db:reset
```

Lokalne usługi:

- Studio: `http://127.0.0.1:54323`
- API: `http://127.0.0.1:54321`
- Mailpit: `http://127.0.0.1:54324`
- Postgres: port `54322`

Pozostałe komendy bazy:

```bash
pnpm db:migrate
pnpm db:test
pnpm db:types
pnpm db:verify
pnpm supabase:stop
```

`db:types` generuje `src/types/database.generated.ts`. Plik jest celowo wyłączony wyłącznie z kontroli Prettier.

## Uruchomienie aplikacji

Po uruchomieniu Supabase:

```bash
pnpm dev
```

Aplikacja działa pod [http://localhost:3000](http://localhost:3000).

## Lokalne konta testowe

Wszystkie konta używają lokalnego hasła `TwojaTura123!`:

| Rola             | Email                      |
| ---------------- | -------------------------- |
| Administrator    | `admin@twojatura.local`    |
| Gracz            | `marta@twojatura.local`    |
| Gracz            | `michal@twojatura.local`   |
| Gracz            | `ania@twojatura.local`     |
| Gracz            | `kuba@twojatura.local`     |
| Nieaktywny gracz | `inactive@twojatura.local` |

Konta i hasło służą wyłącznie lokalnym testom.

## Recovery i zaproszenia

Wiadomości recovery oraz invite są widoczne w lokalnym Mailpit pod `http://127.0.0.1:54324`. Link przechodzi przez `/auth/callback` i prowadzi do `/ustaw-haslo`.

Zaproszenie nowej osoby wykonuje zaufany operator:

```bash
pnpm invite:user -- --email osoba@example.com --name "Imię Gracza"
```

Skrypt korzysta z Admin API i `SUPABASE_SERVICE_ROLE_KEY` w formacie JWT `service_role`. Trigger bazy tworzy profil oraz aktywne członkostwo z rolą `member`; roli administratora nie można przekazać w zaproszeniu.

## Kontrola jakości

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

`pnpm check` uruchamia lint, typecheck i format check. Po zmianie migracji użyj również `pnpm db:verify`.

## Stack

- Next.js 16 z App Routerem i `proxy.ts`
- React 19
- TypeScript `strict`
- Tailwind CSS 4
- Supabase Auth/Postgres z `@supabase/ssr`
- ESLint i Prettier
