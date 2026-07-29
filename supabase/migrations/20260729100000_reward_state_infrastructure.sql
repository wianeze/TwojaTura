-- Infrastruktura przeliczania nagród pochodzących z partii (M1 z planu
-- „tryb kooperacyjny + przeliczanie nagród”).
--
-- Ta migracja jest wyłącznie strukturalna: nie zmienia ani jednego istniejącego
-- wiersza i nie zmienia zachowania żadnej funkcji. Wprowadza fundament, na
-- którym kolejne migracje (M2-M8) zbudują deklaratywny recompute.
--
-- Kluczowa zasada, której ta migracja NIE narusza: public.point_events
-- pozostaje bezwarunkowo append-only. Korekty nagród realizujemy zdarzeniami
-- kompensującymi (ujemne `points`), nigdy UPDATE/DELETE. Żeby jednak dało się
-- wyrazić cykl „przyznane -> cofnięte -> przyznane ponownie”, klucz
-- unikalności księgi musi zawierać numer rewizji — bez tego partial unique
-- index dopuszczałby tylko jedno zdarzenie na parę (akcja, encja) i drugie
-- przyznanie byłoby niezapisywalne.

-- ---------------------------------------------------------------------------
-- 1. Typy
-- ---------------------------------------------------------------------------

-- Rodzaj nagrody śledzonej przez play_reward_states. `play_points` to punkty
-- za sam fakt zapisania partii (action_type 'play_logged'), `achievement` to
-- odznaka wraz z jej punktami.
create type public.reward_type as enum ('play_points', 'achievement');

-- Domena danych, z których wynika nagroda. Używana dwojako: jako domena
-- główna odznaki (grupowanie/prezentacja) oraz jako element zbioru
-- zależności (co trzeba przeliczyć, gdy zmienią się dane danej domeny).
create type public.reward_domain as enum (
  'play',
  'meeting',
  'collection',
  'rating',
  'manual',
  'other'
);

create type public.achievement_history_action as enum (
  'granted',
  'revoked',
  'regranted'
);

-- ---------------------------------------------------------------------------
-- 2. Wersjonowanie księgi punktowej
-- ---------------------------------------------------------------------------

-- Numer rewizji nagrody, do której odnosi się zdarzenie. 0 = pierwsze
-- przyznanie, 1 = kompensata, 2 = ponowne przyznanie, itd. Wszystkie
-- istniejące wiersze dostają 0, więc dotychczasowa semantyka idempotencji
-- (jedno zdarzenie na nagrodę) zostaje zachowana bez zmiany zachowania.
alter table public.point_events
  add column reward_revision integer not null default 0
    check (reward_revision >= 0);

drop index public.point_events_once_per_related_idx;

-- Ten sam warunek częściowy co poprzednio, rozszerzony o reward_revision.
-- Dzięki temu ponowne przyznanie tej samej nagrody po kompensacie jest
-- możliwe (inna rewizja), a podwójne zapisanie tej samej rewizji nadal
-- niemożliwe. Prefiks (user_id, action_type, related_entity_type,
-- related_entity_id) obsługuje też sumowanie punktów jednej nagrody.
create unique index point_events_once_per_related_revision_idx
  on public.point_events (
    user_id,
    action_type,
    related_entity_type,
    related_entity_id,
    reward_revision
  )
  where related_entity_type is not null
    and related_entity_id is not null
    and action_type <> 'admin_adjustment';

-- ---------------------------------------------------------------------------
-- 3. Klasyfikacja domenowa odznak
-- ---------------------------------------------------------------------------

-- Domena główna: do czego nagroda „należy” semantycznie. Wypełniana danymi
-- w M2; domyślne 'other' jest bezpieczne, bo zakres przeliczania wynika z
-- tabeli zależności poniżej, a nie z tej kolumny.
alter table public.achievement_definitions
  add column reward_domain public.reward_domain not null default 'other';

-- Zbiór domen, od których faktycznie zależy warunek odznaki. Rozdzielony od
-- domeny głównej, bo jedno pole by tego nie wyraziło: `camp_host` należy
-- semantycznie do spotkań, ale jego licznik przestaje być spełniony po
-- skasowaniu ostatniej partii przypiętej do spotkania — zależy więc również
-- od partii. Zakres przeliczania po zmianie partii to dokładnie
-- {klucz : 'play' należy do jego zależności}, bez żadnych wyjątków w kodzie.
create table public.achievement_domain_dependencies (
  achievement_key text not null
    references public.achievement_definitions (achievement_key) on delete cascade,
  domain public.reward_domain not null,
  primary key (achievement_key, domain)
);

create index achievement_domain_dependencies_domain_idx
  on public.achievement_domain_dependencies (domain);

-- ---------------------------------------------------------------------------
-- 4. Deklaratywny stan nagród pochodzących z partii
-- ---------------------------------------------------------------------------

