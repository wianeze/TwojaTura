begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_function(
  'public',
  'admin_historical_business_snapshot',
  array[]::text[],
  '1. derived historical snapshot RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_historical_business_snapshot()',
    'EXECUTE'
  ),
  '2. anon cannot execute the derived snapshot RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_historical_business_snapshot()',
    'EXECUTE'
  ),
  '3. authenticated receives only the guarded RPC entry point'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

create temporary table derived_history_baseline (
  snapshot jsonb not null
);

insert into derived_history_baseline (snapshot)
select public.admin_historical_business_snapshot();

insert into public.games (id, owner_id, title, created_at, updated_at)
values (
  '28000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  'Derived History Fixture',
  '2026-08-01 10:00:00+00',
  '2026-08-01 10:00:00+00'
);

insert into public.meetings (
  id, created_by, title, description, starts_at, ends_at, created_at, updated_at
)
values (
  '28100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  'Derived active meeting',
  'DERIVED_SECRET_SENTINEL meeting description',
  '2026-08-02 16:00:00+00',
  '2026-08-02 20:00:00+00',
  '2026-08-01 11:00:00+00',
  '2026-08-01 11:00:00+00'
), (
  '28100000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000006',
  'Derived deleted meeting',
  'DERIVED_SECRET_SENTINEL deleted description',
  '2026-08-03 16:00:00+00',
  '2026-08-03 20:00:00+00',
  '2026-08-01 12:00:00+00',
  '2026-08-01 12:00:00+00'
);

update public.meetings
set
  deleted_at = '2026-08-01 13:00:00+00',
  deleted_by = '10000000-0000-0000-0000-000000000001',
  deleted_reason = 'fixture'
where id = '28100000-0000-4000-8000-000000000002';

insert into public.meeting_availability (
  meeting_id, user_id, is_available, updated_at
)
values (
  '28100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  true,
  '2026-08-01 14:00:00+00'
);

insert into public.meeting_game_proposals (
  meeting_id, game_id, proposed_by, created_at
)
values (
  '28100000-0000-4000-8000-000000000001',
  '28000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  '2026-08-01 15:00:00+00'
);

insert into public.meeting_game_responses (
  meeting_id, game_id, user_id, wants_to_play, created_at
)
values (
  '28100000-0000-4000-8000-000000000001',
  '28000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  true,
  '2026-08-01 15:05:00+00'
);

insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, duration_minutes,
  comment, status, mode, result_pending, rewards_managed,
  created_at, updated_at
)
values (
  '28200000-0000-4000-8000-000000000001',
  '28000000-0000-4000-8000-000000000001',
  '28100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  '2026-08-02 16:15:00+00',
  90,
  'DERIVED_SECRET_SENTINEL play comment',
  'completed',
  'competitive',
  false,
  false,
  '2026-08-02 18:00:00+00',
  '2026-08-02 18:00:00+00'
);

insert into public.play_participants (
  play_id, user_id, placement, is_winner
)
values (
  '28200000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  1,
  true
);

insert into public.ratings (
  id, game_id, user_id, theme, replayability, overall,
  wants_to_play_again, comment, created_at, updated_at
)
values (
  '28300000-0000-4000-8000-000000000001',
  '28000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  8,
  9,
  8,
  true,
  'DERIVED_SECRET_SENTINEL rating comment',
  '2026-08-02 19:00:00+00',
  '2026-08-02 19:00:00+00'
);

insert into public.point_events (
  id, user_id, points, action_type, description, created_by, created_at
)
values (
  '28400000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  17,
  'admin_award:derived_fixture',
  'DERIVED_SECRET_SENTINEL point description',
  '10000000-0000-0000-0000-000000000001',
  '2026-08-02 20:00:00+00'
);

insert into public.user_achievements (
  user_id, achievement_key, awarded_by, note, awarded_at
)
values (
  '10000000-0000-0000-0000-000000000006',
  'critical_roll',
  '10000000-0000-0000-0000-000000000001',
  'DERIVED_SECRET_SENTINEL achievement note',
  '2026-08-02 21:00:00+00'
);

insert into public.game_loans (
  id, game_id, lender_user_id, borrower_user_id, loaned_at, returned_at, note
)
values (
  '28500000-0000-4000-8000-000000000001',
  '28000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000002',
  '2026-08-03 10:00:00+00',
  '2026-08-04 10:00:00+00',
  'DERIVED_SECRET_SENTINEL loan note'
);

insert into public.feedback_submissions (
  id, author_id, content, created_at, updated_at
)
values (
  '28600000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  'DERIVED_SECRET_SENTINEL feedback content',
  '2026-08-04 11:00:00+00',
  '2026-08-04 11:00:00+00'
);

select is(
  public.admin_historical_business_snapshot() ->> 'source',
  'derived',
  '4. snapshot is explicitly marked as derived'
);

