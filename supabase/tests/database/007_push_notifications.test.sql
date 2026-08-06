begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

-- Pokrywa 20260731120000_push_subscriptions_foundation.sql,
-- 20260731120100_push_campaigns_and_dispatch.sql oraz usunięcie triggera
-- z_meetings_enqueue_push przez 20260806090000_meeting_invitations.sql
-- (sekcja 5 poniżej). Zaproszenia same w sobie (RPC, RLS, filtrowanie ID)
-- pokrywa 008_meeting_invitations.test.sql.
--
-- Konwencja tego pliku: MUTACJE użytkownika wykonujemy jako zalogowany
-- członek (żeby przechodziły przez realne RPC i kontrolę uprawnień),
-- a ASERCJE jako superuser (żeby RLS nie ukrywał cudzych wierszy).
--
-- Fixture'y z seed.sql:
--   ...0001 Przemek  admin,  active
--   ...0002 Marta    member, active
--   ...0003 Michał   member, active
--   ...0004 Ania     member, active
--   ...0005 Kuba     member, active  -> w tym teście zmieniony na observer
--   ...0006 (brak)   member, INACTIVE

-- Kuba zostaje obserwatorem: automatyczna kampania ma go pomijać.
update public.app_members
set role = 'observer'::public.membership_role
where user_id = '10000000-0000-0000-0000-000000000005';

-- ---------------------------------------------------------------------------
-- 1. Zapis własnej subskrypcji
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.save_push_subscription(
      'https://push.example/marta-1', 'p256-marta', 'auth-marta', 'Firefox')$$,
  '1. aktywny członek zapisuje własną subskrypcję'
);
reset role;

select results_eq(
  $$
    select user_id, disabled_at is null, failure_count
    from public.push_subscriptions
    where endpoint = 'https://push.example/marta-1'
  $$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid, true, 0)$$,
  '2. user_id pochodzi z auth.uid(), subskrypcja jest aktywna'
);

-- Zapis wyłącznie przez RPC: tabela nie ma polityki insert.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('10000000-0000-0000-0000-000000000002',
            'https://push.example/wprost', 'p', 'a')
  $$,
  '42501',
  null,
  '3. bezpośredni insert do push_subscriptions jest niemożliwy'
);
reset role;

-- Michał dostaje własną subskrypcję, żeby było czego nie widzieć.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.save_push_subscription(
      'https://push.example/michal-1', 'p256-michal', 'auth-michal', null)$$,
  '4. drugi członek zapisuje własną subskrypcję'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
-- count(endpoint), a nie count(*): authenticated ma na tej tabeli wyłącznie
-- granty kolumnowe, więc liczymy po kolumnie, do której na pewno ma dostęp.
select results_eq(
  $$select count(endpoint)::bigint from public.push_subscriptions$$,
  $$values (1::bigint)$$,
  '5. Marta widzi wyłącznie własną subskrypcję'
);
reset role;

-- Klucze szyfrujące są poza grantem kolumnowym: nie da się ich odczytać
-- nawet dla własnego wiersza.
select ok(
  not has_column_privilege('authenticated', 'public.push_subscriptions', 'p256dh', 'SELECT'),
  '6. authenticated nie ma dostępu do kolumny p256dh'
);

select ok(
  not has_column_privilege('authenticated', 'public.push_subscriptions', 'auth', 'SELECT'),
  '7. authenticated nie ma dostępu do kolumny auth'
);

select ok(
  has_column_privilege('authenticated', 'public.push_subscriptions', 'endpoint', 'SELECT'),
  '8. authenticated może odczytać endpoint własnej subskrypcji'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.save_push_subscription(
      'https://push.example/nieaktywny', 'p', 'a', null)$$,
  '42501',
  null,
  '9. nieaktywny członek nie może zapisać subskrypcji'
);
reset role;

-- ---------------------------------------------------------------------------
-- 2. Ponowny zapis i bezpieczne przejęcie endpointu
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.save_push_subscription(
      'https://push.example/marta-1', 'p256-marta-nowy', 'auth-marta-nowy', 'Chrome')$$,
  '10. ponowny zapis własnej subskrypcji przechodzi'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint, max(p256dh), max(user_agent)
    from public.push_subscriptions
    where endpoint = 'https://push.example/marta-1'
  $$,
  $$values (1::bigint, 'p256-marta-nowy', 'Chrome')$$,
  '11. ponowny zapis aktualizuje klucze zamiast tworzyć drugi wiersz'
);

-- Sama znajomość endpointu nie może wystarczyć do przejęcia subskrypcji.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.save_push_subscription(
      'https://push.example/marta-1', 'zle-klucze', 'zle-klucze', null)$$,
  'P0004',
  null,
  '12. przejęcie cudzego endpointu z błędnymi kluczami jest odrzucane'
);
reset role;

