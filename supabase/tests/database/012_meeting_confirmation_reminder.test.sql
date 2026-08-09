begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

-- Organizer ma subskrypcję, żeby próg można było sprawdzić aż do delivery.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (
  '10000000-0000-0000-0000-000000000002',
  'https://push.example/meeting-confirm-reminder',
  'p',
  'a'
);

create temporary table t_confirmation_meeting (id uuid);
grant insert, select on t_confirmation_meeting to authenticated;

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
        p_title => 'Próg potwierdzenia',
        p_starts_at => now() + interval '2 days',
        p_ends_at => now() + interval '2 days 3 hours',
        p_invited_user_ids => array[
          '10000000-0000-0000-0000-000000000003'::uuid,
          '10000000-0000-0000-0000-000000000004'::uuid
        ]
      );
      insert into t_confirmation_meeting (id) values (v_id);
    end;
    $body$
  $$,
  '1. organizator tworzy spotkanie z nowym kontraktem RSVP'
);
reset role;

select results_eq(
  $$
    select user_id, is_available
    from public.meeting_availability
    where meeting_id = (select id from t_confirmation_meeting)
  $$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid, true)$$,
  '2. organizator automatycznie ma RSVP Będę'
);

select is(
  (
    select count(*)::integer
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type = 'meeting_rsvp'
      and related_entity_id = (select id from t_confirmation_meeting)
  ),
  0,
  '3. automatyczne RSVP organizatora nie przyznaje punktów za odpowiedź'
);

-- Sam organizer jest dostępny, ale nie liczy się do progu dwóch innych osób.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.enqueue_meeting_confirmation_reminder(
      (select id from t_confirmation_meeting))$$,
  $$values (false)$$,
  '4. organizer nie liczy się do progu dwóch osób'
);
reset role;

insert into public.meeting_availability (meeting_id, user_id, is_available)
values (
  (select id from t_confirmation_meeting),
  '10000000-0000-0000-0000-000000000003',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.enqueue_meeting_confirmation_reminder(
      (select id from t_confirmation_meeting))$$,
  $$values (false)$$,
  '5. jedna dostępna osoba poza organizatorem nie tworzy przypomnienia'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.push_campaigns
    where template_key = 'meeting_confirm_reminder'
      and source_entity_id = (select id from t_confirmation_meeting)
  ),
  0,
  '6. poniżej progu nie ma kampanii'
);

insert into public.meeting_availability (meeting_id, user_id, is_available)
values (
  (select id from t_confirmation_meeting),
  '10000000-0000-0000-0000-000000000004',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.enqueue_meeting_confirmation_reminder(
      (select id from t_confirmation_meeting))$$,
  $$values (true)$$,
  '7. druga dostępna osoba poza organizatorem uruchamia reminder'
);
reset role;

select results_eq(
  $$
    select title, body, action_url, dedupe_key
    from public.push_campaigns
    where template_key = 'meeting_confirm_reminder'
      and source_entity_id = (select id from t_confirmation_meeting)
  $$,
  $$values (
    'Twoja Tura!'::text,
    'Pamiętaj potwierdzić spotkanie'::text,
    '/kalendarium/' || (select id from t_confirmation_meeting)::text,
    'meeting-confirm-reminder:'
      || (select id from t_confirmation_meeting)::text
      || ':two-attendees'
  )$$,
  '8. reminder ma właściwą treść, link i klucz idempotencji'
);

select results_eq(
  $$
    select delivery.recipient_user_id
    from public.push_deliveries as delivery
    join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.template_key = 'meeting_confirm_reminder'
      and campaign.source_entity_id = (select id from t_confirmation_meeting)
  $$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid)$$,
  '9. jedynym adresatem jest organizator spotkania'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.enqueue_meeting_confirmation_reminder(
      (select id from t_confirmation_meeting))$$,
  $$values (false)$$,
  '10. ponowne sprawdzenie progu nie kolejkuje drugiego reminderu'
);
reset role;

select results_eq(
  $$
    select count(*)::integer
    from public.push_campaigns
    where template_key = 'meeting_confirm_reminder'
      and source_entity_id = (select id from t_confirmation_meeting)
  $$,
  $$values (1)$$,
  '11. reminder jest idempotentny i ma jedną kampanię'
);

-- Potwierdzone spotkanie nie kwalifikuje się nawet przy dwóch odpowiedziach.
insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
) values (
  '40000000-0000-0000-0000-000000000091',
  '10000000-0000-0000-0000-000000000002',
  'Już potwierdzone',
  'confirmed',
  now() + interval '3 days',
  now() + interval '3 days 2 hours'
);
insert into public.meeting_availability (meeting_id, user_id, is_available)
values
  ('40000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000003', true),
  ('40000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000004', true);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.enqueue_meeting_confirmation_reminder(
      '40000000-0000-0000-0000-000000000091')$$,
  $$values (false)$$,
  '12. potwierdzone spotkanie nie uruchamia reminderu'
);
reset role;

-- Brak subskrypcji organizatora nie może wywrócić sprawdzenia ani utworzenia
-- kampanii; outbox po prostu nie utworzy delivery.
insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
) values (
  '40000000-0000-0000-0000-000000000092',
  '10000000-0000-0000-0000-000000000005',
  'Organizer bez push',
  'planned',
  now() + interval '4 days',
  now() + interval '4 days 2 hours'
);
insert into public.meeting_availability (meeting_id, user_id, is_available)
values
  ('40000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-000000000003', true),
  ('40000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-000000000004', true);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.enqueue_meeting_confirmation_reminder(
      '40000000-0000-0000-0000-000000000092')$$,
  '13. brak subskrypcji organizatora nie psuje sprawdzenia po RSVP'
);
reset role;

select results_eq(
  $$
    select count(*)::integer
    from public.push_deliveries as delivery
    join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.source_entity_id = '40000000-0000-0000-0000-000000000092'
      and campaign.template_key = 'meeting_confirm_reminder'
  $$,
  $$values (0)$$,
  '14. bez subskrypcji nie ma delivery do wysłania'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.enqueue_meeting_confirmation_reminder(uuid)',
    'EXECUTE'
  ),
  '15. anon nie może wywołać wąskiego RPC reminderu'
);

select * from finish();
rollback;
