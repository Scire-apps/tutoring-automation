-- Scire conventions (§1.1, §1.2): private schema + grants, the 10 enums, and
-- the shared set_updated_at trigger fn. All functions live in the non-exposed
-- `private` schema, SECURITY DEFINER, SET search_path=''.

-- Private schema: not in PostgREST's exposed schemas; USAGE + EXECUTE to
-- authenticated only (policy evaluation needs it), default-deny for future fns.
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke all on functions from public;
revoke execute on all functions in schema private from public, anon;

-- (§1.2) Native enums for closed lifecycle vocabularies.
create type public.account_kind as enum ('member', 'manager', 'admin');
create type public.account_status as enum ('pending', 'active', 'suspended', 'rejected');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'withdrawn', 'revoked');
create type public.session_status as enum (
  'open', 'claimed', 'availability_set', 'scheduled',
  'completed', 'needs_changes', 'verified', 'cancelled'
);
create type public.priority_level as enum ('low', 'normal', 'high');
create type public.urgency_level as enum ('low', 'normal', 'high');
create type public.help_status as enum ('open', 'resolved');
create type public.ledger_kind as enum ('award', 'adjustment');
create type public.email_status as enum ('sent', 'failed');
create type public.location_preference as enum ('online', 'in_person');

-- Shared updated_at trigger (mutable tables only).
create function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