select results_eq(
  $$
    select user_id, p256dh
    from public.push_subscriptions
    where endpoint = 'https://push.example/marta-1'
  $$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid, 'p256-marta-nowy')$$,
  '13. nieudane przejęcie nie zmienia właściciela ani kluczy'
);

-- Zgodny komplet endpoint + p256dh + auth oznacza faktyczne posiadanie
-- subskrypcji: to samo urządzenie, inne konto.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.save_push_subscription(
      'https://push.example/marta-1', 'p256-marta-nowy', 'auth-marta-nowy', null)$$,
  '14. przejęcie z poprawnym kompletem kluczy przechodzi'
);
reset role;

select results_eq(
  $$
    select user_id from public.push_subscriptions
    where endpoint = 'https://push.example/marta-1'
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid)$$,
  '15. właściciel zostaje przepisany po udanym przejęciu'
);

-- ---------------------------------------------------------------------------
-- 3. Wyłączanie subskrypcji
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.disable_push_subscription('https://push.example/michal-1')$$,
  $$values (false)$$,
  '16. nie da się wyłączyć cudzej subskrypcji'
);
reset role;

select results_eq(
  $$
    select disabled_at is null from public.push_subscriptions
    where endpoint = 'https://push.example/michal-1'
  $$,
  $$values (true)$$,
  '17. cudza subskrypcja pozostaje aktywna'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.disable_push_subscription('https://push.example/michal-1')$$,
  $$values (true)$$,
  '18. właściciel wyłącza własną subskrypcję'
);
reset role;

-- ---------------------------------------------------------------------------
-- 4. Uprawnienia do kampanii i dostaw
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.admin_create_push_campaign(
      p_title => 'Tytuł',
      p_body => 'Treść',
      p_idempotency_key => 'token-nieadmina')$$,
  '42501',
  null,
  '19. zwykły użytkownik nie może utworzyć kampanii'
);

select throws_ok(
  $$select public.admin_list_push_audience()$$,
  '42501',
  null,
  '20. zwykły użytkownik nie może wylistować odbiorców'
);

select throws_ok(
  $$select public.admin_reschedule_pending_push_deliveries()$$,
  '42501',
  null,
  '21. zwykły użytkownik nie może ponowić kolejki'
);

select throws_ok(
  $$select public.admin_list_push_campaigns(10)$$,
  '42501',
  null,
  '22. zwykły użytkownik nie widzi historii kampanii'
);

reset role;

select ok(
  not has_function_privilege(
    'authenticated', 'public.claim_push_deliveries(integer)', 'EXECUTE'),
  '23. authenticated nie może wywołać claim_push_deliveries'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.complete_push_delivery(uuid, text, text)', 'EXECUTE'),
  '24. authenticated nie może wywołać complete_push_delivery'
);

select ok(
  not has_table_privilege('authenticated', 'public.push_campaigns', 'INSERT'),
  '25. authenticated nie może pisać do push_campaigns'
);

select ok(
  not has_table_privilege('authenticated', 'public.push_deliveries', 'INSERT'),
  '26. authenticated nie może pisać do push_deliveries'
);

select ok(
  not has_table_privilege('authenticated', 'public.push_campaigns', 'SELECT'),
  '27. authenticated nie czyta push_campaigns bezpośrednio'
);

-- ---------------------------------------------------------------------------
-- 5. Kampania po utworzeniu spotkania z zaproszeniami
-- ---------------------------------------------------------------------------
--
-- Od 20260806090000_meeting_invitations.sql zwykły insert do meetings NIE
-- kolejkuje już żadnego push-a — trigger z_meetings_enqueue_push (i jego
-- audience "wszyscy aktywni member/admin") został usunięty. Realną ścieżkę
-- produkcyjną (public.create_meeting_with_invitations) pokrywa osobny plik
-- supabase/tests/database/008_meeting_invitations.test.sql; tutaj zostaje
-- weryfikacja samego mechanizmu outboxa (kampania + dostawy + dedupe) na
-- zaproszeniach wpisanych tak, jak robi to ta RPC.

-- Komplet urządzeń: admin, member, observer oraz subskrypcja wyłączona.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, disabled_at)
values
  ('10000000-0000-0000-0000-000000000001', 'https://push.example/admin', 'p', 'a', null),
  ('10000000-0000-0000-0000-000000000005', 'https://push.example/observer', 'p', 'a', null),
  ('10000000-0000-0000-0000-000000000004', 'https://push.example/ania-off', 'p', 'a', now());

