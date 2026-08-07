-- Historia wypozyczen egzemplarzy gier. games.owner_id pozostaje zrodlem
-- prawdy dla wlasciciela, a current_holder_id opisuje tylko stan biezacy.

create table public.game_loans (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete restrict,
  lender_user_id uuid not null references public.profiles (id) on delete restrict,
  borrower_user_id uuid not null references public.profiles (id) on delete restrict,
  loaned_at timestamptz not null default now(),
  returned_at timestamptz,
  note text,
  constraint game_loans_different_people_check check (
    lender_user_id <> borrower_user_id
  ),
  constraint game_loans_returned_after_loaned_check check (
    returned_at is null or returned_at >= loaned_at
  ),
  constraint game_loans_note_length_check check (
    note is null or length(note) <= 500
  )
);

create unique index game_loans_one_active_per_game_idx
on public.game_loans (game_id)
where returned_at is null;

create index game_loans_lender_history_idx
on public.game_loans (lender_user_id, loaned_at desc);

create index game_loans_borrower_history_idx
on public.game_loans (borrower_user_id, loaned_at desc);

alter table public.game_loans enable row level security;

create policy game_loans_select_active_members
on public.game_loans for select to authenticated
using (private.is_active_member());

revoke all on table public.game_loans from public, anon, authenticated;
grant select on table public.game_loans to authenticated;

create or replace function public.loan_game(
  p_game_id uuid,
  p_borrower_user_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_loan_id uuid;
  v_note text := nullif(btrim(p_note), '');
begin
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  select owner_id, archived_at
  into v_owner_id, v_archived_at
  from public.games
  where id = p_game_id
  for update;

  if v_owner_id is null or v_archived_at is not null then
    raise exception 'Game does not exist or is archived'
      using errcode = '23503';
  end if;

  if v_owner_id <> current_user_id then
    raise exception 'Only the owner can loan this game'
      using errcode = '42501';
  end if;

  if p_borrower_user_id = current_user_id then
    raise exception 'A game cannot be loaned to its owner'
      using errcode = '22023';
  end if;

  if not private.is_visible_member(p_borrower_user_id) then
    raise exception 'Borrower must be an active visible member'
      using errcode = '22023';
  end if;

  if v_note is not null and length(v_note) > 500 then
    raise exception 'Loan note is too long'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.game_loans
    where game_id = p_game_id
      and returned_at is null
  ) then
    raise exception 'Game already has an active loan'
      using errcode = '23505';
  end if;

  insert into public.game_loans (
    game_id,
    lender_user_id,
    borrower_user_id,
    note
  )
  values (
    p_game_id,
    current_user_id,
    p_borrower_user_id,
    v_note
  )
  returning id into v_loan_id;

  update public.games
  set
    current_holder_id = p_borrower_user_id,
    status = 'loaned'::public.game_status,
    updated_at = now()
  where id = p_game_id;

  return v_loan_id;
end;
$$;

create or replace function public.return_game(
  p_game_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_loan_id uuid;
begin
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  select owner_id
  into v_owner_id
  from public.games
  where id = p_game_id
  for update;

  if v_owner_id is null then
    raise exception 'Game does not exist'
      using errcode = '23503';
  end if;

  if v_owner_id <> current_user_id then
    raise exception 'Only the owner can return this game'
      using errcode = '42501';
  end if;

  select id
  into v_loan_id
  from public.game_loans
  where game_id = p_game_id
    and lender_user_id = current_user_id
    and returned_at is null
  for update;

  if v_loan_id is null then
    raise exception 'Game has no active loan'
      using errcode = '22023';
  end if;

  update public.game_loans
  set returned_at = now()
  where id = v_loan_id;

  update public.games
  set
    current_holder_id = v_owner_id,
    status = 'available'::public.game_status,
    updated_at = now()
  where id = p_game_id;

  return v_loan_id;
end;
$$;

revoke all on function public.loan_game(uuid, uuid, text)
from public, anon, authenticated;
revoke all on function public.return_game(uuid)
from public, anon, authenticated;

grant execute on function public.loan_game(uuid, uuid, text)
to authenticated;
grant execute on function public.return_game(uuid)
to authenticated;
