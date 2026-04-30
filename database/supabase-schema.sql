
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'voter', 'auditor');
create type public.election_status as enum ('draft', 'open', 'closed', 'published');

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'voter',
  voter_code_hash text,
  is_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint voter_hash_length check (voter_code_hash is null or char_length(voter_code_hash) = 64)
);

create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.election_status not null default 'draft',
  created_by uuid not null references public.profiles (user_id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint election_window_valid check (ends_at > starts_at)
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  display_name text not null,
  party_name text,
  candidate_number int not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (election_id, candidate_number)
);

-- Tracks election eligibility and vote status while keeping vote choice anonymous.
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

-- Immutable blockchain-style ledger of encrypted votes.
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
  constraint hash_length_check check (char_length(previous_hash) = 64 and char_length(current_hash) = 64),
  constraint commitment_length_check check (char_length(vote_commitment) = 64),
  constraint nonce_length_check check (char_length(nonce) > 0)
);

create index if not exists idx_vote_blocks_election_idx on public.vote_blocks (election_id, block_index);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (user_id),
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

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
      concat_ws('|', 
        p_block_index::text, 
        p_encrypted_vote, 
        p_vote_commitment, 
        p_previous_hash, 
        to_char(p_created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

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

drop function if exists public.cast_vote_secure(uuid, text, text);
drop function if exists public.cast_vote_secure(uuid, text, text, text);

create or replace function public.cast_vote_secure(
  p_election_id uuid,
  p_candidate_id uuid,
  p_nonce text default null,
  p_encryption_key text default null
)
returns public.vote_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_election public.elections;
  v_block public.vote_blocks;
  v_secret text;
  v_nonce text;
  v_plain_vote text;
  v_encrypted_vote text;
  v_vote_commitment text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Try to get encryption key from parameter, then from app setting, then fail
  v_secret := coalesce(
    nullif(trim(coalesce(p_encryption_key, '')), ''),
    current_setting('app.vote_encryption_key', true)
  );
  
  if v_secret is null or char_length(trim(v_secret)) = 0 then
    raise exception 'Vote encryption key is not configured. Set app.vote_encryption_key or pass encryption key as parameter.';
  end if;

  select *
  into v_election
  from public.elections e
  where e.id = p_election_id;

  if not found then
    raise exception 'Election not found';
  end if;

  if v_election.status <> 'open'
     or timezone('utc', now()) < v_election.starts_at
     or timezone('utc', now()) > v_election.ends_at then
    raise exception 'Election is not accepting votes right now';
  end if;

  if not exists (
    select 1
    from public.candidates c
    where c.id = p_candidate_id
      and c.election_id = p_election_id
  ) then
    raise exception 'Candidate is invalid for this election';
  end if;

  insert into public.voter_registry (election_id, voter_id, is_eligible, has_voted)
  values (p_election_id, v_uid, true, false)
  on conflict (election_id, voter_id) do nothing;

  update public.voter_registry vr
  set has_voted = true,
      voted_at = timezone('utc', now())
  where vr.election_id = p_election_id
    and vr.voter_id = v_uid
    and vr.is_eligible = true
    and vr.has_voted = false;

  if not found then
    raise exception 'Voter not eligible or already voted';
  end if;

  v_nonce := coalesce(nullif(trim(p_nonce), ''), encode(gen_random_bytes(16), 'hex'));
  v_vote_commitment := encode(digest(concat_ws('|', p_election_id::text, p_candidate_id::text, v_nonce), 'sha256'), 'hex');

  v_plain_vote := jsonb_build_object(
    'election_id', p_election_id,
    'candidate_id', p_candidate_id,
    'voter_id', v_uid,
    'submitted_at', timezone('utc', now())
  )::text;

  v_encrypted_vote := encode(
    pgp_sym_encrypt(v_plain_vote, v_secret, 'cipher-algo=aes256,compress-algo=1'),
    'base64'
  );

  v_block := public.append_vote_block(p_election_id, v_encrypted_vote, v_vote_commitment, v_nonce);

  insert into public.audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    v_uid,
    'CAST_VOTE',
    'vote_blocks',
    v_block.id::text,
    jsonb_build_object(
      'election_id', p_election_id,
      'candidate_id', p_candidate_id,
      'block_index', v_block.block_index
    )
  );

  return v_block;
end;
$$;

create or replace function public.verify_chain(p_election_id uuid)
returns table (
  is_valid boolean,
  invalid_block_index bigint,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_expected_prev text := repeat('0', 64);
  v_expected_hash text;
begin
  for rec in
    select *
    from public.vote_blocks vb
    where vb.election_id = p_election_id
    order by vb.block_index asc
  loop
    if rec.previous_hash <> v_expected_prev then
      return query select false, rec.block_index, 'previous_hash mismatch';
      return;
    end if;

    v_expected_hash := public.compute_block_hash(
      rec.block_index,
      rec.encrypted_vote,
      rec.vote_commitment,
      rec.previous_hash,
      rec.created_at
    );

    if rec.current_hash <> v_expected_hash then
      return query select false, rec.block_index, 'current_hash mismatch';
      return;
    end if;

    v_expected_prev := rec.current_hash;
  end loop;

  return query select true, null::bigint, null::text;
end;
$$;

alter table public.profiles enable row level security;
alter table public.elections enable row level security;
alter table public.candidates enable row level security;
alter table public.voter_registry enable row level security;
alter table public.vote_blocks enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles
for select
using (auth.uid() = user_id);

create policy profiles_update_own on public.profiles
for update
using (auth.uid() = user_id);

create policy elections_read_all_authenticated on public.elections
for select
using (auth.uid() is not null);

create policy elections_admin_write on public.elections
for all
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy candidates_read_all_authenticated on public.candidates
for select
using (auth.uid() is not null);

create policy candidates_admin_write on public.candidates
for all
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy voter_registry_read_self_or_admin on public.voter_registry
for select
using (
  voter_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy voter_registry_admin_manage on public.voter_registry
for all
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy vote_blocks_read_authenticated on public.vote_blocks
for select
using (auth.uid() is not null);

-- Prevent direct inserts from clients; use cast_vote_secure RPC only.
create policy vote_blocks_no_direct_insert on public.vote_blocks
for insert
with check (false);

create policy audit_logs_read_admin_or_auditor on public.audit_logs
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role in ('admin', 'auditor')
  )
);

grant usage on schema public to authenticated;
grant select on public.elections, public.candidates, public.vote_blocks to authenticated;
grant select on public.voter_registry, public.audit_logs to authenticated;
grant execute on function public.cast_vote_secure(uuid, uuid, text) to authenticated;
grant execute on function public.verify_chain(uuid) to authenticated;