-- Marta znów ma aktywne urządzenie (poprzednie przejął Michał).
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('10000000-0000-0000-0000-000000000002', 'https://push.example/marta-2', 'p', 'a');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into public.meetings (id, created_by, title, starts_at, ends_at)
    values ('80000000-0000-4000-8000-000000000001',
            '10000000-0000-0000-0000-000000000002',
            'Wieczór z Gloomhaven',
            now() + interval '7 days',
            now() + interval '7 days 4 hours')
  $$,
  '28. utworzenie wiersza spotkania przechodzi'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint from public.push_campaigns
    where dedupe_key = 'meeting_created:80000000-0000-4000-8000-000000000001'
  $$,
  $$values (0::bigint)$$,
  '29. sam insert do meetings nie tworzy już żadnej kampanii — trigger usunięty'
);

-- Symulacja tego, co robi create_meeting_with_invitations dla zaproszonych
-- Michała i Ani: wiersze zaproszeń (service_role, tabela nie ma insert dla
-- authenticated) + jedna kampania z audience = wyłącznie zaproszeni.
select lives_ok(
  $$
    do $body$
    begin
      insert into public.meeting_invitations (meeting_id, user_id, invited_by)
      values
        ('80000000-0000-4000-8000-000000000001',
         '10000000-0000-0000-0000-000000000003',
         '10000000-0000-0000-0000-000000000002'),
        ('80000000-0000-4000-8000-000000000001',
         '10000000-0000-0000-0000-000000000004',
         '10000000-0000-0000-0000-000000000002');

      perform private.enqueue_push_campaign(
        'meeting_created'::public.push_campaign_kind,
        'Nowe spotkanie!',
        'Powstało spotkanie „Wieczór z Gloomhaven”. Wybierz gry, w które chcesz zagrać.',
        '/kalendarium/80000000-0000-4000-8000-000000000001',
        'meeting',
        '80000000-0000-4000-8000-000000000001',
        'meeting_created',
        '10000000-0000-0000-0000-000000000002',
        'meeting_created:80000000-0000-4000-8000-000000000001',
        array[
          '10000000-0000-0000-0000-000000000003'::uuid,
          '10000000-0000-0000-0000-000000000004'::uuid
        ]);
    end;
    $body$
  $$,
  '30. zapis zaproszeń + kampania dla wybranych osób przechodzi'
);

select results_eq(
  $$
    select count(*)::bigint, max(kind::text), max(title), max(action_url)
    from public.push_campaigns
    where dedupe_key = 'meeting_created:80000000-0000-4000-8000-000000000001'
  $$,
  $$values (1::bigint, 'meeting_created', 'Nowe spotkanie!',
            '/kalendarium/80000000-0000-4000-8000-000000000001')$$,
  '31. powstaje dokładnie jedna kampania z poprawnym linkiem'
);

select results_eq(
  $$
    select body from public.push_campaigns
    where dedupe_key = 'meeting_created:80000000-0000-4000-8000-000000000001'
  $$,
  $$values ('Powstało spotkanie „Wieczór z Gloomhaven”. Wybierz gry, w które chcesz zagrać.')$$,
  '32. treść kampanii zawiera nazwę spotkania'
);

-- Audiencja to WYŁĄCZNIE zaproszeni (Michał, Ania) — organizator (Marta) nie
-- jest w audience mimo aktywnej subskrypcji. Ania jest zaproszona, ale jej
-- jedyne urządzenie ma disabled_at ustawione, więc nie dostaje dostawy —
-- "zaproszony bez aktywnej subskrypcji" to inny, poprawny przypadek niż
-- "niezaproszony", widoczny tu jako brak wiersza, nie błąd.
select results_eq(
  $$
    select delivery.recipient_user_id
    from public.push_deliveries as delivery
    join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.dedupe_key = 'meeting_created:80000000-0000-4000-8000-000000000001'
    order by delivery.recipient_user_id
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid)$$,
  '33. kampania trafia wyłącznie do zaproszonego z aktywną subskrypcją, pomija organizatora'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.push_deliveries as delivery
    join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
    where campaign.dedupe_key = 'meeting_created:80000000-0000-4000-8000-000000000001'
      and delivery.status = 'queued'::public.push_delivery_status
  $$,
  $$values (1::bigint)$$,
  '34. jedyna dostawa startuje w kolejce'
);

-- Powtórne zakolejkowanie tego samego zdarzenia nie tworzy drugiej kampanii
-- ani nie dosyła na urządzenia zarejestrowane po fakcie.
select lives_ok(
  $$
    select private.enqueue_push_campaign(
      'meeting_created'::public.push_campaign_kind,
      'Nowe spotkanie!', 'Powtórka', '/kalendarium/x', 'meeting',
      '80000000-0000-4000-8000-000000000001', 'meeting_created',
      '10000000-0000-0000-0000-000000000002',
      'meeting_created:80000000-0000-4000-8000-000000000001',
      null)
  $$,
  '35. ponowne zakolejkowanie tego samego dedupe_key nie rzuca'
);

