begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

select has_table('public', 'title_definitions', '1. katalog Tytułów istnieje');
select has_table('public', 'user_titles', '2. Ekwipunek Tytułów istnieje');
select hasnt_column('public', 'profiles', 'nickname', '3. profil nie ma osobnego nickname');
select has_column('public', 'profiles', 'equipped_title_id', '4. profil ma wyposażony Tytuł');
select is((select relrowsecurity from pg_class where oid = 'public.title_definitions'::regclass), true, '5. katalog ma RLS');
select is((select relrowsecurity from pg_class where oid = 'public.user_titles'::regclass), true, '6. Ekwipunek ma RLS');
select is((select count(*) from public.title_definitions where is_active and is_purchasable), 9::bigint, '7. startowy katalog ma dziewięć Tytułów sklepowych');
select ok(not has_function_privilege('anon', 'public.purchase_title(uuid,uuid)', 'EXECUTE'), '8. anon nie kupi Tytułu');
select hasnt_function('public', 'set_current_nickname', array['text'], '9. API nie zawiera osobnego nickname');

update public.profiles
set display_name = 'Marta Legacy'
where id = '10000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select * from public.admin_adjust_tukats('10000000-0000-0000-0000-000000000002', 200, 'seed tytułów', 'c2000000-0000-0000-0000-000000000010')$$,
  '10. administrator może przygotować saldo Tukatów do testu'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select * from public.purchase_title('74000000-0000-4000-8000-000000000001', 'c2000000-0000-0000-0000-000000000011')$$,
  '11. legacy wieloczłonowy display_name nie blokuje zakupu'
);
select results_eq(
  $$select amount, source_type from public.tukat_events where idempotency_key = 'title_purchase:10000000-0000-0000-0000-000000000002:c2000000-0000-0000-0000-000000000011'$$,
  $$values (-50::integer, 'title_purchase'::text)$$,
  '12. zakup dopisuje ujemny append-only event Tukatów'
);
select results_eq(
  $$select total_tukats from public.tukat_balances where user_id = '10000000-0000-0000-0000-000000000002'$$,
  $$values (150::bigint)$$,
  '13. saldo Tukatów maleje o cenę Tytułu'
);
select results_eq(
  $$select not exists (select 1 from public.point_events where user_id = '10000000-0000-0000-0000-000000000002' and action_type = 'title_purchase')$$,
  $$values (true)$$,
  '14. zakup Tytułu nie zmienia Renomy'
);
select results_eq(
  $$select count(*)::integer from public.user_titles where user_id = auth.uid()$$,
  $$values (1::integer)$$,
  '15. zakup zapisuje jeden Tytuł w Ekwipunku'
);
select lives_ok(
  $$select * from public.purchase_title('74000000-0000-4000-8000-000000000001', 'c2000000-0000-0000-0000-000000000011')$$,
  '16. powtórzenie tego samego requestu jest idempotentne'
);
select is(
  (select count(*)::integer from public.tukat_events where user_id = auth.uid() and source_type = 'title_purchase'), 1,
  '17. retry nie dubluje eventu Tukatów'
);
select throws_ok(
  $$select * from public.purchase_title('74000000-0000-4000-8000-000000000001', 'c2000000-0000-0000-0000-000000000012')$$,
  '23505', 'Title is already owned',
  '18. drugi zakup posiadanego Tytułu jest odrzucony'
);
select lives_ok(
  $$select public.set_equipped_title('74000000-0000-4000-8000-000000000001')$$,
  '19. legacy wieloczłonowy display_name nie blokuje equipu'
);
select is(
  (select equipped_title_id from public.profiles where id = auth.uid()),
  '74000000-0000-4000-8000-000000000001'::uuid,
  '20. wyposażony Tytuł zapisuje się w profilu'
);
select lives_ok($$select public.set_equipped_title(null)$$, '21. Tytuł można zdjąć bez kosztu');
reset role;

select * from finish();
rollback;
