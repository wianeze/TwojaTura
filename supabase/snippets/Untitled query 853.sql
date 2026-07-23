select
  p.display_name,
  u.email
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like 'qa-%@twojatura.local'
order by u.email;