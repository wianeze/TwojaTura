begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

-- Pokrywa 20260806090000_meeting_invitations.sql: organizator sam wybiera
-- zapraszanych zamiast automatycznego zaproszenia wszystkich.
--
-- Konwencja jak w 007_push_notifications.test.sql: MUTACJE jako zalogowany
-- członek (przez realne RPC), ASERCJE jako superuser (RLS nie chowa cudzych
-- wierszy).
--
-- Fixture'y z seed.sql:
--   ...0001 Przemek     admin,  active
--   ...0002 Marta       member, active  -> organizator we wszystkich testach
--   ...0003 Michał      member, active
--   ...0004 Ania        member, active
--   ...0005 Kuba        member, active
--   ...0006 Nieaktywny  member, INACTIVE

-- Michał i Ania mają aktywne subskrypcje, żeby dało się sprawdzić realną
-- dostawę push-a, nie tylko wiersz zaproszenia.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values
  ('10000000-0000-0000-0000-000000000003', 'https://push.example/michal-inv', 'p', 'a'),
  ('10000000-0000-0000-0000-000000000004', 'https://push.example/ania-inv', 'p', 'a');

-- ---------------------------------------------------------------------------
-- 1. Utworzenie spotkania bez zaproszonych
-- ---------------------------------------------------------------------------

-- Grant jest konieczny: tabelę zakłada bieżąca rola (superuser test-runnera),
-- a DO poniżej wykonuje się jako authenticated (set local role) — bez tego
-- insert/select do własnej tymczasowej tabeli kończy się 42501.
create temporary table t_meeting_1 (id uuid);
grant insert, select on t_meeting_1 to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_id uuid;
    begin
      v_id := public.create_meeting_with_invitations(
        p_title => 'Cichy wieczór',
        p_starts_at => now() + interval '2 days',
        p_ends_at => now() + interval '2 days 3 hours',
        p_invited_user_ids => '{}'::uuid[]);
      insert into t_meeting_1 (id) values (v_id);
    end;
    $body$
  $$,
  '1. organizator tworzy spotkanie bez zaproszonych — poprawny przypadek'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint from public.meeting_invitations
    where meeting_id = (select id from t_meeting_1)
  $$,
  $$values (0::bigint)$$,
  '2. zero zaproszonych oznacza zero wierszy meeting_invitations'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.push_deliveries as delivery
    join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.source_entity_id = (select id from t_meeting_1)
  $$,
  $$values (0::bigint)$$,
  '3. bez zaproszonych nikt nie dostaje powiadomienia — brak fallbacku "wszyscy"'
);

-- ---------------------------------------------------------------------------
-- 2. Zaproszenie jednej osoby
-- ---------------------------------------------------------------------------

create temporary table t_meeting_2 (id uuid);
grant insert, select on t_meeting_2 to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_id uuid;
    begin
      v_id := public.create_meeting_with_invitations(
        p_title => 'Gra we dwóch',
        p_starts_at => now() + interval '3 days',
        p_ends_at => now() + interval '3 days 3 hours',
        p_invited_user_ids => array['10000000-0000-0000-0000-000000000003'::uuid]);
      insert into t_meeting_2 (id) values (v_id);
    end;
    $body$
  $$,
  '4. organizator zaprasza jedną osobę'
);
reset role;

select results_eq(
  $$
    select user_id from public.meeting_invitations
    where meeting_id = (select id from t_meeting_2)
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid)$$,
  '5. dokładnie jeden wiersz zaproszenia, dla właściwej osoby'
);

select results_eq(
  $$
    select delivery.recipient_user_id
    from public.push_deliveries as delivery
    join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.source_entity_id = (select id from t_meeting_2)
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid)$$,
  '6. zaproszony z aktywną subskrypcją dostaje dokładnie jedno powiadomienie'
);

-- ---------------------------------------------------------------------------
-- 3. Zaproszenie kilku osób + 4. brak automatycznego zapraszania pozostałych
-- ---------------------------------------------------------------------------

