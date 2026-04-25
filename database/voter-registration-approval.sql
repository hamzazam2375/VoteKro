-- Run this in Supabase SQL editor before deploying voter registration approval functions.

create table if not exists public.voter_registration_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  generated_password text not null,
  approval_token text not null unique,
  requested_by uuid null,
  completed_user_id uuid null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists voter_registration_requests_email_idx
  on public.voter_registration_requests (email);

create index if not exists voter_registration_requests_status_idx
  on public.voter_registration_requests (status);

create index if not exists voter_registration_requests_expires_at_idx
  on public.voter_registration_requests (expires_at);

create or replace function public.set_voter_registration_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_voter_registration_requests_updated_at
on public.voter_registration_requests;

create trigger trg_set_voter_registration_requests_updated_at
before update on public.voter_registration_requests
for each row execute function public.set_voter_registration_requests_updated_at();

alter table public.voter_registration_requests enable row level security;

-- Block direct reads/writes from anon/authenticated users.
drop policy if exists voter_registration_requests_no_access on public.voter_registration_requests;
create policy voter_registration_requests_no_access
on public.voter_registration_requests
for all
to anon, authenticated
using (false)
with check (false);
