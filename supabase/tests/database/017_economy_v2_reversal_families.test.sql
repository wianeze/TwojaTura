begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

-- Pokrywa 20260810120500_economy_v2_reversal_rebase_fix.sql.
--
-- BŁĄD, KTÓRY TU PILNUJEMY. public.delete_meeting przy miękkim usunięciu
-- spotkania dopisuje kompensatę pod prefiksem `reversal:` na TEJ SAMEJ encji:
--
--     meeting_rsvp           +10   ('meeting', X)
--     reversal:meeting_rsvp  -10   ('meeting', X)
--
-- Saldo historyczne = 0. Plan Economy V2 liczył jednak stan bieżący po jednym
-- action_type, widział „+10”, wartość docelową 0 i dopisywał trzecie zdarzenie
-- -10. Saldo schodziło do -10: kara za to, że nagrodę wcześniej PRAWIDŁOWO
-- cofnięto.
--
-- Konwencja jak w 016: MUTACJE jako zalogowany członek tam, gdzie idą przez
-- RPC; ASERCJE jako superuser.
--
-- Fixture'y z seed.sql: ...0001 Przemek admin, ...0003 Michał member.

create temporary table t_ids (name text primary key, id uuid);

-- ---------------------------------------------------------------------------
-- Fixture: historia sprzed Economy V2
-- ---------------------------------------------------------------------------
--
--   M1 — spotkanie USUNIĘTE, z parami RSVP i głosu (scenariusze A, B)
--   M2 — spotkanie USUNIĘTE, z parą meeting_created (scenariusz C)
--   M3 — spotkanie CZYNNE, z historyczną parą RSVP i aktualną odpowiedzią
--        (scenariusz E)

insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at, deleted_at, deleted_by
)
values
  (
    'f0000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Wieczór odwołany', 'planned',
    now() - interval '20 days', now() - interval '20 days' + interval '4 hours',
    now() - interval '19 days', '10000000-0000-0000-0000-000000000003'
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'Drugi wieczór odwołany', 'planned',
    now() - interval '18 days', now() - interval '18 days' + interval '4 hours',
    now() - interval '17 days', '10000000-0000-0000-0000-000000000003'
  ),
  (
    'f0000000-0000-4000-8000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'Wieczór, który się trzyma', 'planned',
    now() + interval '9 days', now() + interval '9 days 4 hours',
    null, null
  );

insert into public.meeting_availability (meeting_id, user_id, is_available)
values (
  'f0000000-0000-4000-8000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  true
);

