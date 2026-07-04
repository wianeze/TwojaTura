select
  u.email,
  fields.field_name
from auth.users u
cross join lateral (
  values
    ('confirmation_token', u.confirmation_token is null),
    ('recovery_token', u.recovery_token is null),
    ('email_change', u.email_change is null),
    ('email_change_token_new', u.email_change_token_new is null)
) as fields(field_name, is_null)
where u.email like '%@twojatura.local'
  and fields.is_null
order by u.email, fields.field_name;