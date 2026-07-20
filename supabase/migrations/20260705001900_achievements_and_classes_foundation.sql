create table public.achievement_definitions (
  achievement_key text primary key,
  name text not null,
  description text not null,
  condition_text text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary', 'secret')),
  points integer not null default 0 check (points >= 0),
  icon_path text,
  is_secret boolean not null default false,
  is_manual boolean not null default false,
  automation_status text not null check (automation_status in ('automatic', 'manual', 'planned', 'secret')),
  is_active boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references public.profiles(id),
  achievement_key text not null references public.achievement_definitions(achievement_key),
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles(id),
  source_event_type text,
  source_entity_id uuid,
  note text,
  primary key (user_id, achievement_key)
);

create table public.class_definitions (
  class_key text primary key,
  name text not null,
  description text not null,
  playstyle text not null,
  icon_path text,
  is_active boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_requirements (
  class_key text not null references public.class_definitions(class_key) on delete cascade,
  achievement_key text not null references public.achievement_definitions(achievement_key) on delete cascade,
  primary key (class_key, achievement_key)
);

create index user_achievements_user_awarded_idx
  on public.user_achievements (user_id, awarded_at desc);
create index user_achievements_achievement_idx
  on public.user_achievements (achievement_key);
create index achievement_definitions_rarity_sort_idx
  on public.achievement_definitions (rarity, sort_order);
create index achievement_definitions_automation_idx
  on public.achievement_definitions (automation_status);
create index class_requirements_achievement_idx
  on public.class_requirements (achievement_key);

create trigger z_achievement_definitions_updated_at
before update on public.achievement_definitions
for each row execute function private.set_updated_at();

create trigger z_class_definitions_updated_at
before update on public.class_definitions
for each row execute function private.set_updated_at();

insert into public.achievement_definitions (
  achievement_key, name, description, condition_text, rarity, points,
  icon_path, is_secret, is_manual, automation_status, sort_order
)
values
  ('critical_roll', 'Rzut Krytyczny', 'Kiedy to Ty bierzesz los w swoje ręce.', 'Wygraj pierwszą grę.', 'common', 5, '/badges/Rzut-krytyczny.png', false, false, 'automatic', 1),
  ('natural_one', 'Naturalna Jedynka', 'Plan był doskonały. Wykonanie wątpliwe.', 'Zajmij ostatnie miejsce 3 razy.', 'common', 5, '/badges/Naturalna-jedynka.png', false, false, 'planned', 2),
  ('initiative_master', 'Mistrz Inicjatywy', 'Zanim inni przeczytali zasady, Ty już wąchałeś/aś planszę.', 'Utwórz 5 spotkań.', 'common', 10, '/badges/Mistrz-inicjatywy.png', false, false, 'automatic', 3),
  ('camp_host', 'Gospodarz Obozu', 'Ogień do planszówek płonie. Stół rozłożony. Jeszcze alko i jechane.', 'Zorganizuj 5 zakończonych spotkań.', 'common', 10, '/badges/Gospodarz-obozu.png', false, false, 'automatic', 4),
  ('party_summoned', 'Zwołanie Drużyny', 'Przed wyruszeniem w podróż musisz zebrać drużynę.', 'Zorganizuj spotkanie z kompletem aktywnych graczy.', 'common', 10, '/badges/Zwolanie-druzyny.png', false, false, 'automatic', 5),
  ('party_bard', 'Bard Drużyny', 'Czasem wydana opinia warta jest więcej niż sama gra.', 'Dodaj 10 komentarzy do ocen.', 'common', 10, '/badges/Bard-druzyny.png', false, false, 'automatic', 6),
  ('coast_chronicler', 'Kronikarz Wybrzeża', 'Co zostało zapisane, zostało pograne.', 'Zapisz 25 partii.', 'common', 10, '/badges/Kronikarz-wybrzeza.png', false, false, 'automatic', 7),
  ('short_rest', 'Short Rest', 'Pięć minut przerwy. Trzy godziny później…', 'Rozegraj 2 partie jednego dnia.', 'common', 5, '/badges/Short-rest.png', false, false, 'automatic', 8),
  ('full_party', 'Pełna Drużyna', 'Kiedy Rochan jest wołany, Rochan odpowie.', 'Rozegraj partię z co najmniej 5 osobami.', 'common', 5, '/badges/Pelna-druzyna.png', false, false, 'automatic', 9),
  ('lone_wolf', 'Lone Wolf', 'Kiedy najlepiej bawisz się w swoim towarzystwie.', 'Zagraj solo.', 'common', 5, '/badges/Lone-wolf.png', false, false, 'automatic', 10),
  ('side_quest', 'Side Quest', 'Spontan to najlepsza forma planowania.', 'Rozegraj spontaniczną partię bez powiązanego spotkania.', 'common', 5, '/badges/Side-quest.png', false, false, 'automatic', 11),
  ('guidance', 'Przewodnik', 'Świat dalej się pali, ale przynajmniej zaznaczyłeś/aś, że sobota Ci pasuje.', 'Odpowiedz kompletnie na 10 ankiet dostępności.', 'common', 10, '/badges/Przewodnik.png', false, false, 'automatic', 12),
  ('candlekeep_sage', 'Mędrzec Candlekeep', 'Dobrowolne przeczytanie 48-stronicowej instrukcji po to, żeby nie zagrać w grę, to też umiejętność.', 'Rozegraj 10 różnych gier z trudnością BGG co najmniej 3,5.', 'rare', 20, '/badges/Medrzec-candlekeep.png', false, false, 'planned', 13),
  ('bone_breaker', 'Łamacz Kości', 'Najlepszą formą współpracy jest agresja.', 'Wygraj 5 gier konfliktowych.', 'rare', 15, '/badges/Lamacz-kosci.png', false, false, 'planned', 14),
  ('persuasion_master', 'Mistrz Perswazji', 'Ludzie śpieszą się liczyć z Twoim zdaniem, tak szybko odchodzi.', '10 razy zagłosuj na grę, która potem zostanie rozegrana.', 'rare', 15, '/badges/Mistrz-perswazji.png', false, false, 'planned', 15),
  ('table_rogue', 'Łotrzyk Stołowy', 'Oszukujesz innych prawie tak dobrze jak siebie.', 'Wygraj 5 gier z mechaniką blefu lub ukrytych ról.', 'rare', 15, '/badges/Lotrzyk-stolowy.png', false, false, 'planned', 16),
  ('dark_urge', 'Mroczna Żądza', 'Wygrana za wszelką cenę, szkoda że kosztem życia socjalnego.', 'Wygraj 3 partie z rzędu.', 'rare', 15, '/badges/Mroczna-rzadza.png', false, false, 'planned', 17),
  ('tadpole_enjoyer', 'Tadpole Enjoyer', 'To, że czegoś nie lubisz, nie znaczy, że od razu masz przegrać.', 'Zagraj ponownie w grę ocenioną przez siebie na 5/10 lub mniej.', 'rare', 10, '/badges/Tadpole-enjoyer.png', false, false, 'planned', 18),
  ('save_scummer', 'Save Scummer', 'Tym razem na pewno się uda. To samo powiedziałeś wczoraj.', 'Zagraj w tę samą grę 3 razy w ciągu 7 dni.', 'rare', 15, '/badges/Save-scummer.png', false, false, 'planned', 19),
  ('multiclass', 'Multiclass', 'Strateg. Zdrajca. Ekonomista. Hodowca. CV robi się imponujące.', 'Zagraj w 5 różnych kategoriach gier.', 'rare', 10, '/badges/Multiclass.png', false, false, 'planned', 20),
  ('loot_goblin', 'Loot Goblin', 'To nie kolekcjonowanie. To zarządzanie ekwipunkiem. Bardzo pokaźnym ekwipunkiem.', 'Posiadaj 25 aktywnych gier.', 'rare', 15, '/badges/Loot-goblin.png', false, false, 'automatic', 21),
  ('tavern_brawler', 'Tavern Brawler', 'Strategia skończyła się po drugiej kolejce. Godność chwilę później.', 'Rozegraj 10 gier imprezowych.', 'rare', 15, '/badges/Tavern-brawler.png', false, false, 'planned', 22),
  ('quest_accepted', 'Quest Accepted', 'Szalona efektywność w zbieraniu nowych questów.', '10 razy zagłosuj na grę, a następnie weź udział w jej partii.', 'rare', 15, '/badges/Quest-accepted.png', false, false, 'planned', 23),
  ('vicious_mockery', 'Vicious Mockery', 'To nie była recenzja. To był atak dystansowy słowem.', 'Dodaj 3 komentarze do ocen ogólnych nie większych niż 3.', 'rare', 10, '/badges/Vicious-mockery.png', false, false, 'planned', 24),
  ('fanboy', 'Fanboy', 'Obiektywizm opuścił tego podróżnika.', 'Oceń 5 różnych gier na 10/10.', 'rare', 10, '/badges/Fanboy.png', false, false, 'automatic', 25),
  ('hot_take', 'Hot Take', 'Masz prawo do własnej opinii. Niestety skorzystałeś/aś z tego prawa.', 'Twoja ocena różni się od średniej grupy o co najmniej 4 punkty.', 'rare', 10, '/badges/Hot-take.png', false, false, 'planned', 26),
  ('one_more_turn', 'Jeszcze jedna Tura', 'Ty po prostu chcesz grać. To logiczne.', 'Ustaw chęć ponownego zagrania dla 20 różnych gier.', 'rare', 20, '/badges/Jeszcze-jedna-tura.png', false, false, 'automatic', 27),
  ('last_turn_hero', 'Bohater Ostatniej Tury', 'Po dramatyzowaniu i obrażeniu się na wszystkich realizujesz turę życia.', 'Ręcznie: wygraj po wcześniejszym zajmowaniu ostatniego miejsca w partii.', 'epic', 25, '/badges/Bohater-ostatniej-tury.png', false, true, 'manual', 28),
  ('rule_paladin', 'Paladyn Zasad', '„Zobaczę, jak jest w instrukcji”. Wtedy wszyscy wiedzieli, że wieczór znacznie się wydłużył.', 'Ręcznie nadawana przez administratora.', 'epic', 20, '/badges/Paladyn-zasad.png', false, true, 'manual', 29),
  ('long_rest', 'Long Rest', 'Gdy cała drużyna potrzebowała odpoczynku, a Ty wakacji planszówkowych.', 'Wróć do gry po 60 dniach bez partii.', 'epic', 20, '/badges/Long-rest.png', false, false, 'planned', 30),
  ('bag_of_holding', 'Bag of Holding', 'Nikt nie wie, gdzie to wszystko trzymasz. Skarbówka zaczyna zadawać pytania.', 'Posiadaj 50 aktywnych gier.', 'epic', 30, '/badges/Bag-of-holding.png', false, false, 'automatic', 31),
  ('legendary_artifact', 'Legendarny Artefakt', 'Starsza niż część drużyny i nadal częściej trafia na stół.', 'Zagraj w grę wydaną przed 2000 rokiem.', 'epic', 20, '/badges/Legendardny-artefakt.png', false, false, 'planned', 32),
  ('eternal_shelf_curse', 'Klątwa Wiecznej Półki', 'Kupiłeś ją. Podziwiałeś ją. Kurz również jest zachwycony.', 'Posiadaj grę bez zapisanej partii przez rok.', 'epic', 20, '/badges/Klatwa-wiecznej-polki.png', false, false, 'planned', 33),
  ('resurrection', 'Wskrzeszenie', 'Gdy jest tyle bardzo fajnych tytułów, że na te fajne nie ma czasu.', 'Zagraj w grę po 365 dniach przerwy.', 'epic', 30, '/badges/Wskrzeszenie.png', false, false, 'planned', 34),
  ('oathbreaker', 'Oathbreaker', 'Zagrałeś w grę, na którą rzuciłeś/aś klątwę: „Nigdy więcej!”.', 'Zagraj ponownie w grę z wyłączoną chęcią ponownego zagrania.', 'epic', 20, '/badges/Oathbreaker.png', false, false, 'planned', 35),
  ('glass_cannon', 'Glass Cannon', 'Albo z tarczą. Albo na tarczy. Nic pomiędzy.', 'Przez 5 kolejnych partii zajmuj wyłącznie pierwsze lub ostatnie miejsce.', 'epic', 30, '/badges/Glass-cannon.png', false, false, 'planned', 36),
  ('skill_issue', 'Skill Issue', 'Na pewno gra była źle zbalansowana. Trzy razy z rzędu. Specjalnie przeciwko Tobie.', 'Zajmij ostatnie miejsce 3 partie z rzędu.', 'epic', 20, '/badges/Skill-issue.png', false, false, 'planned', 37),
  ('git_gud', 'Git Gud', 'Okazało się, że czwarta porażka nie była obowiązkowa.', 'Po 3 kolejnych porażkach w tej samej grze wygraj następną partię tej gry.', 'epic', 35, '/badges/Git-gud.png', false, false, 'planned', 38),
  ('redemption_arc', 'Odkupienie', 'Może sama gra nie była zła. Może po prostu byłeś/aś wtedy głupszy/a. O trzy tygodnie.', 'Po ponownej partii podnieś ocenę gry z 5 lub mniej do co najmniej 7.', 'epic', 25, '/badges/Odkupienie.png', false, false, 'planned', 39),
  ('chosen_of_the_table', 'Chosen of the Table', 'Zbierasz punkty jak prawdziwy szampion.', 'Zajmij pierwsze miejsce w rankingu punktowym.', 'legendary', 50, '/badges/Chosen-of-the-table.png', false, false, 'planned', 40),
  ('final_boss', 'Ostatni Boss', 'Na pudełku było tyle ostrzeżeń co na paczce fajek, a mimo strat moralnych osiągnięto zwycięstwo.', 'Wygraj grę z trudnością BGG co najmniej 4,0.', 'legendary', 50, '/badges/Ostatni-boss.png', false, false, 'planned', 41),
  ('boss_defeated', 'Boss Pokonany', 'Można zbierać epaxy i udawać, że od początku miałeś/aś plan.', 'Wygraj kooperacyjnie grę z trudnością BGG co najmniej 3,5.', 'legendary', 50, '/badges/Boss-pokonany.png', false, false, 'planned', 42),
  ('plot_armor', 'Gracz obowiązkowy', 'Statystycznie nie powinieneś/aś już wygrywać. Czas na lotto.', 'Wygraj 3 kolejne partie z co najmniej 4 uczestnikami.', 'legendary', 50, '/badges/Gracz-obowiazkowy.png', false, false, 'planned', 43),
  ('main_character', 'Główna postać', 'Pozostali gracze byli niezwykle ważną częścią Twojego zwycięstwa.', 'Wygraj 3 kolejne spotkania w 3 różnych grach.', 'legendary', 50, '/badges/Glowna-postac.png', false, false, 'planned', 44),
  ('time_traveler', 'Podróżnik czasu', 'Cztery dekady. Setki zasad. Nadal ktoś pyta, czy może cofnąć ruch.', 'Zagraj w gry wydane w 4 różnych dekadach.', 'legendary', 50, '/badges/Pordoznik-czasu.png', false, false, 'planned', 45),
  ('dice_speak', 'Niech Mówią Kości', 'Jak to mówią, świat należy do głupich i odważnych. Planowanie to objaw rozsądku.', 'Ręcznie lub questowo: wybierz grę całkowicie losowo i ją rozegraj.', 'secret', 20, '/badges/Niech-mowia-kosci.png', true, false, 'secret', 46),
  ('friendly_fire', 'Bratobójca', 'To miała być współpraca. Najwyraźniej nie sprecyzowaliście z kim.', 'Przegraj 3 gry kooperacyjne.', 'secret', 20, '/badges/Bratobojca.png', true, false, 'secret', 47),
  ('no_save_found', 'Determinacja', 'Konsekwencje? W mojej grze planszowej?', 'Po 3 porażkach z rzędu rozegraj czwartą partię tej samej gry.', 'secret', 25, '/badges/Determinacja.png', true, false, 'secret', 48),
  ('the_absolute', 'Absolutny', 'Wszyscy zagłosowali tak samo. Podejrzane. Ty jeszcze wygrałeś/aś. Bardzo podejrzane.', 'Jednogłośny wybór gry i zwycięstwo użytkownika w późniejszej partii tej gry.', 'secret', 50, '/badges/Absolutny.png', true, false, 'secret', 49),
  ('critical_success_question_mark', 'Krytyczny sukces?', 'Wynik się zgadza. Metoda została utajniona przez komisję.', 'Wygraj grę, którą wcześniej oceniłeś/aś na 4/10 lub mniej.', 'secret', 20, '/badges/Krytyczny-sukces1.png', true, false, 'secret', 50),
  ('hot_streak', 'Gorąca seria', 'Bardzo dobre rzuty kością.', 'Wygraj partię po 5 najlepszych rzutach z rzędu.', 'secret', 30, '/badges/Goraca-seria.png', true, false, 'secret', 51)
on conflict (achievement_key) do update set
  name = excluded.name,
  description = excluded.description,
  condition_text = excluded.condition_text,
  rarity = excluded.rarity,
  points = excluded.points,
  icon_path = excluded.icon_path,
  is_secret = excluded.is_secret,
  is_manual = excluded.is_manual,
  automation_status = excluded.automation_status,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.class_definitions (
  class_key, name, description, playstyle, icon_path, sort_order
)
values
  ('paladyn_zasad', 'Paladyn Zasad', 'Strażnik reguł, porządku i dobrej organizacji.', 'Pilnuje zasad, dba o strukturę spotkania i czasem jednym zdaniem z instrukcji zatrzymuje całą drużynę.', '/Classes/Paladyn.png', 1),
  ('bard_stolu', 'Bard Stołu', 'Mistrz klimatu, komentarzy i opinii.', 'Nie zawsze wygrywa, ale wszyscy pamiętają, co powiedział.', '/Classes/Bard.png', 2),
  ('lotrzyk_kart', 'Łotrzyk Kart', 'Specjalista od blefu, podstępu i ryzyka.', 'Czasem wygrywa partię, czasem tylko psuje innym poczucie bezpieczeństwa.', '/Classes/Lotrzyk.png', 3),
  ('czarodziej_analizy', 'Czarodziej Analizy', 'Znawca ciężkich tytułów, instrukcji i optymalizacji.', 'Widzi zależności tam, gdzie inni widzą tylko planszę.', '/Classes/Czarodziej.png', 4),
  ('barbarzynca_kosci', 'Barbarzyńca Kości', 'Wojownik konfliktu, agresji i zwycięstwa siłą.', 'Strategia jest mile widziana, ale najważniejsze, żeby ktoś spadł z planszy.', '/Classes/Barbarzynca.png', 5),
  ('druid_polki', 'Druid Półki', 'Opiekun kolekcji, pudełek i zapomnianych tytułów.', 'Rozbudowuje Półkę, wskrzesza stare gry i pamięta, że każda gra kiedyś zasługuje na stół.', '/Classes/Druid.png', 6),
  ('nekromanta_figurek', 'Nekromanta Figurek', 'Specjalista od powrotów i reaktywacji.', 'Wyciąga z grobu gry, kampanie i dawno zapomniane obietnice.', '/Classes/Nekromanta.png', 7),
  ('warlock_meeplow', 'Warlock Meeplów', 'Gracz mrocznych wyborów, klątw i dziwnych układów.', 'Gra mimo cierpienia i wie, że konsekwencje przyjdą później.', '/Classes/Warlock.png', 8),
  ('multiclass_planszy', 'Multiclass Planszy', 'Wszechstronny gracz wszystkich stylów.', 'Zna kategorie, mechaniki, style i meta-zagrywki, a jego planszówkowe CV nie mieści się na jednej karcie postaci.', '/Classes/Multiclass.png', 9),
  ('wojownik_stolu', 'Wojownik Stołu', 'Gracz zwycięstw, pojedynków i dużych triumfów.', 'Wchodzi do partii po wynik, nie po uczestnictwo.', '/Classes/Wojownik.png', 10),
  ('kleryk_druzyny', 'Kleryk Drużyny', 'Opiekun i spoiwo całej ekipy.', 'Odpowiada na zwołania, wspiera spotkania i pilnuje, żeby drużyna faktycznie usiadła do stołu.', '/Classes/Kleryk.png', 11),
  ('lowca_lupow', 'Łowca Łupów', 'Kolekcjoner okazji, punktów, questów i trofeów.', 'Widzi nagrody tam, gdzie inni widzą tylko kolejną partię.', '/Classes/Łowca.png', 12),
  ('mnich_cierpliwosci', 'Mnich Cierpliwości', 'Wytrwały gracz, który przegrywa, wraca i uczy się gry.', 'Szuka odkupienia tam, gdzie inni już dawno by odpuścili.', '/Classes/Mnich.png', 13),
  ('czarownik_chaosu', 'Czarownik Chaosu', 'Gracz dziwnych decyzji, sekretów i losowych wyborów.', 'Tworzy podejrzanie epickie historie, które nie powinny się wydarzyć.', '/Classes/Czarownik.png', 14)
on conflict (class_key) do update set
  name = excluded.name,
  description = excluded.description,
  playstyle = excluded.playstyle,
  icon_path = excluded.icon_path,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.class_requirements (class_key, achievement_key)
values
  ('paladyn_zasad', 'rule_paladin'), ('paladyn_zasad', 'guidance'), ('paladyn_zasad', 'camp_host'), ('paladyn_zasad', 'party_summoned'), ('paladyn_zasad', 'chosen_of_the_table'),
  ('bard_stolu', 'party_bard'), ('bard_stolu', 'vicious_mockery'), ('bard_stolu', 'hot_take'), ('bard_stolu', 'fanboy'), ('bard_stolu', 'one_more_turn'),
  ('lotrzyk_kart', 'table_rogue'), ('lotrzyk_kart', 'vicious_mockery'), ('lotrzyk_kart', 'hot_take'), ('lotrzyk_kart', 'oathbreaker'), ('lotrzyk_kart', 'critical_success_question_mark'),
  ('czarodziej_analizy', 'candlekeep_sage'), ('czarodziej_analizy', 'final_boss'), ('czarodziej_analizy', 'boss_defeated'), ('czarodziej_analizy', 'multiclass'), ('czarodziej_analizy', 'time_traveler'),
  ('barbarzynca_kosci', 'bone_breaker'), ('barbarzynca_kosci', 'tavern_brawler'), ('barbarzynca_kosci', 'dark_urge'), ('barbarzynca_kosci', 'plot_armor'), ('barbarzynca_kosci', 'glass_cannon'),
  ('druid_polki', 'loot_goblin'), ('druid_polki', 'bag_of_holding'), ('druid_polki', 'eternal_shelf_curse'), ('druid_polki', 'legendary_artifact'), ('druid_polki', 'resurrection'),
  ('nekromanta_figurek', 'resurrection'), ('nekromanta_figurek', 'long_rest'), ('nekromanta_figurek', 'legendary_artifact'), ('nekromanta_figurek', 'eternal_shelf_curse'), ('nekromanta_figurek', 'time_traveler'),
  ('warlock_meeplow', 'tadpole_enjoyer'), ('warlock_meeplow', 'oathbreaker'), ('warlock_meeplow', 'dark_urge'), ('warlock_meeplow', 'no_save_found'), ('warlock_meeplow', 'the_absolute'),
  ('multiclass_planszy', 'multiclass'), ('multiclass_planszy', 'quest_accepted'), ('multiclass_planszy', 'side_quest'), ('multiclass_planszy', 'time_traveler'), ('multiclass_planszy', 'main_character'),
  ('wojownik_stolu', 'critical_roll'), ('wojownik_stolu', 'plot_armor'), ('wojownik_stolu', 'main_character'), ('wojownik_stolu', 'final_boss'), ('wojownik_stolu', 'boss_defeated'),
  ('kleryk_druzyny', 'full_party'), ('kleryk_druzyny', 'party_summoned'), ('kleryk_druzyny', 'camp_host'), ('kleryk_druzyny', 'guidance'), ('kleryk_druzyny', 'short_rest'),
  ('lowca_lupow', 'loot_goblin'), ('lowca_lupow', 'bag_of_holding'), ('lowca_lupow', 'quest_accepted'), ('lowca_lupow', 'one_more_turn'), ('lowca_lupow', 'chosen_of_the_table'),
  ('mnich_cierpliwosci', 'skill_issue'), ('mnich_cierpliwosci', 'git_gud'), ('mnich_cierpliwosci', 'redemption_arc'), ('mnich_cierpliwosci', 'no_save_found'), ('mnich_cierpliwosci', 'long_rest'),
  ('czarownik_chaosu', 'dice_speak'), ('czarownik_chaosu', 'friendly_fire'), ('czarownik_chaosu', 'hot_streak'), ('czarownik_chaosu', 'the_absolute'), ('czarownik_chaosu', 'critical_success_question_mark')
on conflict (class_key, achievement_key) do nothing;

create or replace function private.has_achievement(p_achievement_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_achievements as earned
    where earned.user_id = auth.uid()
      and earned.achievement_key = p_achievement_key
  );
$$;

create or replace function private.award_achievement_once(
  p_user_id uuid,
  p_achievement_key text,
  p_source_event_type text default null,
  p_source_entity_id uuid default null,
  p_note text default null,
  p_awarded_by uuid default auth.uid()
)
returns table (
  awarded boolean,
  achievement_key text,
  awarded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'Achievement recipient is required' using errcode = '22023';
  end if;

  if not private.is_active_member(p_user_id) then
    raise exception 'Achievement recipient must be an active member'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.achievement_definitions as definition
    where definition.achievement_key = p_achievement_key
      and definition.is_active = true
  ) then
    raise exception 'Achievement definition is missing or inactive: %', p_achievement_key
      using errcode = '22023';
  end if;

  insert into public.user_achievements (
    user_id,
    achievement_key,
    awarded_by,
    source_event_type,
    source_entity_id,
    note
  )
  values (
    p_user_id,
    p_achievement_key,
    p_awarded_by,
    p_source_event_type,
    p_source_entity_id,
    p_note
  )
  on conflict on constraint user_achievements_pkey do nothing
  returning user_achievements.awarded_at into inserted_at;

  return query
  select inserted_at is not null, p_achievement_key, inserted_at;
end;
$$;

revoke all on function private.has_achievement(text) from public, anon, authenticated;
grant execute on function private.has_achievement(text) to authenticated;

revoke all on function private.award_achievement_once(uuid, text, text, uuid, text, uuid)
from public, anon, authenticated;

alter table public.achievement_definitions enable row level security;
alter table public.user_achievements enable row level security;
alter table public.class_definitions enable row level security;
alter table public.class_requirements enable row level security;

create policy achievement_definitions_select_visible
on public.achievement_definitions for select
using (
  private.is_admin()
  or (
    private.is_active_member()
    and is_active = true
    and (is_secret = false or private.has_achievement(achievement_key))
  )
);

create policy achievement_definitions_manage_admin
on public.achievement_definitions for all
using (private.is_admin())
with check (private.is_admin());

create policy user_achievements_select_visible
on public.user_achievements for select
using (
  private.is_admin()
  or (
    private.is_active_member()
    and private.is_active_member(user_id)
    and (
      user_id = auth.uid()
      or exists (
        select 1
        from public.achievement_definitions as definition
        where definition.achievement_key = user_achievements.achievement_key
          and definition.is_active = true
          and definition.is_secret = false
      )
    )
  )
);

create policy class_definitions_select_visible
on public.class_definitions for select
using (private.is_admin() or (private.is_active_member() and is_active = true));

create policy class_definitions_manage_admin
on public.class_definitions for all
using (private.is_admin())
with check (private.is_admin());

create policy class_requirements_select_visible
on public.class_requirements for select
using (
  private.is_admin()
  or (
    private.is_active_member()
    and exists (
      select 1
      from public.class_definitions as definition
      where definition.class_key = class_requirements.class_key
        and definition.is_active = true
    )
    and exists (
      select 1
      from public.achievement_definitions as achievement
      where achievement.achievement_key = class_requirements.achievement_key
        and achievement.is_active = true
        and (
          achievement.is_secret = false
          or private.has_achievement(achievement.achievement_key)
        )
    )
  )
);

create policy class_requirements_manage_admin
on public.class_requirements for all
using (private.is_admin())
with check (private.is_admin());

grant select, insert, update, delete on public.achievement_definitions to authenticated;
grant select on public.user_achievements to authenticated;
grant select, insert, update, delete on public.class_definitions to authenticated;
grant select, insert, update, delete on public.class_requirements to authenticated;