insert into public.point_events (
  user_id, points, action_type, description,
  related_entity_type, related_entity_id, created_by
)
values
  -- A: nagroda i jej kompensata
  ('10000000-0000-0000-0000-000000000003', 10, 'meeting_rsvp', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', -10, 'reversal:meeting_rsvp', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003'),
  -- B
  ('10000000-0000-0000-0000-000000000003', 10, 'meeting_vote', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', -10, 'reversal:meeting_vote', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003'),
  -- C
  ('10000000-0000-0000-0000-000000000003', 25, 'meeting_created', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', -25, 'reversal:meeting_created', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000003'),
  -- D: drugi komplet RSVP na innym usuniętym spotkaniu
  ('10000000-0000-0000-0000-000000000003', 10, 'meeting_rsvp', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', -10, 'reversal:meeting_rsvp', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000003'),
  -- E: nagroda, która NADAL się kwalifikuje, ale ma za sobą cykl award/reversal
  ('10000000-0000-0000-0000-000000000003', 10, 'meeting_rsvp', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', -10, 'reversal:meeting_rsvp', 'legacy',
   'meeting', 'f0000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000003'),
  -- F: jawna korekta administratora — poza automatycznym rebase
  ('10000000-0000-0000-0000-000000000003', 25, 'admin_award:meeting_created', null,
   'admin_point_adjustment', 'f1000000-0000-4000-8000-000000000001',
   '10000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- 1. Plan nie widzi już fałszywej różnicy
-- ---------------------------------------------------------------------------
--
-- Sedno poprawki: dla pary (+nagroda, -kompensata) saldo rodziny wynosi 0,
-- wartość docelowa też 0, więc plan NIE MA tu nic do zrobienia. Przed
-- poprawką powstawał wiersz z deltą -10 / -25.

select is_empty(
  $q$
    select action_type, entity_id
    from private.economy_v2_reward_plan()
    where user_id = '10000000-0000-0000-0000-000000000003'
      and entity_id = 'f0000000-0000-4000-8000-000000000001'
      and action_type = 'meeting_rsvp'
  $q$,
  'A1. zneutralizowana para RSVP nie generuje wiersza planu'
);

select is_empty(
  $q$
    select action_type, entity_id
    from private.economy_v2_reward_plan()
    where user_id = '10000000-0000-0000-0000-000000000003'
      and entity_id = 'f0000000-0000-4000-8000-000000000001'
      and action_type = 'meeting_vote'
  $q$,
  'B1. zneutralizowana para głosu nie generuje wiersza planu'
);

select is_empty(
  $q$
    select action_type, entity_id
    from private.economy_v2_reward_plan()
    where user_id = '10000000-0000-0000-0000-000000000003'
      and entity_id = 'f0000000-0000-4000-8000-000000000002'
      and action_type = 'meeting_created'
  $q$,
  'C1. zneutralizowana para meeting_created nie generuje wiersza planu'
);

-- E: tu plan MUSI zadziałać — nagroda nadal się kwalifikuje, a saldo rodziny
-- wynosi 0, więc do wartości docelowej brakuje pełnych 2 Renomy.
select results_eq(
  $q$
    select target_points, current_points, delta
    from private.economy_v2_reward_plan()
    where user_id = '10000000-0000-0000-0000-000000000003'
      and entity_id = 'f0000000-0000-4000-8000-000000000003'
      and action_type = 'meeting_rsvp'
  $q$,
  $q$values (2, 0, 2)$q$,
  'E1. nagroda nadal kwalifikująca się celuje w wartość V2, licząc od salda rodziny'
);

-- ---------------------------------------------------------------------------
-- 2. PODGLĄD pozostaje bezpieczny
-- ---------------------------------------------------------------------------

create temporary table t_ledger_before as
select count(*)::bigint as event_count, coalesce(sum(points), 0)::bigint as total_points
from public.point_events;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

create temporary table t_preview as
select * from public.preview_economy_v2_rebase();

reset role;

select results_eq(
  $q$
    select count(*)::bigint, coalesce(sum(points), 0)::bigint
    from public.point_events
  $q$,
  $q$select event_count, total_points from t_ledger_before$q$,
  'G. podgląd nie zapisuje ani jednego zdarzenia punktowego'
);

-- ---------------------------------------------------------------------------
-- 3. APPLY
-- ---------------------------------------------------------------------------

select private.apply_economy_v2_rebase();

-- A/B/C: saldo rodziny zostaje na zerze — bez osieroconego minusa.
select results_eq(
  $q$
    select
      private.reward_family_net(
        '10000000-0000-0000-0000-000000000003', 'meeting_rsvp',
        'meeting', 'f0000000-0000-4000-8000-000000000001'
      ),
      private.reward_family_net(
        '10000000-0000-0000-0000-000000000003', 'meeting_vote',
        'meeting', 'f0000000-0000-4000-8000-000000000001'
      ),
      private.reward_family_net(
        '10000000-0000-0000-0000-000000000003', 'meeting_created',
        'meeting', 'f0000000-0000-4000-8000-000000000002'
      )
  $q$,
  $q$values (0, 0, 0)$q$,
  'A2/B2/C2. wpływ zneutralizowanych par wynosi 0, a nie -10 / -10 / -25'
);

-- D: wiele nagród i wiele kompensat tego samego typu — nigdzie nie zostaje
-- osierocone ujemne saldo.
select is_empty(
  $q$
    select family.user_id, family.action_type, family.entity_id
    from (
      select
        event.user_id,
        substr(event.action_type, length('reversal:') + 1) as action_type,
        event.related_entity_id as entity_id,
        event.related_entity_type as entity_type
      from public.point_events as event
      where event.action_type like 'reversal:%'
      group by 1, 2, 3, 4
    ) as family
    where private.reward_family_net(
      family.user_id, family.action_type, family.entity_type, family.entity_id
    ) < 0
  $q$,
  'D. żadna rodzina z historyczną kompensatą nie ma ujemnego salda'
);

select is(
  (
    select private.reward_family_net(
      '10000000-0000-0000-0000-000000000003', 'meeting_rsvp',
      'meeting', 'f0000000-0000-4000-8000-000000000002'
    )
  ),
  0,
  'D2. druga para RSVP na innym spotkaniu również wychodzi na zero'
);

-- E: wartość końcowa to wyłącznie właściwy target Economy V2.
select is(
  (
    select private.reward_family_net(
      '10000000-0000-0000-0000-000000000003', 'meeting_rsvp',
      'meeting', 'f0000000-0000-4000-8000-000000000003'
    )
  ),
  2,
  'E2. nagroda z historycznym cyklem kończy dokładnie na wartości V2'
);

-- F: jawna korekta administratora nietknięta.
select results_eq(
  $q$
    select points, action_type
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000003'
      and related_entity_id = 'f1000000-0000-4000-8000-000000000001'
  $q$,
  $q$values (25, 'admin_award:meeting_created')$q$,
  'F. admin_award pozostaje nietknięty przez rebase'
);

-- H: podgląd przewidział dokładnie to, co się wydarzyło.
select is_empty(
  $q$
    select preview.user_id
    from t_preview as preview
    where preview.projected_balance_after <> coalesce((
      select sum(event.points)
      from public.point_events as event
      where event.user_id = preview.user_id
    ), 0)
  $q$,
  'H. projected_balance_after z podglądu równa się saldu po APPLY'
);

-- J: historia nietknięta — wszystkie wiersze legacy nadal w księdze.
select results_eq(
  $q$
    select count(*)::bigint
    from public.point_events
    where description = 'legacy'
      and user_id = '10000000-0000-0000-0000-000000000003'
  $q$,
  $q$values (10::bigint)$q$,
  'J. wszystkie historyczne nagrody i kompensaty nadal istnieją w księdze'
);

-- ---------------------------------------------------------------------------
-- 4. Powtarzalność
-- ---------------------------------------------------------------------------

create temporary table t_after_first as
select
  membership.user_id,
  coalesce((
    select sum(event.points)
    from public.point_events as event
    where event.user_id = membership.user_id
  ), 0)::bigint as balance,
  (
    select count(*)::bigint
    from public.point_events as event
    where event.user_id = membership.user_id
  ) as event_count
from public.app_members as membership
where membership.is_active;

select private.apply_economy_v2_rebase();

select is_empty(
  $q$
    select snapshot.user_id
    from t_after_first as snapshot
    where snapshot.balance <> coalesce((
        select sum(event.points)
        from public.point_events as event
        where event.user_id = snapshot.user_id
      ), 0)
      or snapshot.event_count <> (
        select count(*)
        from public.point_events as event
        where event.user_id = snapshot.user_id
      )
  $q$,
  'I. drugi APPLY nie zmienia ani salda, ani liczby zdarzeń'
);

-- ---------------------------------------------------------------------------
-- 5. Breakdown
-- ---------------------------------------------------------------------------

-- Kompensata trafia do kubełka swojego typu, nie do „other”.
select results_eq(
  $q$
    select
      private.economy_bucket('reversal:meeting_rsvp'),
      private.economy_bucket('reversal:meeting_vote'),
      private.economy_bucket('reversal:meeting_created'),
      private.economy_bucket('reversal:meeting_hosted')
  $q$,
  $q$values ('meeting_rsvp', 'meeting_vote', 'meeting_hosted', 'meeting_hosted')$q$,
  'Breakdown 1. reversal:<typ> raportuje się w kubełku swojego typu'
);

-- Prefiks administratora nie jest kompensatą rodziny — ma własny kubełek.
select results_eq(
  $q$
    select
      private.economy_bucket('admin_reversal:meeting_created'),
      private.economy_bucket('admin_award:play_logged')
  $q$,
  $q$values ('admin_adjustments', 'admin_adjustments')$q$,
  'Breakdown 2. admin_reversal nie wpada do rodziny reversal'
);

-- „other” nie trzyma już osieroconych kompensat objętych Economy V2.
select is_empty(
  $q$
    select event.action_type
    from public.point_events as event
    where event.action_type like 'reversal:%'
      and private.economy_bucket(event.action_type) = 'other'
  $q$,
  'Breakdown 3. żadna kompensata Economy V2 nie ląduje w kubełku other'
);

reset role;
select * from finish();
rollback;
