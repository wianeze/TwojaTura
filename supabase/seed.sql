-- Local-only credentials. Never reuse these accounts or passwords in production.
-- Password for every seeded account: TwojaTura123!

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'admin@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00',
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Przemek"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'marta@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00',
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Marta"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'michal@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00',
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Michał"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'ania@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00',
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Ania"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'kuba@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00',
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Kuba"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'inactive@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00',
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Nieaktywny"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  );

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  ('20000000-0000-0000-0000-' || lpad(row_number() over (order by id)::text, 12, '0'))::uuid,
  id,
  email,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  '2026-01-01 10:00:00+00'::timestamptz,
  '2026-01-01 10:00:00+00'::timestamptz,
  '2026-01-01 10:00:00+00'::timestamptz
from auth.users
where email like '%@twojatura.local';

insert into public.profiles (id, display_name, email, avatar_url)
values
  ('10000000-0000-0000-0000-000000000001', 'Przemek', 'admin@twojatura.local', null),
  ('10000000-0000-0000-0000-000000000002', 'Marta', 'marta@twojatura.local', null),
  ('10000000-0000-0000-0000-000000000003', 'Michał', 'michal@twojatura.local', null),
  ('10000000-0000-0000-0000-000000000004', 'Ania', 'ania@twojatura.local', null),
  ('10000000-0000-0000-0000-000000000005', 'Kuba', 'kuba@twojatura.local', null),
  ('10000000-0000-0000-0000-000000000006', 'Nieaktywny', 'inactive@twojatura.local', null);

insert into public.app_members (user_id, role, is_active)
values
  ('10000000-0000-0000-0000-000000000001', 'admin', true),
  ('10000000-0000-0000-0000-000000000002', 'member', true),
  ('10000000-0000-0000-0000-000000000003', 'member', true),
  ('10000000-0000-0000-0000-000000000004', 'member', true),
  ('10000000-0000-0000-0000-000000000005', 'member', true),
  ('10000000-0000-0000-0000-000000000006', 'member', false);

insert into public.app_content (content_key, value)
values
  ('dashboard.hero.title', 'Zbierz ekipę. Wybierz grę. Twoja tura.'),
  ('dashboard.hero.description', 'Jedno ciepłe miejsce dla wspólnych planszówkowych wieczorów.'),
  ('shelf.heading', 'Pudełka całej ekipy w jednym miejscu'),
  ('shelf.description', 'Wspólna kolekcja fizycznych egzemplarzy gier.'),
  ('legendarium.heading', 'Legendy przy Stole'),
  ('calendar.heading', 'Najbliższe wieczory przy stole'),
  ('chronicle.heading', 'Kronika rozegranych partii');

insert into public.games (
  id, title, owner_id, current_holder_id, bgg_rank, game_type,
  min_players, max_players, play_time_minutes, release_year,
  mechanics, categories, bgg_weight, min_age, designer, publisher,
  expansions, description, status, created_at
)
values
  (
    '30000000-0000-0000-0000-000000000001', 'Nemesis',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    20, 'Półkooperacyjna', 1, 5, 120, 2018,
    array['Ukryte cele', 'Eksploracja'], array['Science fiction', 'Horror'],
    3.50, 12, 'Adam Kwapiński', 'Awaken Realms', 'Carnomorphs',
    'Wyprawa na pokład uszkodzonego statku.', 'loaned',
    '2026-05-01 12:00:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000002', 'Frostpunk',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    310, 'Strategiczna', 1, 4, 135, 2022,
    array['Zarządzanie zasobami', 'Budowanie miasta'], array['Postapokalipsa', 'Strategia'],
    4.20, 16, 'Adam Kwapiński', 'Glass Cannon Unplugged', 'Lodowe Kry',
    'Ostatnie miasto musi przetrwać.', 'available',
    '2026-06-20 12:00:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000003', 'XCOM',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    463, 'Kooperacyjna', 1, 4, 75, 2015,
    array['Czas rzeczywisty', 'Kooperacja'], array['Science fiction', 'Walka'],
    2.90, 14, 'Eric M. Lang', 'Fantasy Flight Games', 'Evolution',
    'Globalna obrona w czasie rzeczywistym.', 'available',
    '2026-04-01 12:00:00+00'
  ),
  (
    '30000000-0000-0000-0000-000000000004', 'Wyspa Skarbów',
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    522, 'Dedukcyjna', 2, 5, 45, 2018,
    array['Dedukcja', 'Blef'], array['Piraci', 'Przygodowa'],
    2.10, 10, 'Marc Paquien', 'Matagot', null,
    'Mapa, blef i zakopany skarb.', 'available',
    '2026-03-01 12:00:00+00'
  );

