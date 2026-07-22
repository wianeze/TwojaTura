# QA: odznaki

Lokalny seed przygotowuje siedem kont do wizualnego sprawdzania odznak i ich aur:

- QA Badge Common
- QA Badge Rare
- QA Badge Epic
- QA Badge Legendary
- QA Badge Secret Locked
- QA Badge Secret Unlocked
- QA Badge Mixed

Uruchom kolejno:

```bash
pnpm qa:badges:reset
pnpm qa:badges
pnpm qa:badges:check
```

Konta mają adresy `qa-badge-<wariant>@twojatura.local` i wspólne hasło
`QaAchievements123!`. Seed pobiera aktywne definicje bezpośrednio z
`achievement_definitions`; nie wpisuje kluczy odznak na sztywno.

W Legendarium sprawdź aury common, rare, epic i legendary, a w rankingu konta
QA Badge Legendary oraz QA Badge Mixed. Zaloguj się jako QA Badge Secret Locked,
aby potwierdzić ukrycie sekretów, a jako QA Badge Secret Unlocked, aby zobaczyć
ich normalną kartę z nazwą, opisem i grafiką.

Fixture’y zapisują odznaki oraz odpowiadające im wpisy `achievement_unlocked:*`
w append-only ledgerze, z punktami pobranymi z definicji odznaki. Dzięki temu
QA Badge Legendary i QA Badge Mixed są widoczni w rankingu z właściwymi aurami.
`qa:badges:reset` usuwa wyłącznie konta `qa-badge-*`, ich odznaki i lokalne
wpisy ledgeru — bez dotykania normalnych użytkowników. Robi to bezpośrednio w
lokalnym kontenerze Postgresa, bo ledger produkcyjnie pozostaje append-only.
Narzędzie jest zablokowane w produkcji i dla zdalnego Supabase.