select results_eq(
  $$
    select count(*)::bigint from public.push_campaigns
    where dedupe_key = 'meeting_created:80000000-0000-4000-8000-000000000001'
  $$,
  $$values (1::bigint)$$,
  '36. dedupe_key nadal daje dokładnie jedną kampanię'
);

select throws_ok(
  $$
    insert into public.push_deliveries (campaign_id, subscription_id, recipient_user_id)
    select delivery.campaign_id, delivery.subscription_id, delivery.recipient_user_id
    from public.push_deliveries as delivery
    limit 1
  $$,
  '23505',
  null,
  '37. duplikat campaign_id + subscription_id jest niemożliwy'
);

-- ---------------------------------------------------------------------------
-- 6. Walidacja action_url
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.push_campaigns (kind, title, body, action_url, dedupe_key)
    values ('admin_manual', 'T', 'B', 'https://evil.example', 'zly-url-1')
  $$,
  '23514',
  null,
  '38. adres bezwzględny jako action_url jest odrzucany'
);

select throws_ok(
  $$
    insert into public.push_campaigns (kind, title, body, action_url, dedupe_key)
    values ('admin_manual', 'T', 'B', '//evil.example', 'zly-url-2')
  $$,
  '23514',
  null,
  '39. adres protocol-relative jako action_url jest odrzucany'
);

select lives_ok(
  $$
    insert into public.push_campaigns (kind, title, body, action_url, dedupe_key)
    values ('admin_manual', 'T', 'B', '/kalendarium', 'dobry-url-1')
  $$,
  '40. ścieżka wewnętrzna jako action_url przechodzi'
);

-- ---------------------------------------------------------------------------
-- 7. Kampania administratora i brak urządzeń
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select user_count, subscription_count
    from public.admin_create_push_campaign(
      p_title => 'Zagłosuj na gry',
      p_body => 'Nie wszyscy wybrali gry.',
      p_idempotency_key => 'token-admina-1',
      p_template_key => 'meeting_vote_reminder')
  $$,
  $$values (4, 4)$$,
  '41. admin tworzy kampanię ręczną obejmującą także observera'
);
reset role;

-- ---------------------------------------------------------------------------
-- 8. complete_push_delivery
-- ---------------------------------------------------------------------------

-- Przygotowanie: jedna dostawa w stanie processing z attempt_count = 1.
create temporary table t_push_delivery as
select delivery.id as delivery_id, delivery.subscription_id
from public.push_deliveries as delivery
join public.push_campaigns as campaign on campaign.id = delivery.campaign_id
where campaign.dedupe_key = 'meeting_created:80000000-0000-4000-8000-000000000001'
order by delivery.recipient_user_id
limit 1;

update public.push_deliveries
set status = 'processing'::public.push_delivery_status, attempt_count = 1
where id = (select delivery_id from t_push_delivery);

select lives_ok(
  $$select public.complete_push_delivery(
      (select delivery_id from t_push_delivery), 'retryable_failure', 'http_503')$$,
  '42. retryable_failure jest przyjmowany'
);

select results_eq(
  $$
    select status::text, next_attempt_at > now(), last_error_code
    from public.push_deliveries
    where id = (select delivery_id from t_push_delivery)
  $$,
  $$values ('queued', true, 'http_503')$$,
  '43. retryable_failure wraca do kolejki z odsuniętym terminem'
);

-- Po wyczerpaniu limitu prób ta sama ścieżka kończy się stanem końcowym.
update public.push_deliveries
set status = 'processing'::public.push_delivery_status, attempt_count = 5
where id = (select delivery_id from t_push_delivery);

select public.complete_push_delivery(
  (select delivery_id from t_push_delivery), 'retryable_failure', 'http_503');

select results_eq(
  $$
    select status::text from public.push_deliveries
    where id = (select delivery_id from t_push_delivery)
  $$,
  $$values ('failed')$$,
  '44. po piątej próbie dostawa kończy jako failed'
);

-- 403 (permanent_failure) NIE wyłącza subskrypcji; 404/410 wyłączają.
select public.complete_push_delivery(
  (select delivery_id from t_push_delivery), 'permanent_failure', 'http_403');

select results_eq(
  $$
    select disabled_at is null from public.push_subscriptions
    where id = (select subscription_id from t_push_delivery)
  $$,
  $$values (true)$$,
  '45. permanent_failure (403) nie wyłącza subskrypcji'
);

select public.complete_push_delivery(
  (select delivery_id from t_push_delivery), 'expired_subscription', 'http_410');

select results_eq(
  $$
    select disabled_at is not null from public.push_subscriptions
    where id = (select subscription_id from t_push_delivery)
  $$,
  $$values (true)$$,
  '46. expired_subscription (410) wyłącza subskrypcję'
);

select * from finish();
rollback;
