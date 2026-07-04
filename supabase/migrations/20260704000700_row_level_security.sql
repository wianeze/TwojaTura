alter table public.profiles enable row level security;
alter table public.app_members enable row level security;
alter table public.app_content enable row level security;
alter table public.games enable row level security;
alter table public.ratings enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_options enable row level security;
alter table public.meeting_availability enable row level security;
alter table public.meeting_game_votes enable row level security;
alter table public.plays enable row level security;
alter table public.play_participants enable row level security;
alter table public.point_events enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_active_group
on public.profiles for select to authenticated
using (
  private.is_admin()
  or (
    private.is_active_member()
    and exists (
      select 1
      from public.app_members as membership
      where membership.user_id = profiles.id
        and membership.is_active = true
    )
  )
);

create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (
  private.is_admin()
  or (private.is_active_member() and id = auth.uid())
)
with check (
  private.is_admin()
  or (private.is_active_member() and id = auth.uid())
);

create policy app_members_select_visible_memberships
on public.app_members for select to authenticated
using (
  private.is_admin()
  or (private.is_active_member() and is_active = true)
);

create policy app_members_insert_admin
on public.app_members for insert to authenticated
with check (private.is_admin());

create policy app_members_update_admin
on public.app_members for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy app_members_delete_admin
on public.app_members for delete to authenticated
using (private.is_admin());

create policy app_content_select_members
on public.app_content for select to authenticated
using (private.is_active_member());

create policy app_content_insert_admin
on public.app_content for insert to authenticated
with check (private.is_admin() and updated_by = auth.uid());

create policy app_content_update_admin
on public.app_content for update to authenticated
using (private.is_admin())
with check (private.is_admin() and updated_by = auth.uid());

create policy app_content_delete_admin
on public.app_content for delete to authenticated
using (private.is_admin());

create policy games_select_members
on public.games for select to authenticated
using (private.is_active_member());

create policy games_insert_owner_or_admin
on public.games for insert to authenticated
with check (
  private.is_active_member()
  and (private.is_admin() or owner_id = auth.uid())
);

create policy games_update_owner_or_admin
on public.games for update to authenticated
using (
  private.is_active_member()
  and (private.is_admin() or owner_id = auth.uid())
)
with check (
  private.is_active_member()
  and (private.is_admin() or owner_id = auth.uid())
);

create policy ratings_select_members
on public.ratings for select to authenticated
using (private.is_active_member());

create policy ratings_insert_own
on public.ratings for insert to authenticated
with check (private.is_active_member() and user_id = auth.uid());

create policy ratings_update_own
on public.ratings for update to authenticated
using (private.is_active_member() and user_id = auth.uid())
with check (private.is_active_member() and user_id = auth.uid());

create policy ratings_delete_own
on public.ratings for delete to authenticated
using (private.is_active_member() and user_id = auth.uid());

create policy meetings_select_members
on public.meetings for select to authenticated
using (private.is_active_member());

create policy meetings_insert_creator
on public.meetings for insert to authenticated
with check (private.is_active_member() and created_by = auth.uid());

create policy meetings_update_creator_or_admin
on public.meetings for update to authenticated
using (
  private.is_active_member()
  and (private.is_admin() or created_by = auth.uid())
)
with check (
  private.is_active_member()
  and (private.is_admin() or created_by = auth.uid())
);

create policy meetings_delete_creator_or_admin
on public.meetings for delete to authenticated
using (
  private.is_active_member()
  and (private.is_admin() or created_by = auth.uid())
);

create policy meeting_options_select_members
on public.meeting_options for select to authenticated
using (private.is_active_member());

create policy meeting_options_insert_parent_owner_or_admin
on public.meeting_options for insert to authenticated
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_options.meeting_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy meeting_options_update_parent_owner_or_admin
on public.meeting_options for update to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_options.meeting_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
)
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_options.meeting_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy meeting_options_delete_parent_owner_or_admin
on public.meeting_options for delete to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_options.meeting_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy meeting_availability_select_members
on public.meeting_availability for select to authenticated
using (private.is_active_member());

create policy meeting_availability_insert_own
on public.meeting_availability for insert to authenticated
with check (private.is_active_member() and user_id = auth.uid());

create policy meeting_availability_update_own
on public.meeting_availability for update to authenticated
using (private.is_active_member() and user_id = auth.uid())
with check (private.is_active_member() and user_id = auth.uid());

create policy meeting_availability_delete_own
on public.meeting_availability for delete to authenticated
using (private.is_active_member() and user_id = auth.uid());

create policy meeting_game_votes_select_members
on public.meeting_game_votes for select to authenticated
using (private.is_active_member());

create policy meeting_game_votes_insert_own
on public.meeting_game_votes for insert to authenticated
with check (private.is_active_member() and user_id = auth.uid());

create policy meeting_game_votes_delete_own
on public.meeting_game_votes for delete to authenticated
using (private.is_active_member() and user_id = auth.uid());

create policy plays_select_members
on public.plays for select to authenticated
using (private.is_active_member());

create policy plays_insert_creator
on public.plays for insert to authenticated
with check (private.is_active_member() and created_by = auth.uid());

create policy plays_update_creator_or_admin
on public.plays for update to authenticated
using (
  private.is_active_member()
  and (private.is_admin() or created_by = auth.uid())
)
with check (
  private.is_active_member()
  and (private.is_admin() or created_by = auth.uid())
);

create policy plays_delete_creator_or_admin
on public.plays for delete to authenticated
using (
  private.is_active_member()
  and (private.is_admin() or created_by = auth.uid())
);

create policy play_participants_select_members
on public.play_participants for select to authenticated
using (private.is_active_member());

create policy play_participants_insert_parent_owner_or_admin
on public.play_participants for insert to authenticated
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy play_participants_update_parent_owner_or_admin
on public.play_participants for update to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
)
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy play_participants_delete_parent_owner_or_admin
on public.play_participants for delete to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_participants.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy point_events_select_own_or_admin
on public.point_events for select to authenticated
using (
  private.is_active_member()
  and (private.is_admin() or user_id = auth.uid())
);

create policy point_events_insert_admin
on public.point_events for insert to authenticated
with check (
  private.is_admin()
  and created_by = auth.uid()
);

create policy audit_log_select_admin
on public.audit_log for select to authenticated
using (private.is_admin());

