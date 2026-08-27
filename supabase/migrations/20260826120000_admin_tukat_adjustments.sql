-- Administracyjna korekta Tukatów — dokładnie ten sam wzorzec, co korekty
-- Renomy (20260808130000_admin_point_adjustments.sql), tylko dla drugiej
-- waluty.
--
-- ===========================================================================
-- CZEGO TA MIGRACJA **NIE** ROBI
-- ===========================================================================
--
-- Saldo Tukatów pozostaje sumą append-only ledgera public.tukat_events. Nie
-- powstaje tu żadna mutowalna kolumna salda, nie zmienia się widok
-- public.tukat_balances, nie zmienia się private.award_tukats_once ani nic w
-- nagrodach, TTL-u i cooldownach Misji. Korekta administratora to po prostu
-- KOLEJNY wiersz ledgera: dodatni przy nadaniu, ujemny przy odebraniu.
--
-- ===========================================================================
-- DLACZEGO OSOBNA TABELA AUDYTU, A NIE NOWE KOLUMNY W tukat_events
-- ===========================================================================
--
-- tukat_events nie ma miejsca na "kto i dlaczego" — tak samo jak nie miał go
-- point_events dla Renomy. Dokładanie kolumn admin_user_id/operation do
-- ledgera oznaczałoby, że przy każdej wypłacie z Misji (czyli w zdecydowanej
-- większości wierszy) stoją one puste. Renoma rozwiązała to osobną tabelą
-- kontekstu i tu robimy to samo, zamiast budować drugą architekturę:
-- public.admin_tukat_adjustments trzyma actor/operation/powód i wskazuje na
-- swój wiersz w ledgerze, którego nie modyfikuje ani nie usuwa.

