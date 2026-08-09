begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

select has_table('public', 'portrait_frames', '1. frame catalog exists');
select has_table('public', 'user_portrait_frames', '2. player frame inventory exists');
select has_column(
  'public', 'profiles', 'active_portrait_frame_key',
  '3. profile stores the active cosmetic frame'
);
select is(
  (select count(*) from public.portrait_frames where is_active),
  13::bigint,
  '4. catalog contains exactly the configured frame assets'
);
select is(
  (select count(*) from public.portrait_frames where rarity = 'common'),
  5::bigint,
  '5. all five common frames are seeded'
);
select is(
  (select count(*) from public.portrait_frames where is_shop_available),
  8::bigint,
  '6. preview shop contains the real rare and epic assets'
);
select is(
  (
    select count(*)
    from public.portrait_frames
    where asset_path not like '/Frames/%.png'
  ),
  0::bigint,
  '7. every catalog entry points at the configured Frames directory'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.portrait_frames'::regclass),
  true,
  '8. catalog has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.user_portrait_frames'::regclass),
  true,
  '9. inventory has RLS enabled'
);
select ok(
  to_regprocedure('public.purchase_portrait_frame(text)') is null,
  '10. point-based frame purchase RPC does not exist'
);
select ok(
  not has_function_privilege('anon', 'public.set_active_portrait_frame(text)', 'EXECUTE'),
  '11. anon cannot select an active frame'
);

create temporary table portrait_frame_balance_baseline as
select coalesce(sum(points), 0)::bigint as points
from public.point_events
where user_id = '10000000-0000-0000-0000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$insert into public.user_portrait_frames (user_id, frame_id)
    values (
      '10000000-0000-0000-0000-000000000002',
      '72000000-0000-4000-8000-000000000002'
    )$$,
  '42501',
  null,
  '12. member cannot grant themselves a preview-shop frame'
);
select lives_ok(
  $$select public.set_active_portrait_frame('common-frame-2')$$,
  '13. every active member may select a common frame'
);
reset role;

select is(
  (
    select active_portrait_frame_key from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  ),
  'common-frame-2'::text,
  '14. common selection persists after the request'
);
select is(
  (
    select count(*) from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type = 'portrait_frame_purchase'
  ),
  0::bigint,
  '15. selecting a common frame creates no shop point event'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_active_portrait_frame('epic-frame-1')$$,
  '42501',
  'Portrait frame is not owned',
  '16. non-owned epic frame cannot be activated'
);
select is(
  (select count(*) from public.portrait_frames),
  13::bigint,
  '17. active member can read the enabled catalog'
);
select throws_ok(
  $$update public.portrait_frames set name = 'Bypass' where frame_key = 'epic-frame-1'$$,
  '42501',
  null,
  '18. active member cannot modify the catalog'
);
select throws_ok(
  $$update public.user_portrait_frames set acquisition_type = 'admin' where user_id = auth.uid()$$,
  '42501',
  null,
  '19. active member cannot modify inventory rows'
);
reset role;

insert into public.user_portrait_frames (user_id, frame_id, acquisition_type)
values (
  '10000000-0000-0000-0000-000000000002',
  '73000000-0000-4000-8000-000000000001',
  'admin'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.set_active_portrait_frame('epic-frame-1')$$,
  '20. an already-owned epic frame can still be activated'
);
reset role;

select is(
  (
    select active_portrait_frame_key from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  ),
  'epic-frame-1'::text,
  '21. owned active frame persists after refresh'
);
select is(
  (
    select count(*) from public.user_portrait_frames
    where user_id = '10000000-0000-0000-0000-000000000002'
      and frame_id = '73000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '22. existing inventory remains available after refresh'
);
select is(
  (
    select coalesce(sum(points), 0)::bigint from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  ),
  (select points from portrait_frame_balance_baseline),
  '23. frame shop and activation do not change point balance'
);
select is(
  (
    select count(*) from public.point_events
    where related_entity_type = 'portrait_frame'
      and points < 0
  ),
  0::bigint,
  '24. preview shop creates no negative point event'
);

update public.portrait_frames
set is_active = false
where frame_key = 'magic-frame-2';

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_active_portrait_frame('magic-frame-2')$$,
  'P0002',
  'Portrait frame does not exist',
  '25. disabled frame cannot be activated'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.portrait_frames),
  0::bigint,
  '26. inactive member cannot read the catalog'
);
select throws_ok(
  $$select public.set_active_portrait_frame('common-frame-1')$$,
  '42501',
  'Active membership is required',
  '27. inactive member cannot activate even a common frame'
);
reset role;

select ok(
  has_function_privilege('authenticated', 'public.set_active_portrait_frame(text)', 'EXECUTE'),
  '28. authenticated members can call the narrow activation RPC'
);
select is(
  (
    select count(*)
    from public.portrait_frames
    where rarity in ('rare', 'epic') and is_shop_available
  ),
  8::bigint,
  '29. rare and epic frames remain visible as shop previews'
);

select * from finish();
rollback;
