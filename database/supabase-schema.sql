-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- USER ROLE TYPE
-- =========================================================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
  ) then
    create type public.user_role as enum ('admin', 'voter', 'auditor');
  end if;
end
$$;

-- =========================================================
-- PROFILES
-- =========================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'voter',
  voter_code_hash text,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint voter_hash_length check (
    voter_code_hash is null or char_length(voter_code_hash) = 64
  )
);

-- =========================================================
-- PROFILE FUNCTIONS
-- =========================================================
create or replace function public.get_profile_by_user_id(p_user_id uuid)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  select * from public.profiles
  where user_id = p_user_id
  limit 1;
$$;

create or replace function public.get_first_profile_by_role(p_role public.user_role)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  select * from public.profiles
  where role = p_role
  limit 1;
$$;

create or replace function public.count_profiles_by_role(p_role public.user_role)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.profiles
  where role = p_role;
$$;

-- =========================================================
-- ELECTIONS
-- =========================================================
create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references public.profiles (user_id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint election_window_valid check (ends_at > starts_at)
);

-- =========================================================
-- CANDIDATES
-- =========================================================
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  display_name text not null,
  party_name text,
  candidate_number int not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (election_id, candidate_number)
);

-- =========================================================
-- VOTER REGISTRY
-- =========================================================
create table if not exists public.voter_registry (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  voter_id uuid not null references public.profiles (user_id) on delete cascade,
  is_eligible boolean not null default true,
  has_voted boolean not null default false,
  voted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (election_id, voter_id)
);

-- =========================================================
-- BLOCKCHAIN STYLE VOTE LEDGER
-- =========================================================
create table if not exists public.vote_blocks (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  voter_id uuid references public.profiles (user_id) on delete set null,
  block_index bigint not null,
  encrypted_vote text not null,
  vote_commitment text not null,
  nonce text not null,
  previous_hash text not null,
  current_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (election_id, block_index),
  unique (current_hash),
  constraint hash_length_check check (
    char_length(previous_hash) = 64 and char_length(current_hash) = 64
  ),
  constraint commitment_length_check check (
    char_length(vote_commitment) = 64
  ),
  constraint nonce_length_check check (
    char_length(nonce) > 0
  )
);

create index if not exists idx_vote_blocks_election_idx
on public.vote_blocks (election_id, block_index);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (user_id),
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace trigger trg_elections_updated_at
before update on public.elections
for each row execute function public.touch_updated_at();

-- =========================================================
-- BLOCK HASH FUNCTION (FIXED DIGEST ISSUE)
-- =========================================================
create or replace function public.compute_block_hash(
  p_block_index bigint,
  p_encrypted_vote text,
  p_vote_commitment text,
  p_previous_hash text,
  p_created_at timestamptz
)
returns text
language sql
immutable
as $$
  select encode(
    digest(
      (
        concat_ws('|',
          p_block_index::text,
          p_encrypted_vote,
          p_vote_commitment,
          p_previous_hash,
          to_char(p_created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        )
      )::bytea,
      'sha256'
    ),
    'hex'
  );
$$;

-- =========================================================
-- APPEND BLOCK FUNCTION
-- =========================================================
create or replace function public.append_vote_block(
  p_election_id uuid,
  p_voter_id uuid,
  p_encrypted_vote text,
  p_vote_commitment text,
  p_nonce text
)
returns public.vote_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_hash text := repeat('0', 64);
  v_next_index bigint := 0;
  v_now timestamptz := timezone('utc', now());
  v_curr_hash text;
  v_block public.vote_blocks;
begin
  perform pg_advisory_xact_lock(hashtext(p_election_id::text));

  select vb.current_hash, vb.block_index + 1
  into v_prev_hash, v_next_index
  from public.vote_blocks vb
  where vb.election_id = p_election_id
  order by vb.block_index desc
  limit 1
  for update;

  v_curr_hash := public.compute_block_hash(
    v_next_index,
    p_encrypted_vote,
    p_vote_commitment,
    coalesce(v_prev_hash, repeat('0', 64)),
    v_now
  );

  insert into public.vote_blocks (
    election_id,
    voter_id,
    block_index,
    encrypted_vote,
    vote_commitment,
    nonce,
    previous_hash,
    current_hash,
    created_at
  )
  values (
    p_election_id,
    p_voter_id,
    v_next_index,
    p_encrypted_vote,
    p_vote_commitment,
    p_nonce,
    coalesce(v_prev_hash, repeat('0', 64)),
    v_curr_hash,
    v_now
  )
  returning * into v_block;

  return v_block;
end;
$$;