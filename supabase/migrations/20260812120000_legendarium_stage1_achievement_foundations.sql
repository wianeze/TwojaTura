-- Legendarium — Etap 1: naprawa fundamentów achievementów.
--
-- Migracja jest forward-only i NIE uruchamia ani backfillu achievementów, ani
-- historycznego przeliczenia Renomy. Instaluje wspólny plan PREVIEW oraz
-- prywatny, idempotentny operator APPLY do świadomego uruchomienia później.

-- ---------------------------------------------------------------------------
-- 1. Katalog: prawdziwe statusy, warunki i jednolita skala Renomy
-- ---------------------------------------------------------------------------

update public.achievement_definitions
set points = case rarity
  when 'common' then 5
  when 'rare' then 10
  when 'epic' then 20
  when 'legendary' then 35
  when 'secret' then case achievement_key
    when 'the_absolute' then 35
    else 20
  end
end;

update public.achievement_definitions
set automation_status = 'automatic',
    is_manual = false
where achievement_key in (
  'natural_one',
  'dark_urge',
  'party_summoned',
  'persuasion_master',
  'quest_accepted'
);

update public.achievement_definitions
set condition_text = case achievement_key
  when 'party_summoned' then
    'Zorganizuj ukończone spotkanie z kompletem aktywnych graczy kwalifikujących się do grywalizacji.'
  when 'initiative_master' then
    'Zorganizuj 5 spotkań, które faktycznie zostały ukończone.'
  when 'side_quest' then
    'Weź udział w ukończonej partii rozegranej poza spotkaniem.'
  when 'persuasion_master' then
    '10 razy zagłosuj na grę, która została rozegrana na tym samym spotkaniu.'
  when 'quest_accepted' then
    '10 razy zadeklaruj udział w spotkaniu i weź udział w ukończonej partii podczas tego spotkania.'
  else condition_text
end
where achievement_key in (
  'party_summoned', 'initiative_master', 'side_quest',
  'persuasion_master', 'quest_accepted'
);

-- Te badge'e zostają w katalogu i klasach, ale nie mają dziś wiarygodnego,
-- automatycznego źródła danych. Etap 1 nie próbuje zgadywać ich warunków.
update public.achievement_definitions
set automation_status = case when is_secret then 'secret' else 'planned' end,
    is_manual = false
where achievement_key in (
  'redemption_arc', 'chosen_of_the_table', 'dice_speak', 'hot_streak'
);

insert into public.achievement_domain_dependencies (achievement_key, domain)
values
  ('party_summoned', 'meeting'),
  ('party_summoned', 'play'),
  ('initiative_master', 'meeting'),
  ('side_quest', 'play'),
  ('persuasion_master', 'meeting'),
  ('persuasion_master', 'play'),
  ('quest_accepted', 'meeting'),
  ('quest_accepted', 'play')
on conflict do nothing;

update public.achievement_definitions
set reward_domain = case achievement_key
  when 'side_quest' then 'play'::public.reward_domain
  else 'meeting'::public.reward_domain
end
where achievement_key in (
  'party_summoned', 'initiative_master', 'side_quest',
  'persuasion_master', 'quest_accepted'
);

-- ---------------------------------------------------------------------------
-- 2. Kanoniczne predykaty spotkań i nowych warunków
-- ---------------------------------------------------------------------------

create or replace function private.meeting_is_historically_completed(
  p_meeting_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meetings as meeting
    where meeting.id = p_meeting_id
      and meeting.status = 'completed'::public.meeting_status
      and meeting.deleted_at is null
  );
$$;

revoke all on function private.meeting_is_historically_completed(uuid)
  from public, anon, authenticated;

