begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

-- Covers 20260726130000_feedback_submissions.sql: "Zgłoś poprawkę".

-- 1. An active member (Marta) can submit feedback; author_id/status fall
-- through to their defaults (auth.uid(), 'new').
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.feedback_submissions (content) values ('Prosze o ciemny motyw.')$$,
  '1. an active member can submit feedback'
);
reset role;

select results_eq(
  $$
    select author_id, status from public.feedback_submissions
    where content = 'Prosze o ciemny motyw.'
  $$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid, 'new'::public.feedback_status)$$,
  '2. author_id and status resolve to their safe defaults'
);

-- 3. An inactive member cannot submit (is_active_member() fails the RLS check).
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$insert into public.feedback_submissions (content) values ('powinno sie nie udac')$$,
  '42501',
  null,
  '3. an inactive member cannot submit feedback'
);
reset role;

-- 4. An observer can submit too (feedback is not domain-data, unlike plays).
update public.app_members set role = 'observer' where user_id = '10000000-0000-0000-0000-000000000005';
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.feedback_submissions (content) values ('Uwaga od obserwatora.')$$,
  '4. an active observer can submit feedback too'
);

-- 5-6. author_id/status can't be spoofed — the column grant only covers
-- `content`, so naming either column explicitly is a privilege error before
-- RLS is even evaluated.
select throws_ok(
  $$insert into public.feedback_submissions (content, author_id) values ('spoof', '10000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '5. author_id cannot be set explicitly by the client'
);
select throws_ok(
  $$insert into public.feedback_submissions (content, status) values ('spoof', 'completed')$$,
  '42501',
  null,
  '6. status cannot be set explicitly by the client'
);
reset role;

-- 7. Empty/whitespace-only content is rejected by the CHECK constraint.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$insert into public.feedback_submissions (content) values ('   ')$$,
  '23514',
  null,
  '7. whitespace-only content is rejected'
);

-- 8. Content over 1000 characters is rejected by the CHECK constraint.
select throws_ok(
  $$insert into public.feedback_submissions (content) values (repeat('a', 1001))$$,
  '23514',
  null,
  '8. content over 1000 characters is rejected'
);

-- 9-10. Cooldown: a second submission from the same author inside 60s is
-- rejected; a different author is not blocked by it (per-author, not global).
select lives_ok(
  $$insert into public.feedback_submissions (content) values ('Pierwsze zgloszenie Michala.')$$,
  '9. Michał''s first submission succeeds'
);
select throws_ok(
  $$insert into public.feedback_submissions (content) values ('Drugie zgloszenie Michala.')$$,
  'P0003',
  null,
  '10. a second submission within 60s from the same author is rejected'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.feedback_submissions (content) values ('Ania nie jest blokowana cooldownem Michala.')$$,
  '11. a different author is not blocked by someone else''s cooldown'
);
reset role;

-- 12. Once the cooldown window has actually elapsed, the same author can
-- submit again — backdate Michał's row instead of sleeping in the test.
update public.feedback_submissions
set created_at = now() - interval '61 seconds'
where content = 'Pierwsze zgloszenie Michala.';

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$insert into public.feedback_submissions (content) values ('Trzecie zgloszenie Michala po cooldownie.')$$,
  '12. the same author can submit again once 60s have actually passed'
);

-- 13. The author can read back their own content/status...
select results_eq(
  $$select status from public.feedback_submissions where content = 'Trzecie zgloszenie Michala po cooldownie.'$$,
  $$values ('new'::public.feedback_status)$$,
  '13. the author can read their own submission back'
);

-- 14. ...but not admin_note, even for their own row — the column grant
-- excludes it entirely for the authenticated role.
select throws_ok(
  $$select admin_note from public.feedback_submissions where content = 'Trzecie zgloszenie Michala po cooldownie.'$$,
  '42501',
  null,
  '14. admin_note is not selectable by a non-admin, even on their own row'
);

-- 15. An author cannot see another author's submissions.
select results_eq(
  $$select count(*)::bigint from public.feedback_submissions where content = 'Uwaga od obserwatora.'$$,
  $$values (0::bigint)$$,
  '15. an author cannot see another author''s submission'
);
reset role;

-- 16-17. admin_list_feedback_submissions() is admin-only and returns
-- everything, including admin_note and other authors' content.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_list_feedback_submissions()$$,
  '42501',
  null,
  '16. a non-admin cannot call admin_list_feedback_submissions'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
-- Ground truth: Marta (1), Kuba/observer (2), Michał (9 succeeded, 12
-- succeeded — 10 was rejected by cooldown and left no row), Ania (1) = 5.
-- Compared against a literal, not against a direct table count, because the
-- admin's own-row RLS select policy would otherwise only show the admin's
-- own (zero) submissions and make this comparison meaningless.
select results_eq(
  $$select count(*)::bigint from public.admin_list_feedback_submissions()$$,
  $$values (5::bigint)$$,
  '17. the admin sees every submission from every author'
);

-- 18-19. admin_update_feedback_submission() is admin-only and applies both
-- the status and the internal note.
-- Fetches the target id through the admin RPC, not the base table directly
-- — admin's own-row select policy on feedback_submissions would never
-- return another author's row, regardless of column grants.
select lives_ok(
  $$
    select public.admin_update_feedback_submission(
      (select id from public.admin_list_feedback_submissions() where content = 'Uwaga od obserwatora.'),
      'completed'::public.feedback_status,
      'Wdrozone w wersji 1.2.'
    )
  $$,
  '18. an admin can update status and admin_note'
);
select results_eq(
  $$select status, admin_note from public.admin_list_feedback_submissions() where content = 'Uwaga od obserwatora.'$$,
  $$values ('completed'::public.feedback_status, 'Wdrozone w wersji 1.2.')$$,
  '19. the update is reflected for the admin'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_update_feedback_submission('00000000-0000-0000-0000-000000000099', 'rejected'::public.feedback_status, null)$$,
  '42501',
  null,
  '20. a non-admin cannot call admin_update_feedback_submission'
);
reset role;

-- 21. Feedback submissions never award points or achievements.
select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where action_type ilike '%feedback%'
  $$,
  $$values (0::bigint)$$,
  '21. no point_events are created for feedback submissions'
);

select * from finish();
rollback;