-- Aktualny stan każdej nagrody, która kiedykolwiek była aktywna.
--
-- Niezmienniki (egzekwowane przez private.apply_reward_delta w M5 i pokryte
-- testami pgTAP):
--   * BRAK WIERSZA oznacza, że nagroda nigdy nie była aktywna. Nie tworzymy
--     wierszy is_active = false „na zapas” dla niezdobytych nagród.
--   * pierwsze przyznanie => revision = 0,
--   * każdy późniejszy flip stanu => revision + 1,
--   * dla nagrody o wartości > 0 liczba zdarzeń w point_events tej nagrody
--     wynosi dokładnie revision + 1.
--
-- reward_key: dla 'play_points' to plays.id jako tekst, dla 'achievement' to
-- achievement_definitions.achievement_key. Celowo text, a nie dwie osobne
-- kolumny z FK — obie przestrzenie kluczy są rozłączne dzięki reward_type, a
-- jednolity kształt upraszcza pętlę recompute.
create table public.play_reward_states (
  user_id uuid not null references public.profiles (id) on delete restrict,
  reward_type public.reward_type not null,
  reward_key text not null check (length(btrim(reward_key)) > 0),
  is_active boolean not null,
  revision integer not null default 0 check (revision >= 0),
  -- Partia, która wywołała ostatnią zmianę stanu. Diagnostyka, nie klucz:
  -- on delete set null, bo usunięcie partii nie może kasować stanu nagrody.
  last_play_id uuid references public.plays (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, reward_type, reward_key)
);

-- Pętla recompute pyta o aktualnie aktywne nagrody danego rodzaju.
create index play_reward_states_active_idx
  on public.play_reward_states (user_id, reward_type)
  where is_active;

create index play_reward_states_play_idx
  on public.play_reward_states (last_play_id)
  where last_play_id is not null;

create trigger z_play_reward_states_updated_at
before update on public.play_reward_states
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Historia zmian odznak
-- ---------------------------------------------------------------------------

-- Osobna tabela, a nie public.audit_log: private.audit_admin_change() wychodzi
-- wcześniej dla nie-adminów, więc zmiany wywołane edycją partii przez zwykłego
-- członka nie zostawiłyby tam żadnego śladu. Odebranie odznaki musi być
-- audytowalne niezależnie od roli osoby, która je wywołała.
create table public.achievement_history (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  achievement_key text not null
    references public.achievement_definitions (achievement_key),
  action public.achievement_history_action not null,
  revision integer not null check (revision >= 0),
  reason text not null check (length(btrim(reason)) > 0),
  -- Partia, której zmiana wywołała przeliczenie. CELOWO BEZ KLUCZA OBCEGO:
  -- tabela jest append-only, więc kaskada „on delete set null” próbowałaby
  -- wykonać UPDATE i zostałaby odrzucona przez trigger — usunięcie partii,
  -- która kiedykolwiek zmieniła odznakę, stałoby się niemożliwe. Ślad ma
  -- przetrwać usunięcie partii, dlatego trzymamy samo id, tym samym wzorcem
  -- co point_events.related_entity_id.
  triggered_by_play_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete restrict
);

create index achievement_history_user_idx
  on public.achievement_history (user_id, created_at desc);

create index achievement_history_play_idx
  on public.achievement_history (triggered_by_play_id);

-- Historia jest niemodyfikowalna dokładnie tak samo jak point_events.
create trigger achievement_history_append_only
before update or delete on public.achievement_history
for each row execute function private.prevent_append_only_mutation();

-- ---------------------------------------------------------------------------
-- 6. RLS i uprawnienia
-- ---------------------------------------------------------------------------

alter table public.achievement_domain_dependencies enable row level security;
alter table public.play_reward_states enable row level security;
alter table public.achievement_history enable row level security;

-- Dane referencyjne — ten sam wzorzec co class_requirements: widoczne dla
-- aktywnych członków, zarządzane wyłącznie przez admina.
create policy achievement_domain_dependencies_select_visible
on public.achievement_domain_dependencies for select
using (
  private.is_admin()
  or private.is_active_member()
);

create policy achievement_domain_dependencies_manage_admin
on public.achievement_domain_dependencies for all
using (private.is_admin())
with check (private.is_admin());

-- Stan nagród i historia: ten sam wzorzec co user_achievements — odczyt
-- własnych wierszy (oraz wszystkich dla admina), zapis wyłącznie przez
-- funkcje security definer. Świadomie NIE tworzymy polityk insert/update/
-- delete: brak polityki oznacza, że dla `authenticated` operacja jest
-- niemożliwa niezależnie od grantów.
create policy play_reward_states_select_own
on public.play_reward_states for select
using (
  private.is_admin()
  or (private.is_active_member() and user_id = auth.uid())
);

create policy achievement_history_select_own
on public.achievement_history for select
using (
  private.is_admin()
  or (private.is_active_member() and user_id = auth.uid())
);

grant select, insert, update, delete
  on public.achievement_domain_dependencies to authenticated;

-- Wyłącznie select: żadna ścieżka klienta nie może dopisać ani skasować stanu
-- nagrody czy wpisu historii.
grant select on public.play_reward_states to authenticated;
grant select on public.achievement_history to authenticated;
