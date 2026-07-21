-- Keep existing class definitions in already-migrated databases aligned with
-- the approved Legendarium copy.
update public.class_definitions
set description = case class_key
  when 'paladyn_zasad' then 'Strażnik instrukcji, obrońca uczciwej rozgrywki i pogromca każdego, kto próbuje nagiąć zasady na swoją korzyść.'
  when 'bard_stolu' then 'Mistrz opowieści, żartów i inspiracji, który nawet przegraną partię potrafi zamienić w legendę.'
  when 'lotrzyk_kart' then 'Mistrz blefu i podstępu, który zawsze ma asa w rękawie, nawet gdy talia nie sprzyja.'
  when 'czarodziej_analizy' then 'Widzi kilka tur naprzód, przelicza każdą możliwość i rzuca zaklęcia, których komponentem jest czysta strategia.'
  when 'barbarzynca_kosci' then 'Rzuca bez lęku, ufa chaosowi i każdą krytyczną porażkę zamienia w okrzyk bitewny.'
  when 'druid_polki' then 'Opiekun kolekcji, który zna naturę każdej gry i zawsze wie, jaki tytuł przywołać na stół.'
  when 'nekromanta_figurek' then 'Wskrzesza zapomniane tytuły, przyzywa armie z pudełek i daje drugie życie figurkom.'
  when 'warlock_meeplow' then 'Zawarł pakt z drewnianymi pionkami, a teraz przyzywa je na stół, aby przejmowały pola, miasta i królestwa.'
  when 'multiclass_planszy' then 'Łączy talenty wielu klas, odnajdując się równie dobrze w strategii, blefie, kooperacji i kontrolowanym chaosie.'
  when 'wojownik_stolu' then 'Staje do każdej rozgrywki bez wahania, walczy do ostatniego punktu i nigdy nie odkłada miecza przed końcem partii.'
  when 'kleryk_druzyny' then 'Leczy konflikty, wzmacnia sojuszników i poświęca własną turę, by cała drużyna mogła sięgnąć po zwycięstwo.'
  when 'lowca_lupow' then 'Tropi rzadkie skarby, zgarnia najlepsze nagrody i nigdy nie opuszcza stołu bez pełnego ekwipunku.'
  when 'mnich_cierpliwosci' then 'Zachowuje spokój przy długiej turze, czeka na idealny moment i jednym ruchem odmienia los całej rozgrywki.'
  when 'czarownik_chaosu' then 'Zaklina przypadek, nagina los sprawiając, że każdy rzut wywraca rozgrywkę do góry nogami.'
  else description
end
where class_key in (
  'paladyn_zasad',
  'bard_stolu',
  'lotrzyk_kart',
  'czarodziej_analizy',
  'barbarzynca_kosci',
  'druid_polki',
  'nekromanta_figurek',
  'warlock_meeplow',
  'multiclass_planszy',
  'wojownik_stolu',
  'kleryk_druzyny',
  'lowca_lupow',
  'mnich_cierpliwosci',
  'czarownik_chaosu'
);
