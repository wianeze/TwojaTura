# Twoja Tura!

Prywatna, responsywna aplikacja do zarządzania kolekcją planszówek, spotkaniami i historią rozgrywek grupy znajomych.

> Zbierz ekipę. Wybierz grę. Twoja tura.

Aktualny stan: statyczny interfejs Etapu 1 oraz migracje, seed i polityki bezpieczeństwa Etapu 2. Ekrany i logowanie nie są jeszcze podłączone do Supabase.

## Branding

„Twoja Tura!” korzysta z klubowego emblematu i lokalnych assetów inspirowanych planszówkowym wieczorem w górskiej chacie.

## Wymagania

- Node.js 20.9 lub nowszy
- pnpm 10 lub nowszy
- Docker Desktop albo inny runtime zgodny z Docker API, uruchomiony przed startem Supabase

Supabase CLI nie wymaga instalacji globalnej. Skrypty projektu uruchamiają przypiętą wersję CLI przez `pnpm dlx`.

## Instalacja

```bash
pnpm install
```

## Lokalne Supabase

Pierwsze uruchomienie pobierze CLI i obrazy kontenerów:

```bash
pnpm supabase:start
pnpm supabase:status
```

Studio będzie dostępne pod `http://127.0.0.1:54323`, API pod `http://127.0.0.1:54321`, a Postgres na porcie `54322`.

Pełny reset od pustej bazy uruchamia wszystkie migracje, a następnie `supabase/seed.sql`:

```bash
pnpm db:reset
```

Zastosowanie wyłącznie oczekujących migracji:

```bash
pnpm db:migrate
```

Automatyczne testy bazy i RLS:

```bash
pnpm db:test
```

Generowanie typów bez ręcznej edycji pliku wynikowego:

```bash
pnpm db:types
```

Pełna weryfikacja bazy (`reset → testy → typy`):

```bash
pnpm db:verify
```

Zatrzymanie lokalnego środowiska:

```bash
pnpm supabase:stop
```

## Lokalne konta testowe

Wszystkie konta używają wyłącznie lokalnego hasła `TwojaTura123!`:

| Rola              | Email                      |
| ----------------- | -------------------------- |
| Admin             | `admin@twojatura.local`    |
| Member            | `marta@twojatura.local`    |
| Member            | `michal@twojatura.local`   |
| Member            | `ania@twojatura.local`     |
| Member            | `kuba@twojatura.local`     |
| Nieaktywny member | `inactive@twojatura.local` |

Logowanie tymi kontami zostanie podłączone dopiero w Etapie 3. Dane są deterministyczne i nie mogą być używane w środowisku produkcyjnym.

## Uruchomienie aplikacji

Supabase nie musi działać, aby obejrzeć nadal statyczne ekrany:

```bash
pnpm dev
```

Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

## Kontrola jakości

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

Wszystkie statyczne kontrole można uruchomić poleceniem `pnpm check`.

Kontrola kompletna przed zmianą schematu:

```bash
pnpm db:verify
pnpm check
pnpm build
```

## Stack

- Next.js 16 z App Routerem
- React 19
- TypeScript w trybie `strict`
- Tailwind CSS 4
- ESLint i Prettier
