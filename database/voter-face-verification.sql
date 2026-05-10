-- Add face detection and verification support for voter registration and login

-- Create a table to store voter face images for biometric verification
-- Create table
create table if not exists public.voter_faces (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.profiles (user_id) on delete cascade,
  face_image_base64 text not null,
  captured_at timestamptz not null default timezone('utc', now()),
  is_primary boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Allow only one primary face per voter
create unique index if not exists idx_voter_faces_one_primary
on public.voter_faces (voter_id)
where is_primary = true;

-- Other indexes
create index if not exists idx_voter_faces_voter_id
on public.voter_faces (voter_id);

create index if not exists idx_voter_faces_primary
on public.voter_faces (voter_id, is_primary);

-- Add face verification column to profiles
alter table public.profiles add column if not exists face_verified boolean not null default false;
alter table public.profiles add column if not exists face_capture_attempted boolean not null default false;

-- Create a trigger to update the updated_at timestamp for voter_faces
create or replace trigger trg_voter_faces_updated_at
before update on public.voter_faces
for each row execute function public.touch_updated_at();

-- Enable RLS on voter_faces table
alter table public.voter_faces enable row level security;

-- RLS policies for voter_faces
-- Users can read their own face data
create policy voter_faces_read_own on public.voter_faces
  for select
  using (voter_id = auth.uid());

-- Admins and auditors can read all face data for verification purposes
create policy voter_faces_read_admin on public.voter_faces
  for select
  using (exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role in ('admin', 'auditor')
  ));

-- Users can insert their own face data
create policy voter_faces_insert_own on public.voter_faces
  for insert
  with check (voter_id = auth.uid());

-- Users can update their own face data
create policy voter_faces_update_own on public.voter_faces
  for update
  using (voter_id = auth.uid())
  with check (voter_id = auth.uid());

-- Admins can manage face data
create policy voter_faces_admin_manage on public.voter_faces
  for all
  using (exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  ));

grant select, insert, update on public.voter_faces to authenticated;
grant select on public.voter_faces to anon;