select results_eq(
  $$
    with before_snapshot as (
      select snapshot from derived_history_baseline
    ), after_snapshot as (
      select public.admin_historical_business_snapshot() as snapshot
    )
    select
      ((after.snapshot #>> '{kpis,meetings}')::bigint
        - (before.snapshot #>> '{kpis,meetings}')::bigint),
      ((after.snapshot #>> '{kpis,plays}')::bigint
        - (before.snapshot #>> '{kpis,plays}')::bigint),
      ((after.snapshot #>> '{kpis,ratings}')::bigint
        - (before.snapshot #>> '{kpis,ratings}')::bigint),
      ((after.snapshot #>> '{kpis,games}')::bigint
        - (before.snapshot #>> '{kpis,games}')::bigint),
      ((after.snapshot #>> '{kpis,renown_net}')::bigint
        - (before.snapshot #>> '{kpis,renown_net}')::bigint),
      ((after.snapshot #>> '{kpis,achievements}')::bigint
        - (before.snapshot #>> '{kpis,achievements}')::bigint),
      ((after.snapshot #>> '{kpis,loans}')::bigint
        - (before.snapshot #>> '{kpis,loans}')::bigint),
      ((after.snapshot #>> '{kpis,feedback}')::bigint
        - (before.snapshot #>> '{kpis,feedback}')::bigint)
    from before_snapshot as before, after_snapshot as after
  $$,
  $$values (
    1::bigint, 1::bigint, 1::bigint, 1::bigint,
    17::bigint, 1::bigint, 1::bigint, 1::bigint
  )$$,
  '5. business KPI aggregates count the fixture correctly'
);

select is(
  (
    (public.admin_historical_business_snapshot()
      #>> '{quality,excluded_soft_deleted_meetings}')::bigint
    - ((select snapshot from derived_history_baseline)
      #>> '{quality,excluded_soft_deleted_meetings}')::bigint
  ),
  1::bigint,
  '6. soft-deleted meeting is excluded from active meeting KPI and documented'
);

select results_eq(
  $$
    with player as (
      select item
      from jsonb_array_elements(
        public.admin_historical_business_snapshot() -> 'player_activity'
      ) as item
      where item ->> 'user_id' = '10000000-0000-0000-0000-000000000006'
    )
    select
      (item ->> 'meetings_created')::bigint,
      (item ->> 'proposals')::bigint,
      (item ->> 'responses')::bigint,
      (item ->> 'play_participations')::bigint,
      (item ->> 'wins')::bigint,
      (item ->> 'ratings')::bigint,
      (item ->> 'games_added')::bigint,
      (item ->> 'renown_net')::bigint,
      (item ->> 'achievements')::bigint
    from player
  $$,
  $$values (
    1::bigint, 1::bigint, 2::bigint, 1::bigint, 1::bigint,
    1::bigint, 1::bigint, 17::bigint, 1::bigint
  )$$,
  '7. inactive former member remains visible through business aggregates'
);

select results_eq(
  $$
    with game as (
      select item
      from jsonb_array_elements(
        public.admin_historical_business_snapshot() -> 'top_games'
      ) as item
      where item ->> 'game_id' = '28000000-0000-4000-8000-000000000001'
    )
    select
      (item ->> 'plays_count')::bigint,
      (item ->> 'unique_players')::bigint,
      (item ->> 'average_duration_minutes')::integer,
      (item ->> 'ratings_count')::bigint,
      (item ->> 'average_rating')::numeric
    from game
  $$,
  $$values (1::bigint, 1::bigint, 90::integer, 1::bigint, 8.0::numeric)$$,
  '8. top games aggregate play, participant, duration and rating data'
);

select results_eq(
  $$
    with before_snapshot as (
      select snapshot from derived_history_baseline
    ), after_snapshot as (
      select public.admin_historical_business_snapshot() as snapshot
    )
    select
      ((after.snapshot #>> '{response_state,rsvp_total}')::bigint
        - (before.snapshot #>> '{response_state,rsvp_total}')::bigint),
      ((after.snapshot #>> '{response_state,game_responses_total}')::bigint
        - (before.snapshot #>> '{response_state,game_responses_total}')::bigint)
    from before_snapshot as before, after_snapshot as after
  $$,
  $$values (1::bigint, 1::bigint)$$,
  '9. RSVP and game votes are exposed as stored response state'
);

select ok(
  position(
    'DERIVED_SECRET_SENTINEL'
    in public.admin_historical_business_snapshot()::text
  ) = 0,
  '10. snapshot never exposes descriptions, comments, notes or feedback content'
);

set local role authenticated;

select lives_ok(
  $$select public.admin_historical_business_snapshot()$$,
  '11. admin can execute the derived snapshot RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.admin_historical_business_snapshot()$$,
  '42501',
  'Administrator access is required',
  '12. ordinary member cannot execute the derived snapshot RPC'
);

rollback;
