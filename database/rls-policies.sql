alter table public.profiles enable row level security;
alter table public.elections enable row level security;
alter table public.candidates enable row level security;
alter table public.voter_registry enable row level security;
alter table public.vote_blocks enable row level security;
alter table public.audit_logs enable row level security;

drop policy
if exists "Users can insert their own profile" on public.profiles;
drop policy
if exists "Users can read own profile" on public.profiles;
drop policy
if exists "Users can update own profile" on public.profiles;
drop policy
if exists "Admins can read all profiles" on public.profiles;

drop policy
if exists profiles_insert_own on public.profiles;
drop policy
if exists profiles_select_self_or_admin on public.profiles;
drop policy
if exists profiles_update_own on public.profiles;

drop policy
if exists "Anyone can read elections" on public.elections;
drop policy
if exists "Admins can create elections" on public.elections;
drop policy
if exists "Admins can update elections" on public.elections;
drop policy
if exists elections_read_all_authenticated on public.elections;
drop policy
if exists elections_admin_write on public.elections;

drop policy
if exists "Anyone can read candidates" on public.candidates;
drop policy
if exists "Admins can manage candidates" on public.candidates;
drop policy
if exists candidates_read_all_authenticated on public.candidates;
drop policy
if exists candidates_admin_write on public.candidates;

drop policy
if exists "Users can read their own registry" on public.voter_registry;
drop policy
if exists "Admins can manage voter registry" on public.voter_registry;
drop policy
if exists voter_registry_read_self_or_admin on public.voter_registry;
drop policy
if exists voter_registry_admin_manage on public.voter_registry;

drop policy
if exists "Anyone can read vote blocks" on public.vote_blocks;
drop policy
if exists vote_blocks_read_authenticated on public.vote_blocks;
drop policy
if exists vote_blocks_no_direct_insert on public.vote_blocks;

drop policy
if exists "Auditors and admins can read audit logs" on public.audit_logs;
drop policy
if exists audit_logs_read_admin_or_auditor on public.audit_logs;

create policy profiles_insert_own on public.profiles
for
insert
to authenticated
with check (
auth.uid()
= user_id);

create policy profiles_select_self_or_admin on public.profiles
for
select
    to authenticated
using
(
  auth.uid
() = user_id
  or exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy profiles_update_own on public.profiles
for
update
to authenticated
using (auth.uid() = user_id)
with check
(auth.uid
() = user_id);

create policy elections_read_all_authenticated on public.elections
for
select
    to authenticated
using
(auth.uid
() is not null);

create policy elections_admin_write on public.elections
for all
to authenticated
using
(
  exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check
(
  exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy candidates_read_all_authenticated on public.candidates
for
select
    to authenticated
using
(auth.uid
() is not null);

create policy candidates_admin_write on public.candidates
for all
to authenticated
using
(
  exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check
(
  exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy voter_registry_read_self_or_admin on public.voter_registry
for
select
    to authenticated
using
(
  voter_id = auth.uid
()
  or exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy voter_registry_admin_manage on public.voter_registry
for all
to authenticated
using
(
  exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check
(
  exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy vote_blocks_read_authenticated on public.vote_blocks
for
select
    to authenticated
using
(auth.uid
() is not null);

create policy vote_blocks_no_direct_insert on public.vote_blocks
for
insert
to authenticated
with check (
false);

create policy audit_logs_read_admin_or_auditor on public.audit_logs
for
select
    to authenticated
using
(
  exists
(
    select 1
from public.profiles p
where p.user_id = auth.uid() and p.role in ('admin', 'auditor')
  )
);

grant usage on schema public to authenticated;
grant select on public.elections, public.candidates, public.vote_blocks to authenticated;
grant select on public.voter_registry, public.audit_logs to authenticated;
grant execute on function public.cast_vote_secure
(uuid, uuid, text) to authenticated;
grant execute on function public.verify_chain
(uuid) to authenticated;
