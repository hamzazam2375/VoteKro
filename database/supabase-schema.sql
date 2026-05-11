
create extension if not exists pgcrypto;

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

create or replace function public.get_profile_by_user_id(p_user_id uuid)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  select *
  from public.profiles
  where user_id = p_user_id
  limit 1;
$$;

create or replace function public.get_first_profile_by_role(p_role public.user_role)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  select *
  from public.profiles
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

-- When a new voter profile is created, automatically register them for all existing elections
create or replace function public.register_voter_for_all_elections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only trigger for voter role profiles
  if new.role = 'voter' then
    insert into public.voter_registry (election_id, voter_id, is_eligible, has_voted)
    select id, new.user_id, true, false
    from public.elections
    on conflict (election_id, voter_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_register_voter_for_all_elections on public.profiles;
create trigger trg_register_voter_for_all_elections
after insert on public.profiles
for each row execute function public.register_voter_for_all_elections();

-- When a new election is created, automatically register all voters
create or replace function public.register_all_voters_for_election()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.voter_registry (election_id, voter_id, is_eligible, has_voted)
  select new.id, user_id, true, false
  from public.profiles
  where role = 'voter'
  on conflict (election_id, voter_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_register_all_voters_for_election on public.elections;
create trigger trg_register_all_voters_for_election
after insert on public.elections
for each row execute function public.register_all_voters_for_election();

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

  if timezone('utc', now()) < v_election.starts_at
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

  v_block := public.append_vote_block(
    p_election_id,
    v_uid,
    v_encrypted_vote,
    v_vote_commitment,
    v_nonce
  );

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

-- Tallies votes using the same symmetric key as cast_vote_secure (server-side decrypt).
-- Client-side OpenPGP often cannot decrypt PostgreSQL pgp_sym_encrypt payloads.
create or replace function public.tally_vote_blocks_decrypted(
  p_election_id uuid,
  p_encryption_key text default null
)
returns table (
  candidate_id uuid,
  vote_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  rec record;
  v_plain text;
  v_json jsonb;
  v_cand_id text;
  v_counts jsonb := '{}'::jsonb;
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_secret := coalesce(
    nullif(trim(coalesce(p_encryption_key, '')), ''),
    nullif(trim(current_setting('app.vote_encryption_key', true)), '')
  );

  if v_secret is null or char_length(v_secret) = 0 then
    return;
  end if;

  for rec in
    select vb.encrypted_vote
    from public.vote_blocks vb
    where vb.election_id = p_election_id
  loop
    begin
      v_plain := convert_from(
        pgp_sym_decrypt(decode(rec.encrypted_vote, 'base64'), v_secret),
        'utf8'
      );
      v_json := v_plain::jsonb;
      v_cand_id := v_json->>'candidate_id';
      if v_cand_id is not null and v_cand_id <> '' then
        v_counts := jsonb_set(
          v_counts,
          array[v_cand_id],
          to_jsonb(coalesce((v_counts->>v_cand_id)::int, 0) + 1),
          true
        );
      end if;
    exception
      when others then
        null;
    end;
  end loop;

  for v_key in select jsonb_object_keys(v_counts)
  loop
    candidate_id := v_key::uuid;
    vote_count := (v_counts->>v_key)::bigint;
    return next;
  end loop;
end;
$$;

-- Returns the authenticated voter's decrypted receipt for one election (their row only).
create or replace function public.get_my_vote_receipt_decrypted(
  p_election_id uuid,
  p_encryption_key text default null
)
returns table (
  current_hash text,
  created_at timestamptz,
  candidate_id uuid,
  block_index bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_block public.vote_blocks;
  v_plain text;
  v_json jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_secret := coalesce(
    nullif(trim(coalesce(p_encryption_key, '')), ''),
    nullif(trim(current_setting('app.vote_encryption_key', true)), '')
  );

  if v_secret is null or char_length(v_secret) = 0 then
    return;
  end if;

  select vb.*
  into v_block
  from public.vote_blocks vb
  where vb.election_id = p_election_id
    and vb.voter_id = auth.uid()
  order by vb.block_index desc
  limit 1;

  if not found then
    return;
  end if;

  begin
    v_plain := convert_from(
      pgp_sym_decrypt(decode(v_block.encrypted_vote, 'base64'), v_secret),
      'utf8'
    );
    v_json := v_plain::jsonb;
    return query
    select
      v_block.current_hash,
      v_block.created_at,
      (v_json->>'candidate_id')::uuid,
      v_block.block_index;
  exception
    when others then
      return;
  end;
end;
$$;

