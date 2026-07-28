-- Etap D1: adds the third membership_role value. This must be its own
-- migration file/transaction — Postgres does not allow a newly added enum
-- value to be referenced (in a function body, policy, etc.) within the same
-- transaction that added it. All uses of 'observer' live in the next
-- migration.
alter type public.membership_role add value 'observer';
