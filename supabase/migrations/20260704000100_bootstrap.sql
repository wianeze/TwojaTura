create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create type public.membership_role as enum ('member', 'admin');
create type public.game_status as enum ('available', 'unavailable', 'loaned');
create type public.meeting_status as enum ('planned', 'confirmed', 'completed');