create or replace function private.meeting_has_full_eligible_party(
  p_meeting_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.meeting_is_historically_completed(p_meeting_id)
    and exists (
      select 1
      from public.app_members as membership
      where private.is_gamification_eligible(membership.user_id)
    )
    and not exists (
      select 1
      from public.app_members as membership
      where private.is_gamification_eligible(membership.user_id)
        and not exists (
          select 1
          from public.plays as play
          join public.play_participants as participant
            on participant.play_id = play.id
           and participant.user_id = membership.user_id
          where play.meeting_id = p_meeting_id
            and play.status = 'completed'::public.play_status
        )
    );
$$;

comment on function private.meeting_has_full_eligible_party(uuid) is
  'Ukończone, nieusunięte spotkanie, w którego ukończonych partiach uczestniczył każdy użytkownik spełniający private.is_gamification_eligible. Admin-gracz jest liczony; observer i konto nieaktywne nie blokują kompletu.';

revoke all on function private.meeting_has_full_eligible_party(uuid)
  from public, anon, authenticated;

-- Zachowujemy wszystkie wcześniejsze, sprawdzone predykaty pod prywatną nazwą
-- i nadpisujemy wyłącznie pięć semantyk objętych Etapem 1.
alter function private.qualifies_for_achievement(uuid, text)
  rename to qualifies_for_achievement_before_legendarium_stage1;

create or replace function private.qualifies_for_achievement(
  p_user_id uuid,
  p_achievement_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_achievement_key is null then
    return false;
  end if;

  case p_achievement_key
    when 'party_summoned' then
      return exists (
        select 1
        from public.meetings as meeting
        where meeting.created_by = p_user_id
          and private.meeting_has_full_eligible_party(meeting.id)
      );

    when 'initiative_master' then
      return (
        select count(*)
        from public.meetings as meeting
        where meeting.created_by = p_user_id
          and meeting.status = 'completed'::public.meeting_status
          and meeting.deleted_at is null
      ) >= 5;

    when 'side_quest' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and play.status = 'completed'::public.play_status
          and play.meeting_id is null
      );

    when 'persuasion_master' then
      return (
        select count(*)
        from (
          select response.meeting_id, response.game_id
          from public.meeting_game_responses as response
          where response.user_id = p_user_id
            and response.wants_to_play = true
            and exists (
              select 1
              from public.plays as play
              where play.meeting_id = response.meeting_id
                and play.game_id = response.game_id
                and play.status = 'completed'::public.play_status
            )
          group by response.meeting_id, response.game_id
        ) as matched_votes
      ) >= 10;

    when 'quest_accepted' then
      return (
        select count(distinct availability.meeting_id)
        from public.meeting_availability as availability
        where availability.user_id = p_user_id
          and availability.is_available = true
          and exists (
            select 1
            from public.plays as play
            join public.play_participants as participant
              on participant.play_id = play.id
             and participant.user_id = p_user_id
            where play.meeting_id = availability.meeting_id
              and play.status = 'completed'::public.play_status
          )
      ) >= 10;

    else
      return private.qualifies_for_achievement_before_legendarium_stage1(
        p_user_id,
        p_achievement_key
      );
  end case;
end;
$$;

revoke all on function private.qualifies_for_achievement(uuid, text)
  from public, anon, authenticated;
revoke all on function private.qualifies_for_achievement_before_legendarium_stage1(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Recompute po zmianach partii i po domknięciu spotkania
-- ---------------------------------------------------------------------------

create or replace function private.recompute_legendarium_stage1_achievements(
  p_play_id uuid default null,
  p_reason text default 'legendarium_stage1_recompute'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_achievement_key text;
  v_changes integer := 0;
begin
  for v_user_id in
    select membership.user_id
    from public.app_members as membership
    where private.is_gamification_eligible(membership.user_id)
    order by membership.user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

    foreach v_achievement_key in array array[
      'natural_one', 'dark_urge', 'party_summoned', 'initiative_master',
      'side_quest', 'persuasion_master', 'quest_accepted'
    ]::text[]
    loop
      if private.apply_reward_delta(
        v_user_id,
        'achievement',
        v_achievement_key,
        private.qualifies_for_achievement(v_user_id, v_achievement_key),
        p_play_id,
        p_reason
      ) then
        v_changes := v_changes + 1;
      end if;
    end loop;
  end loop;

  return v_changes;
end;
$$;

revoke all on function private.recompute_legendarium_stage1_achievements(uuid, text)
  from public, anon, authenticated;

alter function private.recompute_play_rewards(uuid[], uuid, text)
  rename to recompute_play_rewards_before_legendarium_stage1;

create or replace function private.recompute_play_rewards(
  p_user_ids uuid[],
  p_play_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes integer;
begin
  -- Najpierw blokujemy pełny, uporządkowany zbiór użytkowników Etapu 1.
  -- Dopiero potem stary recompute bierze (reentrant) blokady podzbioru. Dzięki
  -- temu dwa równoległe zapisy różnych partii nie mogą utworzyć cyklu blokad.
  v_changes := private.recompute_legendarium_stage1_achievements(
    p_play_id,
    p_reason
  );

  return v_changes + private.recompute_play_rewards_before_legendarium_stage1(
    p_user_ids,
    p_play_id,
    p_reason
  );
end;
$$;

revoke all on function private.recompute_play_rewards(uuid[], uuid, text)
  from public, anon, authenticated;
revoke all on function private.recompute_play_rewards_before_legendarium_stage1(uuid[], uuid, text)
  from public, anon, authenticated;

alter function public.complete_meeting(uuid)
  rename to complete_meeting_before_legendarium_stage1;

alter function public.complete_meeting_before_legendarium_stage1(uuid)
  set schema private;

revoke all on function private.complete_meeting_before_legendarium_stage1(uuid)
  from public, anon, authenticated;

create or replace function public.complete_meeting(p_meeting_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed boolean;
begin
  v_changed := private.complete_meeting_before_legendarium_stage1(p_meeting_id);

  perform private.recompute_legendarium_stage1_achievements(
    null,
    'meeting_completed:' || p_meeting_id::text
  );

  return v_changed;
end;
$$;

revoke all on function public.complete_meeting(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_meeting(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Jeden read-only plan dla backfillu i historycznej Renomy
-- ---------------------------------------------------------------------------

create or replace function private.legendarium_stage1_reconciliation_plan()
returns table (
  user_id uuid,
  achievement_key text,
  current_unlocked boolean,
  target_unlocked boolean,
  current_points integer,
  target_points integer,
  delta integer
)
language sql
stable
security definer
set search_path = ''
as $$
with candidates as (
  select membership.user_id, definition.achievement_key, definition.points
  from public.app_members as membership
  cross join public.achievement_definitions as definition
  where definition.is_active = true
    and (
      private.is_gamification_eligible(membership.user_id)
      or exists (
        select 1
        from public.user_achievements as earned
        where earned.user_id = membership.user_id
          and earned.achievement_key = definition.achievement_key
      )
      or exists (
        select 1
        from public.point_events as event
        where event.user_id = membership.user_id
          and event.action_type = 'achievement_unlocked:' || definition.achievement_key
          and event.related_entity_type = 'profile'
          and event.related_entity_id = membership.user_id
      )
    )
), states as (
  select
    candidate.*,
    exists (
      select 1
      from public.user_achievements as earned
      where earned.user_id = candidate.user_id
        and earned.achievement_key = candidate.achievement_key
    ) as current_unlocked,
    case
      when private.is_gamification_eligible(candidate.user_id)
       and candidate.achievement_key in (
        'natural_one', 'dark_urge', 'party_summoned', 'initiative_master',
        'side_quest', 'persuasion_master', 'quest_accepted'
      ) then private.qualifies_for_achievement(
        candidate.user_id,
        candidate.achievement_key
      )
      else exists (
        select 1
        from public.user_achievements as earned
        where earned.user_id = candidate.user_id
          and earned.achievement_key = candidate.achievement_key
      )
    end as target_unlocked,
    private.reward_ledger_net(
      candidate.user_id,
      'achievement',
      candidate.achievement_key
    ) as current_points
  from candidates as candidate
)
select
  states.user_id,
  states.achievement_key,
  states.current_unlocked,
  states.target_unlocked,
  states.current_points,
  case when states.target_unlocked then states.points else 0 end as target_points,
  (case when states.target_unlocked then states.points else 0 end)
    - states.current_points as delta
from states;
$$;

revoke all on function private.legendarium_stage1_reconciliation_plan()
  from public, anon, authenticated;

create or replace function public.preview_legendarium_stage1_reconciliation()
returns table (
  user_id uuid,
  display_name text,
  achievements_to_unlock integer,
  achievements_to_revoke integer,
  current_achievement_renown bigint,
  projected_achievement_renown bigint,
  renown_delta bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.display_name,
    count(*) filter (
      where not plan.current_unlocked and plan.target_unlocked
    )::integer,
    count(*) filter (
      where plan.current_unlocked and not plan.target_unlocked
    )::integer,
    coalesce(sum(plan.current_points), 0)::bigint,
    coalesce(sum(plan.target_points), 0)::bigint,
    coalesce(sum(plan.delta), 0)::bigint
  from public.profiles as profile
  join private.legendarium_stage1_reconciliation_plan() as plan
    on plan.user_id = profile.id
  group by profile.id, profile.display_name
  order by profile.display_name, profile.id;
end;
$$;

revoke all on function public.preview_legendarium_stage1_reconciliation()
  from public, anon, authenticated;
grant execute on function public.preview_legendarium_stage1_reconciliation()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Prywatny APPLY: append-only, bez automatycznego uruchomienia
-- ---------------------------------------------------------------------------

create or replace function private.reconcile_achievement_renown(
  p_user_id uuid,
  p_achievement_key text,
  p_target_points integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_delta integer;
  v_revision integer;
  v_actor uuid := coalesce(auth.uid(), p_user_id);
begin
  v_current := private.reward_ledger_net(
    p_user_id,
    'achievement',
    p_achievement_key
  );
  v_delta := p_target_points - v_current;

  if v_delta = 0 then
    return false;
  end if;

  select coalesce(max(event.reward_revision), -1) + 1
  into v_revision
  from public.point_events as event
  where event.user_id = p_user_id
    and event.action_type = 'achievement_unlocked:' || p_achievement_key
    and event.related_entity_type = 'profile'
    and event.related_entity_id = p_user_id;

  insert into public.point_events (
    user_id, points, action_type, description,
    related_entity_type, related_entity_id, created_by, reward_revision
  )
  values (
    p_user_id,
    v_delta,
    'achievement_unlocked:' || p_achievement_key,
    'Legendarium Etap 1: uzgodnienie wartości odznaki',
    'profile',
    p_user_id,
    v_actor,
    v_revision
  );

  return true;
end;
$$;

revoke all on function private.reconcile_achievement_renown(uuid, text, integer)
  from public, anon, authenticated;

create or replace function private.apply_legendarium_stage1_reconciliation()
returns table (
  achievement_changes integer,
  renown_events integer,
  renown_delta bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan record;
  v_achievement_changes integer := 0;
  v_renown_events integer := 0;
  v_renown_delta bigint := 0;
  v_current_points integer;
begin
  if auth.uid() is not null and not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  -- Stare unlocki nie zawsze miały deklaratywny state. Bootstrap pozwala je
  -- bezpiecznie cofnąć, jeśli naprawiony predykat nie jest spełniony.
  insert into public.play_reward_states (
    user_id, reward_type, reward_key, is_active, revision, last_play_id
  )
  select
    earned.user_id,
    'achievement'::public.reward_type,
    earned.achievement_key,
    true,
    coalesce((
      select max(event.reward_revision)
      from public.point_events as event
      where event.user_id = earned.user_id
        and event.action_type = 'achievement_unlocked:' || earned.achievement_key
        and event.related_entity_type = 'profile'
        and event.related_entity_id = earned.user_id
    ), 0),
    null
  from public.user_achievements as earned
  where earned.achievement_key in (
    'natural_one', 'dark_urge', 'party_summoned', 'initiative_master',
    'side_quest', 'persuasion_master', 'quest_accepted'
  )
  on conflict do nothing;

  v_achievement_changes := private.recompute_legendarium_stage1_achievements(
    null,
    'legendarium_stage1_backfill'
  );

  -- Po recompute plan czyta już docelowy zestaw user_achievements. Każdą
  -- różnicę zapisujemy jako nową rewizję; point_events pozostaje append-only.
  for v_plan in
    select
      earned.user_id,
      earned.achievement_key,
      definition.points as target_points
    from public.user_achievements as earned
    join public.achievement_definitions as definition
      on definition.achievement_key = earned.achievement_key
    where definition.is_active = true
    union all
    select distinct
      event.user_id,
      substring(event.action_type from length('achievement_unlocked:') + 1),
      0
    from public.point_events as event
    where event.action_type like 'achievement\_unlocked:%' escape '\'
      and event.related_entity_type = 'profile'
      and event.related_entity_id = event.user_id
      and not exists (
        select 1
        from public.user_achievements as earned
        where earned.user_id = event.user_id
          and earned.achievement_key = substring(
            event.action_type from length('achievement_unlocked:') + 1
          )
      )
  loop
    v_current_points := private.reward_ledger_net(
      v_plan.user_id,
      'achievement',
      v_plan.achievement_key
    );

    if private.reconcile_achievement_renown(
      v_plan.user_id,
      v_plan.achievement_key,
      v_plan.target_points
    ) then
      v_renown_events := v_renown_events + 1;
      v_renown_delta := v_renown_delta
        + v_plan.target_points
        - v_current_points;
    end if;
  end loop;

  return query select v_achievement_changes, v_renown_events, v_renown_delta;
end;
$$;

comment on function private.apply_legendarium_stage1_reconciliation() is
  'Operatorski APPLY backfillu i append-only rebalance achievement Renown. Migracja nie wywołuje tej funkcji automatycznie.';

revoke all on function private.apply_legendarium_stage1_reconciliation()
  from public, anon, authenticated;
