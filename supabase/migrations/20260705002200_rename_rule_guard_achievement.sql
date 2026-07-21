insert into public.achievement_definitions (
  achievement_key,
  name,
  description,
  condition_text,
  rarity,
  points,
  icon_path,
  is_secret,
  is_manual,
  automation_status,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  'rule_quard',
  'Strażnik Zasad',
  description,
  condition_text,
  rarity,
  points,
  icon_path,
  is_secret,
  is_manual,
  automation_status,
  is_active,
  sort_order,
  created_at,
  now()
from public.achievement_definitions
where achievement_key = 'rule_paladin'
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
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.user_achievements (
  user_id,
  achievement_key,
  awarded_at,
  awarded_by,
  source_event_type,
  source_entity_id,
  note
)
select
  user_id,
  'rule_quard',
  awarded_at,
  awarded_by,
  source_event_type,
  source_entity_id,
  note
from public.user_achievements
where achievement_key = 'rule_paladin'
on conflict (user_id, achievement_key) do nothing;

insert into public.class_requirements (class_key, achievement_key)
select class_key, 'rule_quard'
from public.class_requirements
where achievement_key = 'rule_paladin'
on conflict (class_key, achievement_key) do nothing;

update public.point_events
set
  action_type = 'achievement_unlocked:rule_quard',
  description = 'Odznaka: Strażnik Zasad'
where action_type = 'achievement_unlocked:rule_paladin';

delete from public.user_achievements
where achievement_key = 'rule_paladin';

delete from public.class_requirements
where achievement_key = 'rule_paladin';

delete from public.achievement_definitions
where achievement_key = 'rule_paladin';
