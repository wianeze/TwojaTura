begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_function(
  'public',
  'pause_meeting_play',
  array['uuid', 'uuid', 'text'],
  '1. istnieje wąskie RPC odkładania aktywnej sesji'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.pause_meeting_play(uuid,uuid,text)',
    'EXECUTE'
  ),
  '2. anon nie może odkładać partii przy Stole'
);

create temporary table t_pause_switch_ids (
  name text primary key,
  id uuid not null
);
grant select, insert on t_pause_switch_ids to authenticated;

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
      v_source_one uuid;
      v_source_two uuid;
      v_target uuid;
      v_play_one uuid;
      v_play_two uuid;
    begin
      v_source_one := public.create_meeting_with_invitations(
        p_title => 'QA źródło pierwszej odłożonej partii',
        p_starts_at => now() - interval '3 hours',
        p_ends_at => now() + interval '3 hours',
        p_invited_user_ids => '{}'::uuid[]
      );
      v_play_one := public.start_meeting_play(
        v_source_one,
        '30000000-0000-0000-0000-000000000002'
      );
      perform public.finish_meeting_play(v_play_one, false, 'Pierwsza odłożona');

      v_source_two := public.create_meeting_with_invitations(
        p_title => 'QA źródło drugiej odłożonej partii',
        p_starts_at => now() - interval '2 hours',
        p_ends_at => now() + interval '4 hours',
        p_invited_user_ids => '{}'::uuid[]
      );
      v_play_two := public.start_meeting_play(
        v_source_two,
        '30000000-0000-0000-0000-000000000003'
      );
      perform public.finish_meeting_play(v_play_two, false, 'Druga odłożona');

      v_target := public.create_meeting_with_invitations(
        p_title => 'QA Stół przełączający kontynuacje',
        p_starts_at => now() - interval '30 minutes',
        p_ends_at => now() + interval '5 hours',
        p_invited_user_ids => '{}'::uuid[]
      );

      insert into t_pause_switch_ids (name, id) values
        ('play_one', v_play_one),
        ('play_two', v_play_two),
        ('target', v_target);
    end
    $body$
  $$,
  '3. fixture tworzy dwie różne odłożone partie bez duplikowania wpisów'
);

select lives_ok(
  $$
    select public.resume_meeting_play(
      (select id from t_pause_switch_ids where name = 'target'),
      (select id from t_pause_switch_ids where name = 'play_one')
    )
  $$,
  '4. pierwszą odłożoną partię można wznowić przy Stole'
);
reset role;

select results_eq(
  $$select continued_play_id from public.meetings where id = (select id from t_pause_switch_ids where name = 'target')$$,
  $$select id from t_pause_switch_ids where name = 'play_one'$$,
  '5. aktywny slot Stołu wskazuje dokładnie pierwszy istniejący play_id'
);

set local role authenticated;
select lives_ok(
  $$
    select public.pause_meeting_play(
      (select id from t_pause_switch_ids where name = 'target'),
      (select id from t_pause_switch_ids where name = 'play_one'),
      'Odłożona po pierwszej sesji'
    )
  $$,
  '6. aktywną kontynuację można odłożyć bez usuwania wpisu Kroniki'
);
reset role;

select results_eq(
  $$
    select
      meeting.continued_play_id = play.id,
      play.status = 'in_progress'::public.play_status,
      play.live_ended_at is not null,
      play.result_pending = false,
      play.duration_minutes > 0
    from public.meetings as meeting
    join t_pause_switch_ids as target on target.name = 'target' and target.id = meeting.id
    join public.plays as play on play.id = (select id from t_pause_switch_ids where name = 'play_one')
  $$,
  $$values (true, true, true, true, true)$$,
  '7. Odłóż zachowuje wybór, in_progress, czas i ten sam wpis'
);

set local role authenticated;
select lives_ok(
  $$
    select public.resume_meeting_play(
      (select id from t_pause_switch_ids where name = 'target'),
      (select id from t_pause_switch_ids where name = 'play_two')
    )
  $$,
  '8. po odłożeniu pierwszej można wznowić inną odłożoną partię'
);
reset role;

select results_eq(
  $$select continued_play_id from public.meetings where id = (select id from t_pause_switch_ids where name = 'target')$$,
  $$select id from t_pause_switch_ids where name = 'play_two'$$,
  '9. slot Stołu przełącza się na drugi istniejący play_id'
);

set local role authenticated;
select lives_ok(
  $$
    do $body$
    begin
      perform public.finish_meeting_play(
        (select id from t_pause_switch_ids where name = 'play_two'),
        false,
        'Stary wskaźnik po wcześniejszej wersji'
      );
      perform public.resume_meeting_play(
        (select id from t_pause_switch_ids where name = 'target'),
        (select id from t_pause_switch_ids where name = 'play_one')
      );
    end
    $body$
  $$,
  '10. nieaktywny stary continued_play_id nie blokuje świadomej zmiany partii'
);
reset role;

select results_eq(
  $$select continued_play_id from public.meetings where id = (select id from t_pause_switch_ids where name = 'target')$$,
  $$select id from t_pause_switch_ids where name = 'play_one'$$,
  '11. zmiana po starym wskaźniku przypina właściwy play_id'
);

select is(
  (
    select count(*)::integer
    from public.plays
    where id in (
      select id from t_pause_switch_ids where name in ('play_one', 'play_two')
    )
  ),
  2,
  '12. wznowienia i przełączenia nie tworzą duplikatów Kroniki'
);

select * from finish();
rollback;
