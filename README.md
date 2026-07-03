# Twoja Tura!

Prywatna, responsywna aplikacja do zarządzania kolekcją planszówek, spotkaniami i historią rozgrywek grupy znajomych.

> Zbierz ekipę. Wybierz grę. Twoja tura.

Aktualny stan: statyczny prototyp brandingu i głównych ekranów. Logowanie, Supabase i baza danych nie są jeszcze podłączone.

## Branding

„Twoja Tura!” korzysta z klubowego emblematu z górami, drewnianym stołem, meeple’em i bursztynowym blaskiem kominka. Znak jest komponentem SVG zapisanym bezpośrednio w aplikacji — nie wymaga zewnętrznych obrazów.

## Wymagania

- Node.js 20.9 lub nowszy
- pnpm 10 lub nowszy

## Uruchomienie

```bash
pnpm install
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

## Stack

- Next.js 16 z App Routerem
- React 19
- TypeScript w trybie `strict`
- Tailwind CSS 4
- ESLint i Prettier