create table public.admin_tukat_adjustments (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null unique,
  admin_user_id uuid not null references public.profiles (id) on delete restrict,
  target_user_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  delta integer not null check (delta <> 0),
  reason text,
  tukat_event_id uuid not null unique
    references public.tukat_events (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint admin_tukat_adjustments_operation_check check (
    (operation = 'grant' and delta > 0)
    or
    (operation = 'revoke' and delta < 0)
  )
);

comment on table public.admin_tukat_adjustments is
  'Kontekst audytowy korekt Tukatów wykonanych przez administratora. Saldo nadal liczy się wyłącznie z public.tukat_events — ta tabela mówi tylko, kto, komu i dlaczego dopisał dany wiersz ledgera. Append-only, czytelna wyłącznie dla administratora.';

create index admin_tukat_adjustments_created_idx
  on public.admin_tukat_adjustments (created_at desc);
create index admin_tukat_adjustments_target_created_idx
  on public.admin_tukat_adjustments (target_user_id, created_at desc);
create index admin_tukat_adjustments_admin_created_idx
  on public.admin_tukat_adjustments (admin_user_id, created_at desc);

alter table public.admin_tukat_adjustments enable row level security;

create policy admin_tukat_adjustments_select_admin
on public.admin_tukat_adjustments for select to authenticated
using (private.is_admin());

create trigger admin_tukat_adjustments_append_only
before update or delete on public.admin_tukat_adjustments
for each row execute function private.prevent_append_only_mutation();

grant select on public.admin_tukat_adjustments to authenticated;

-- ---------------------------------------------------------------------------
-- Korekta
-- ---------------------------------------------------------------------------
--
-- Nazwa i kształt parametrów idą za wzorcem Renomy (public.admin_*, wołane
-- przez supabase.rpc z Server Action), a nie za private.* — funkcja musi być
-- wywoływalna z PostgREST.
--
-- RÓŻNICA WOBEC RENOMY, KTÓRA JEST CELOWA: przy Renomie administrator nie
-- podaje liczby punktów (bierze ją z cennika private.point_reward_for), bo
-- Renoma jest prestiżem o ustalonej taryfie. Tukaty są walutą — korekta
-- z definicji dotyczy dowolnej kwoty, więc p_amount jest tu parametrem.
-- Bramką nie jest więc cennik, tylko: rola administratora, kwalifikowalność
-- odbiorcy, zakaz zera i zakaz zejścia salda poniżej zera.
create or replace function public.admin_adjust_tukats(
  p_target_user_id uuid,
  p_amount integer,
  p_reason text default null,
  p_request_id uuid default extensions.gen_random_uuid()
)
returns table (
  adjustment_id uuid,
  tukat_event_id uuid,
  delta integer,
  balance_after bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adjustment_id uuid := extensions.gen_random_uuid();
  v_tukat_event_id uuid := extensions.gen_random_uuid();
  v_existing public.admin_tukat_adjustments%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_balance bigint;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  if p_target_user_id is null or p_amount is null or p_request_id is null then
    raise exception 'Target user, amount and request id are required'
      using errcode = '22023';
  end if;

  -- Korekta o zero nic nie znaczy, a zostawiłaby w historii wpis sugerujący,
  -- że administrator coś zrobił. Odrzucamy zamiast po cichu ignorować.
  if p_amount = 0 then
    raise exception 'Tukat adjustment must not be zero' using errcode = '22023';
  end if;

  -- Idempotencja po request_id: powtórzony request (retry sieciowy, dwuklik)
  -- zwraca tę samą korektę zamiast dopisywać drugi wiersz do ledgera.
  select * into v_existing
  from public.admin_tukat_adjustments as adjustment
  where adjustment.request_id = p_request_id;

  if found then
    if v_existing.admin_user_id <> auth.uid()
      or v_existing.target_user_id <> p_target_user_id
      or v_existing.delta <> p_amount then
      raise exception 'Request id has already been used for another correction'
        using errcode = '23505';
    end if;

    return query
    select
      v_existing.id,
      v_existing.tukat_event_id,
      v_existing.delta,
      (
        select coalesce(sum(event.amount), 0)::bigint
        from public.tukat_events as event
        where event.user_id = v_existing.target_user_id
      ),
      v_existing.created_at;
    return;
  end if;

  -- Ta sama bramka odbiorcy, co w private.award_tukats_once: obserwator i
  -- konto nieaktywne nie gromadzą waluty, więc nie da się im jej też nadać
  -- ręcznie. Administrator BĘDĄCY graczem może być odbiorcą.
  if not private.is_gamification_eligible(p_target_user_id) then
    raise exception 'Tukat recipient must be an active player'
      using errcode = '42501';
  end if;

  -- Serializacja korekt jednego gracza. Bez tego dwie równoległe operacje
  -- "odbierz" odczytałyby to samo saldo i razem zeszłyby poniżej zera —
  -- kontrola salda musi obejmować także odczyt, nie tylko zapis.
  perform pg_advisory_xact_lock(
    hashtext('admin_tukat_adjustment:' || p_target_user_id::text)
  );

  select coalesce(sum(event.amount), 0)::bigint into v_balance
  from public.tukat_events as event
  where event.user_id = p_target_user_id;

  -- Świadomie BEZ clampowania do zera: administrator, który wpisał za dużą
  -- kwotę, ma się o tym dowiedzieć, a nie dostać po cichu inną operację niż
  -- zlecona. Saldo i żądanie wracają w treści błędu, żeby panel mógł napisać
  -- konkretnie, czego zabrakło.
  if v_balance + p_amount < 0 then
    raise exception
      'Tukat balance cannot fall below zero (balance %, requested %)',
      v_balance, p_amount
      using errcode = '23514';
  end if;

  insert into public.tukat_events (
    id,
    user_id,
    amount,
    source_type,
    source_id,
    reason,
    idempotency_key
  ) values (
    v_tukat_event_id,
    p_target_user_id,
    p_amount,
    'admin_adjustment',
    v_adjustment_id,
    coalesce(v_reason, 'Korekta administratora'),
    -- Drugi, niezależny od kodu wywołującego gwarant "dokładnie raz". Klucz
    -- jest per-request, nie stały — każda świadoma korekta ma własny.
    'admin_tukat_adjustment:' || p_request_id::text
  );

  insert into public.admin_tukat_adjustments (
    id,
    request_id,
    admin_user_id,
    target_user_id,
    operation,
    delta,
    reason,
    tukat_event_id
  ) values (
    v_adjustment_id,
    p_request_id,
    auth.uid(),
    p_target_user_id,
    case when p_amount > 0 then 'grant' else 'revoke' end,
    p_amount,
    v_reason,
    v_tukat_event_id
  );

  return query
  select
    adjustment.id,
    adjustment.tukat_event_id,
    adjustment.delta,
    v_balance + p_amount,
    adjustment.created_at
  from public.admin_tukat_adjustments as adjustment
  where adjustment.id = v_adjustment_id;
end;
$$;

comment on function public.admin_adjust_tukats(uuid, integer, text, uuid) is
  'Korekta Tukatów przez administratora. Dopisuje jeden wiersz do append-only ledgera public.tukat_events (dodatni = nadanie, ujemny = odebranie) i zapisuje kontekst w public.admin_tukat_adjustments. Odrzuca kwotę zero oraz każdą operację, która zbiłaby saldo poniżej zera. Nie dotyka Renomy ani nagród Misji.';

-- ---------------------------------------------------------------------------
-- Historia korekt
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_tukat_adjustments(
  p_limit integer default 40
)
returns table (
  adjustment_id uuid,
  admin_user_id uuid,
  admin_display_name text,
  target_user_id uuid,
  target_display_name text,
  operation text,
  delta integer,
  reason text,
  created_at timestamptz
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

  -- idempotency_key i tukat_event_id celowo NIE wychodzą na zewnątrz: to
  -- szczegół implementacyjny ledgera, a nie informacja dla czytającego audyt.
  return query
  select
    adjustment.id,
    adjustment.admin_user_id,
    admin_profile.display_name,
    adjustment.target_user_id,
    target_profile.display_name,
    adjustment.operation,
    adjustment.delta,
    adjustment.reason,
    adjustment.created_at
  from public.admin_tukat_adjustments as adjustment
  join public.profiles as admin_profile
    on admin_profile.id = adjustment.admin_user_id
  join public.profiles as target_profile
    on target_profile.id = adjustment.target_user_id
  order by adjustment.created_at desc, adjustment.id desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

revoke all on function public.admin_adjust_tukats(uuid, integer, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_list_tukat_adjustments(integer)
  from public, anon, authenticated;

grant execute on function public.admin_adjust_tukats(uuid, integer, text, uuid)
  to authenticated;
grant execute on function public.admin_list_tukat_adjustments(integer)
  to authenticated;