create temporary table t_meeting_3 (id uuid);
grant insert, select on t_meeting_3 to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_id uuid;
    begin
      v_id := public.create_meeting_with_invitations(
        p_title => 'Turniej planszówek',
        p_starts_at => now() + interval '4 days',
        p_ends_at => now() + interval '4 days 5 hours',
        p_invited_user_ids => array[
          '10000000-0000-0000-0000-000000000003'::uuid,
          '10000000-0000-0000-0000-000000000004'::uuid,
          '10000000-0000-0000-0000-000000000005'::uuid
        ]);
      insert into t_meeting_3 (id) values (v_id);
    end;
    $body$
  $$,
  '7. organizator zaprasza kilka osób naraz'
);
reset role;

select results_eq(
  $$
    select user_id from public.meeting_invitations
    where meeting_id = (select id from t_meeting_3)
    order by user_id
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid),
           ('10000000-0000-0000-0000-000000000004'::uuid),
           ('10000000-0000-0000-0000-000000000005'::uuid)$$,
  '8. dokładnie trzy wiersze zaproszeń, dla właściwych osób'
);

select ok(
  (
    select count(*) = 0
    from public.meeting_invitations
    where meeting_id = (select id from t_meeting_3)
      and user_id in (
        '10000000-0000-0000-0000-000000000001', -- admin
        '10000000-0000-0000-0000-000000000006'  -- nieaktywny
      )
  ),
  '9. admin i nieaktywny członek NIE są automatycznie zaproszeni'
);

-- ---------------------------------------------------------------------------
-- 6. Odrzucenie nieprawidłowych lub zduplikowanych ID
-- ---------------------------------------------------------------------------

create temporary table t_meeting_4 (id uuid);
grant insert, select on t_meeting_4 to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_id uuid;
    begin
      -- Michał podwójnie, admin, nieaktywny, losowe obce ID i sama
      -- organizatorka (próba samo-zaproszenia) — żadne z nich nie może
      -- zablokować zapisu ani trafić na listę zaproszonych.
      v_id := public.create_meeting_with_invitations(
        p_title => 'Wieczór z niepewną listą',
        p_starts_at => now() + interval '5 days',
        p_ends_at => now() + interval '5 days 3 hours',
        p_invited_user_ids => array[
          '10000000-0000-0000-0000-000000000003'::uuid,
          '10000000-0000-0000-0000-000000000003'::uuid,
          '10000000-0000-0000-0000-000000000001'::uuid,
          '10000000-0000-0000-0000-000000000006'::uuid,
          'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
          '10000000-0000-0000-0000-000000000002'::uuid
        ]);
      insert into t_meeting_4 (id) values (v_id);
    end;
    $body$
  $$,
  '10. nieprawidłowe/zduplikowane ID nie blokują utworzenia spotkania'
);
reset role;

select results_eq(
  $$
    select user_id from public.meeting_invitations
    where meeting_id = (select id from t_meeting_4)
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid)$$,
  '11. po odsianiu zostaje wyłącznie Michał — duplikat, admin, nieaktywny, obce ID i organizator odpadają'
);

-- ---------------------------------------------------------------------------
-- 5. Edycja listy zaproszonych
-- ---------------------------------------------------------------------------

create temporary table t_meeting_5 (id uuid);
grant insert, select on t_meeting_5 to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_id uuid;
    begin
      v_id := public.create_meeting_with_invitations(
        p_title => 'Spotkanie do edycji',
        p_starts_at => now() + interval '6 days',
        p_ends_at => now() + interval '6 days 3 hours',
        p_invited_user_ids => array['10000000-0000-0000-0000-000000000003'::uuid]);
      insert into t_meeting_5 (id) values (v_id);
    end;
    $body$
  $$,
  '12. przygotowanie: spotkanie z jednym zaproszonym (Michał)'
);
reset role;

-- Michał odpowiada na RSVP, zanim zostanie usunięty z zaproszonych — ma to
-- przetrwać edycję (integralność danych, RSVP nie jest wyłącznie pochodną
-- zaproszenia). Musi zadziać się jako Michał, nie jako organizator z testu 12
-- — meeting_availability_insert_own wymaga user_id = auth.uid().
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into public.meeting_availability (meeting_id, user_id, is_available)
    values ((select id from t_meeting_5), '10000000-0000-0000-0000-000000000003', true)
  $$,
  '13. Michał zgłasza dostępność, zanim jego zaproszenie zostanie cofnięte'
);
reset role;

