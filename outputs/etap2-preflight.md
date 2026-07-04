# Etap 2 — technical preflight

Data: 2026-07-04

## Wynik

Model można utworzyć od pustej lokalnej bazy w ośmiu uporządkowanych migracjach. Preflight nie wykazał konfliktu wymagającego zmiany decyzji produktowej. Wykryte trzy techniczne niejednoznaczności zostały rozstrzygnięte na poziomie bazy.

## Decyzje integralności

1. `meetings.selected_option_id` nie korzysta ze zwykłego FK do `meeting_options.id`. Złożony FK `(id, selected_option_id) -> (meeting_id, id)` gwarantuje, że termin należy do tego samego spotkania. Cykl tworzenia jest bezpieczny, ponieważ spotkanie zaczyna z wartością `null`, a termin wybiera się po utworzeniu opcji.
2. `plays.meeting_id` jest nullable i ma `ON DELETE SET NULL`. Kronika zachowuje więc zarówno partie przypisane do Kalendarium, jak i partie spontaniczne.
3. Szczegółowy `point_events` nie został otwarty dla grupy. `user_point_balances` pozostaje widokiem `security_invoker` do własnego salda (lub wszystkich sald dla admina), a globalny ranking udostępnia osobne RPC `get_leaderboard()` z pięcioma niesensytywnymi polami.

## Kolejność i relacje

- Najpierw powstają schematy, rozszerzenia i enumy, potem profile/członkostwo, dane domenowe, funkcje i triggery, RLS, a na końcu widoki, RPC i granty.
- Wszystkie FK wskazują tabelę utworzoną wcześniej. Jedyny świadomy cykl (`meetings` ↔ `meeting_options`) jest dodawany po utworzeniu obu tabel.
- Kasowanie historii jest ograniczone: użytkowników i gier użytych w historii nie można przypadkowo usunąć, a skasowanie spotkania nie usuwa partii.

## RLS i funkcje zaufane

- RLS jest włączone na wszystkich 13 tabelach publicznych.
- `private.is_active_member()` i `private.is_admin()` są `STABLE SECURITY DEFINER`, używają pustego `search_path` i w pełni kwalifikowanych nazw. Pozwala to sprawdzać członkostwo bez rekurencji polityk.
- Funkcje triggerów i zapisu audytu nie są wykonywalne bezpośrednio przez klienta.
- Widoki agregujące używają `security_invoker = true`; ich wyniki są ograniczane przez polityki tabel źródłowych.
- `get_leaderboard()` jest celowym, wąskim wyjątkiem: sprawdza aktywne członkostwo, nie zwraca danych zdarzeń punktowych i ma odebrane domyślne prawa `PUBLIC`.

## Append-only i audyt

- `point_events` oraz `audit_log` nie mają klienckich polityk/grantów `UPDATE` ani `DELETE` i dodatkowo posiadają triggery odrzucające mutację. Korekta punktów jest nowym zdarzeniem.
- `audit_log` nie ma klienckiego `INSERT`. Wpis powstaje atomowo w triggerze po ważnej zmianie wykonanej przez aktywnego admina.
- Nie są audytowane odczyty, własne odpowiedzi ankietowe, głosy ani zwykłe oceny membera.

## Reset lokalny

Konfiguracja, migracje, seed i 40 testów pgTAP są przygotowane do `pnpm db:verify`. W bieżącym środowisku nie ma Dockera ani Supabase CLI, dlatego pełny reset i wykonanie SQL nie zostały przeprowadzone. Typy TypeScript nie zostały stworzone ręcznie; skrypt wygeneruje je dopiero z uruchomionej lokalnej bazy.