insert into public.ratings (
  id, game_id, user_id, overall, replayability, theme,
  wants_to_play_again, comment
)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    9, 9, 10, true, 'Napięcie do ostatniej rundy.'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    8, 8, 9, true, 'Świetny klimat i finał.'
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    9, 8, 8, true, 'Presja czasu działa znakomicie.'
  );

insert into public.meetings (
  id, created_by, title, description, location, status
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Lipcowe granie', 'Wybór terminu trwa.', 'Górska Chata', 'planned'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Strategiczna sobota', 'Termin potwierdzony.', 'U Michała', 'confirmed'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'Czerwcowy finał', 'Spotkanie zakończone bez zapisu partii.', 'U Marty', 'completed'
  );

insert into public.meeting_options (
  id, meeting_id, starts_at, ends_at, label
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '2026-07-17 16:00:00+00', '2026-07-17 21:00:00+00', 'Piątek wieczorem'
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    '2026-07-18 15:30:00+00', '2026-07-18 21:00:00+00', 'Sobota po południu'
  ),
  (
    '41000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000001',
    '2026-07-19 14:00:00+00', null, 'Niedziela'
  ),
  (
    '41000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000002',
    '2026-07-11 16:00:00+00', '2026-07-11 22:00:00+00', 'Potwierdzona sobota'
  ),
  (
    '41000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000003',
    '2026-06-27 16:00:00+00', '2026-06-27 21:00:00+00', 'Zakończony termin'
  );

update public.meetings
set selected_option_id = '41000000-0000-0000-0000-000000000004'
where id = '40000000-0000-0000-0000-000000000002';

update public.meetings
set selected_option_id = '41000000-0000-0000-0000-000000000005'
where id = '40000000-0000-0000-0000-000000000003';

insert into public.meeting_availability (
  meeting_option_id, user_id, is_available
)
values
  ('41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', true),
  ('41000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', true),
  ('41000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', false),
  ('41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', true),
  ('41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', false),
  ('41000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', true);

insert into public.meeting_game_votes (meeting_id, game_id, user_id)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');

insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, duration_minutes, comment
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '2026-07-11 16:30:00+00', 108, 'Silniki ruszyły w ostatnim ruchu.'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    null,
    '10000000-0000-0000-0000-000000000001',
    '2026-06-20 17:00:00+00', 74, 'Spontaniczna obrona Ziemi.'
  );

insert into public.play_participants (
  play_id, user_id, placement, score, is_winner
)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 2, null, false),
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 1, null, true),
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 3, null, false),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1, 42, true),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 2, 36, false);

insert into public.point_events (
  id, user_id, points, action_type, description, created_by, created_at
)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    1240, 'seed_baseline', 'Lokalny stan rankingu',
    '10000000-0000-0000-0000-000000000001', '2026-07-01 12:00:00+00'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    1080, 'seed_baseline', 'Lokalny stan rankingu',
    '10000000-0000-0000-0000-000000000001', '2026-07-01 12:00:00+00'
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    940, 'seed_baseline', 'Lokalny stan rankingu',
    '10000000-0000-0000-0000-000000000001', '2026-07-01 12:00:00+00'
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    810, 'seed_baseline', 'Lokalny stan rankingu',
    '10000000-0000-0000-0000-000000000001', '2026-07-01 12:00:00+00'
  ),
  (
    '60000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    690, 'seed_baseline', 'Lokalny stan rankingu',
    '10000000-0000-0000-0000-000000000001', '2026-07-01 12:00:00+00'
  );
