# QA: klasy gracza

Lokalny seed przygotowuje 14 aktywnych kont — po jednym dla każdej definicji z
`class_definitions`. Każde konto dostaje wymagane odznaki z
`class_requirements` i ma ustawioną własną aktywną klasę.

```bash
pnpm qa:classes:reset
pnpm qa:classes
pnpm qa:classes:check
```

Wszystkie konta używają adresu `qa-class-<class_key>@twojatura.local` i wspólnego
hasła `QaAchievements123!`. Przykładowo Bard Stołu loguje się jako
`qa-class-bard_stolu@twojatura.local`.

Seed tworzy konta: QA Paladyn Zasad, QA Bard Stołu, QA Łotrzyk Kart, QA Czarodziej
Analizy, QA Barbarzyńca Kości, QA Druid Półki, QA Nekromanta Figurek, QA Warlock
Meeplów, QA Multiclass Planszy, QA Wojownik Stołu, QA Kleryk Drużyny, QA Łowca
Łupów, QA Mnich Cierpliwości i QA Czarownik Chaosu.

Dodatkowo powstaje `qa-class-all@twojatura.local` (QA Wszystkie Klasy). Konto
otrzymuje sumę wymagań wszystkich 14 klas, ma aktywnego `bard_stolu` i pozwala
przełączać każdą odblokowaną klasę w UI.

Po seedzie otwórz `/legendarium`, aby sprawdzić ranking i emblematy aktywnych
klas, albo `/profil`, aby sprawdzić aktywną klasę konkretnego konta.

Fixture’y zapisują punkty od zdobytych odznak do lokalnego append-only ledgeru,
więc konta są widoczne w rankingu. `pnpm qa:classes:reset` usuwa konta o
prefiksie `qa-class-` razem z ich odznakami i lokalnymi wpisami ledgeru, bez
dotykania normalnych użytkowników. Robi to wyłącznie w lokalnym kontenerze
Postgresa, ponieważ ledger produkcyjnie pozostaje append-only. Narzędzie jest
zablokowane dla produkcji i zdalnego Supabase.
