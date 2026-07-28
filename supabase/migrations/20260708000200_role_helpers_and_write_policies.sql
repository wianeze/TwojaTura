-- Etap D2: three-tier role system (member/admin/observer) — helpers and
-- write-policy overhaul. 'observer' is now committed (previous migration),
-- so it's safe to reference it here.
--
-- Pattern for the whole file: every RLS policy that gated INSERT/UPDATE/
-- DELETE on private.is_active_member() is dropped and recreated with
-- private.current_user_can_write() instead — is_active_member() alone no
-- longer implies write access, since observers are active members too.
-- SELECT policies are intentionally left untouched: observers read exactly
-- like members. profiles/app_members SELECT policies are the one exception
-- — those are additionally tightened so admin/observer rows never surface
-- to ordinary members (the "hidden account" requirement), not just to keep
-- write access out.

-- ---------------------------------------------------------------------
-- Role helper functions
-- ---------------------------------------------------------------------

create or replace function private.is_observer(
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_members as membership
    where membership.user_id = $1
      and membership.is_active = true
      and membership.role = 'observer'::public.membership_role
  );
$$;

create or replace function private.current_user_can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member() and not private.is_observer();
$$;

-- Whether target_user_id is a "visible" member (role = 'member') — used to
-- keep hidden admin/observer accounts out of profiles/app_members reads for
-- ordinary members, so they never appear via any query, join or error.
create or replace function private.is_visible_member(
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_members as membership
    where membership.user_id = target_user_id
      and membership.is_active = true
      and membership.role = 'member'::public.membership_role
  );
$$;

-- Public wrapper so the client can cheaply guard the /admin route without
-- fetching the full membership state.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function private.is_observer(uuid) from public, anon, authenticated;
revoke all on function private.current_user_can_write() from public, anon, authenticated;
revoke all on function private.is_visible_member(uuid) from public, anon, authenticated;
revoke all on function public.current_user_is_admin() from public, anon, authenticated;

grant execute on function private.is_observer(uuid) to authenticated;
grant execute on function private.current_user_can_write() to authenticated;
grant execute on function private.is_visible_member(uuid) to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- profiles / app_members — tightened SELECT (hide admin/observer rows)
-- ---------------------------------------------------------------------

drop policy if exists profiles_select_active_group on public.profiles;
create policy profiles_select_active_group
on public.profiles for select to authenticated
using (
  private.is_admin()
  or id = auth.uid()
  or (private.is_active_member() and private.is_visible_member(id))
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (
  private.is_admin()
  or (private.current_user_can_write() and id = auth.uid())
)
with check (
  private.is_admin()
  or (private.current_user_can_write() and id = auth.uid())
);

drop policy if exists app_members_select_visible_memberships on public.app_members;
create policy app_members_select_visible_memberships
on public.app_members for select to authenticated
using (
  private.is_admin()
  or user_id = auth.uid()
  or (private.is_active_member() and is_active = true and role = 'member'::public.membership_role)
);

-- app_members_insert_admin / _update_admin / _delete_admin already gate on
-- is_admin() alone — no is_active_member() reference, nothing to change.

-- ---------------------------------------------------------------------
-- games / game_expansions
-- ---------------------------------------------------------------------

drop policy if exists games_insert_owner_or_admin on public.games;
create policy games_insert_owner_or_admin
on public.games for insert to authenticated
with check (
  private.current_user_can_write()
  and (private.is_admin() or owner_id = auth.uid())
);

drop policy if exists games_update_owner_or_admin on public.games;
create policy games_update_owner_or_admin
on public.games for update to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or owner_id = auth.uid())
)
with check (
  private.current_user_can_write()
  and (private.is_admin() or owner_id = auth.uid())
);

drop policy if exists game_expansions_insert_owner_or_admin on public.game_expansions;
create policy game_expansions_insert_owner_or_admin
on public.game_expansions for insert to authenticated
with check (
  private.current_user_can_write()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
);

drop policy if exists game_expansions_update_owner_or_admin on public.game_expansions;
create policy game_expansions_update_owner_or_admin
on public.game_expansions for update to authenticated
using (
  private.current_user_can_write()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
)
with check (
  private.current_user_can_write()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
);

drop policy if exists game_expansions_delete_owner_or_admin on public.game_expansions;
create policy game_expansions_delete_owner_or_admin
on public.game_expansions for delete to authenticated
using (
  private.current_user_can_write()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------
-- ratings — own-record only today; extending with an admin bypass per
-- "admin może edytować i usuwać wszystkie rekordy niezależnie od autora".
-- ---------------------------------------------------------------------

drop policy if exists ratings_insert_own on public.ratings;
create policy ratings_insert_own
on public.ratings for insert to authenticated
with check (private.current_user_can_write() and user_id = auth.uid());

drop policy if exists ratings_update_own on public.ratings;
create policy ratings_update_own
on public.ratings for update to authenticated
using (private.current_user_can_write() and (private.is_admin() or user_id = auth.uid()))
with check (private.current_user_can_write() and (private.is_admin() or user_id = auth.uid()));

drop policy if exists ratings_delete_own on public.ratings;
create policy ratings_delete_own
on public.ratings for delete to authenticated
using (private.current_user_can_write() and (private.is_admin() or user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------

drop policy if exists meetings_insert_creator on public.meetings;
create policy meetings_insert_creator
on public.meetings for insert to authenticated
with check (private.current_user_can_write() and created_by = auth.uid());

drop policy if exists meetings_update_creator_or_admin on public.meetings;
create policy meetings_update_creator_or_admin
on public.meetings for update to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or created_by = auth.uid())
)
with check (
  private.current_user_can_write()
  and (private.is_admin() or created_by = auth.uid())
);

drop policy if exists meetings_delete_creator_or_admin on public.meetings;
create policy meetings_delete_creator_or_admin
on public.meetings for delete to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or created_by = auth.uid())
);

