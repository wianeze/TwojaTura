-- Local QA fixtures use the server-only service-role client. BYPASSRLS does not
-- replace table privileges, so grant only the operations used by the fixture
-- builder. These grants do not expose anything to anon or authenticated.
grant select, insert, update on table
  public.profiles,
  public.app_members
to service_role;

grant select, insert, update, delete on table
  public.games,
  public.meetings,
  public.ratings,
  public.meeting_availability,
  public.meeting_game_votes,
  public.plays,
  public.play_participants
to service_role;

grant select, insert, update, delete on table public.user_achievements to service_role;

grant select, insert on table public.point_events to service_role;

grant select on table
  public.achievement_definitions,
  public.class_definitions,
  public.class_requirements
to service_role;