-- Dodanie Ani.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_meeting_5),
      p_title => 'Spotkanie do edycji',
      p_starts_at => now() + interval '6 days',
      p_ends_at => now() + interval '6 days 3 hours',
      p_invited_user_ids => array[
        '10000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000004'::uuid
      ])
  $$,
  '14. edycja dodaje Anię do zaproszonych'
);
reset role;

select results_eq(
  $$
    select user_id from public.meeting_invitations
    where meeting_id = (select id from t_meeting_5)
    order by user_id
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid),
           ('10000000-0000-0000-0000-000000000004'::uuid)$$,
  '15. po edycji zaproszeni to Michał (bez zmian) i nowo dodana Ania'
);

select ok(
  (
    select count(*) = 1
    from public.push_deliveries as delivery
    join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.dedupe_key
      = 'meeting_invited:' || (select id from t_meeting_5)::text
        || ':10000000-0000-0000-0000-000000000004'
  ),
  '16. tylko nowo dodana Ania dostaje powiadomienie o zaproszeniu'
);

select ok(
  (
    select not exists (
      select 1
      from public.push_campaigns
      where dedupe_key
        = 'meeting_invited:' || (select id from t_meeting_5)::text
          || ':10000000-0000-0000-0000-000000000003'
    )
  ),
  '17. Michał (bez zmian w zaproszeniu) nie dostaje kolejnego powiadomienia'
);

-- Usunięcie Michała.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_meeting_5),
      p_title => 'Spotkanie do edycji',
      p_starts_at => now() + interval '6 days',
      p_ends_at => now() + interval '6 days 3 hours',
      p_invited_user_ids => array['10000000-0000-0000-0000-000000000004'::uuid])
  $$,
  '18. edycja usuwa Michała z zaproszonych'
);
reset role;

select results_eq(
  $$
    select user_id from public.meeting_invitations
    where meeting_id = (select id from t_meeting_5)
  $$,
  $$values ('10000000-0000-0000-0000-000000000004'::uuid)$$,
  '19. po usunięciu zostaje wyłącznie Ania'
);

select results_eq(
  $$
    select is_available from public.meeting_availability
    where meeting_id = (select id from t_meeting_5)
      and user_id = '10000000-0000-0000-0000-000000000003'
  $$,
  $$values (true)$$,
  '20. usunięcie zaproszenia NIE kasuje wcześniejszej odpowiedzi RSVP Michała'
);

-- Organizator nie może zostać dopisany do własnych zaproszonych, nawet jeśli
-- poda swoje ID w edycji.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_meeting_5),
      p_title => 'Spotkanie do edycji',
      p_starts_at => now() + interval '6 days',
      p_ends_at => now() + interval '6 days 3 hours',
      p_invited_user_ids => array[
        '10000000-0000-0000-0000-000000000004'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid
      ])
  $$,
  '21. edycja z własnym ID organizatora w liście nie rzuca'
);
reset role;

select ok(
  (
    select not exists (
      select 1 from public.meeting_invitations
      where meeting_id = (select id from t_meeting_5)
        and user_id = '10000000-0000-0000-0000-000000000002'
    )
  ),
  '22. organizator nadal nie jest wierszem we własnych zaproszonych'
);

-- ---------------------------------------------------------------------------
-- Uprawnienia edycji
-- ---------------------------------------------------------------------------

-- Michał (nie organizator, nie admin) nie może edytować zaproszonych.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_meeting_5),
      p_title => 'Spotkanie do edycji',
      p_starts_at => now() + interval '6 days',
      p_ends_at => now() + interval '6 days 3 hours',
      p_invited_user_ids => '{}'::uuid[])
  $$,
  '42501',
  null,
  '23. osoba spoza organizatora/adminów nie może edytować listy zaproszonych'
);
reset role;

select * from finish();
rollback;