-- ---------------------------------------------------------------------
-- meeting_availability — own-record only today; adding admin bypass (same
-- rationale as ratings above).
-- ---------------------------------------------------------------------

drop policy if exists meeting_availability_insert_own on public.meeting_availability;
create policy meeting_availability_insert_own
on public.meeting_availability for insert to authenticated
with check (private.current_user_can_write() and user_id = auth.uid());

drop policy if exists meeting_availability_update_own on public.meeting_availability;
create policy meeting_availability_update_own
on public.meeting_availability for update to authenticated
using (private.current_user_can_write() and (private.is_admin() or user_id = auth.uid()))
with check (private.current_user_can_write() and (private.is_admin() or user_id = auth.uid()));

drop policy if exists meeting_availability_delete_own on public.meeting_availability;
create policy meeting_availability_delete_own
on public.meeting_availability for delete to authenticated
using (private.current_user_can_write() and (private.is_admin() or user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- meeting_game_votes — own-record only today; adding admin bypass to
-- delete (no update policy exists for votes — insert/delete only).
-- ---------------------------------------------------------------------

drop policy if exists meeting_game_votes_insert_own on public.meeting_game_votes;
create policy meeting_game_votes_insert_own
on public.meeting_game_votes for insert to authenticated
with check (private.current_user_can_write() and user_id = auth.uid());

drop policy if exists meeting_game_votes_delete_own on public.meeting_game_votes;
create policy meeting_game_votes_delete_own
on public.meeting_game_votes for delete to authenticated
using (private.current_user_can_write() and (private.is_admin() or user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- plays / play_participants
-- ---------------------------------------------------------------------

drop policy if exists plays_insert_creator on public.plays;
create policy plays_insert_creator
on public.plays for insert to authenticated
with check (private.current_user_can_write() and created_by = auth.uid());

drop policy if exists plays_update_creator_or_admin on public.plays;
create policy plays_update_creator_or_admin
on public.plays for update to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or created_by = auth.uid())
)
with check (
  private.current_user_can_write()
  and (private.is_admin() or created_by = auth.uid())
);

drop policy if exists plays_delete_creator_or_admin on public.plays;
create policy plays_delete_creator_or_admin
on public.plays for delete to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or created_by = auth.uid())
);

drop policy if exists play_participants_insert_parent_owner_or_admin on public.play_participants;
create policy play_participants_insert_parent_owner_or_admin
on public.play_participants for insert to authenticated
with check (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

drop policy if exists play_participants_update_parent_owner_or_admin on public.play_participants;
create policy play_participants_update_parent_owner_or_admin
on public.play_participants for update to authenticated
using (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
)
with check (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

drop policy if exists play_participants_delete_parent_owner_or_admin on public.play_participants;
create policy play_participants_delete_parent_owner_or_admin
on public.play_participants for delete to authenticated
using (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

-- ---------------------------------------------------------------------
-- point_events — admin's direct-insert bypass (used for manual point
-- adjustments) must never be usable to award points to a hidden account,
-- including the admin's own.
-- ---------------------------------------------------------------------

drop policy if exists point_events_insert_admin on public.point_events;
create policy point_events_insert_admin
on public.point_events for insert to authenticated
with check (
  private.is_admin()
  and created_by = auth.uid()
  and not private.is_admin(user_id)
  and not private.is_observer(user_id)
);

-- ---------------------------------------------------------------------
-- play_photos (table + storage.objects)
-- ---------------------------------------------------------------------

drop policy if exists play_photos_insert_owner_or_admin on public.play_photos;
create policy play_photos_insert_owner_or_admin
on public.play_photos for insert to authenticated
with check (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

drop policy if exists play_photos_update_owner_or_admin on public.play_photos;
create policy play_photos_update_owner_or_admin
on public.play_photos for update to authenticated
using (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
)
with check (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

drop policy if exists play_photos_delete_owner_or_admin on public.play_photos;
create policy play_photos_delete_owner_or_admin
on public.play_photos for delete to authenticated
using (
  private.current_user_can_write()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

drop policy if exists play_photos_storage_insert_owner_or_admin on storage.objects;
create policy play_photos_storage_insert_owner_or_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'play-photos'
  and private.current_user_can_write()
  and exists (
    select 1
    from public.plays
    where id::text = (storage.foldername(name))[1]
      and (created_by = auth.uid() or private.is_admin())
  )
);

drop policy if exists play_photos_storage_delete_owner_or_admin on storage.objects;
create policy play_photos_storage_delete_owner_or_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'play-photos'
  and private.current_user_can_write()
  and exists (
    select 1
    from public.plays
    where id::text = (storage.foldername(name))[1]
      and (created_by = auth.uid() or private.is_admin())
  )
);
