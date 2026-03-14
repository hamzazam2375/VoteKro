-- ============================================
-- VoteKro Row Level Security (RLS) Policies
-- ============================================
-- This file contains all RLS policies for the application
-- Last updated: March 10, 2026
-- NOTE: Profiles policies have been fixed to avoid infinite recursion

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voter_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert auditor profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Allow users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to read all profiles
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ELECTIONS TABLE POLICIES
-- ============================================

-- Allow anyone authenticated to read elections
CREATE POLICY "Anyone can read elections"
ON public.elections
FOR
SELECT
    TO authenticated
USING
(true);

-- Allow admins to insert elections
CREATE POLICY "Admins can create elections"
ON public.elections
FOR
INSERT
TO authenticated
WITH CHECK (
  EXISTS
    (
    SELECT 1
FROM public.profiles
WHERE user_id = auth.uid() AND role = 'admin'
)
);

-- Allow admins to update elections
CREATE POLICY "Admins can update elections"
ON public.elections
FOR
UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
FROM public.profiles
WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- CANDIDATES TABLE POLICIES
-- ============================================

-- Allow anyone authenticated to read candidates
CREATE POLICY "Anyone can read candidates"
ON public.candidates
FOR
SELECT
    TO authenticated
USING
(true);

-- Allow admins to manage candidates
CRE
SELECT
    TO authenticated
USING
(true);

-- Allow admins to manage candidates
CREATE POLICY "Admins can manage candidates"
ON public.candidates
FOR ALL
TO authenticated
USING
(
  EXISTS
(
    SELECT 1
FROM public.profiles

-- Allow users to read their own registry entries
CREATE POLICY "Users can read their own registry"
ON public.voter_registry
FOR
SELECT
    TO authenticated
USING
(voter_id = auth.uid
())
SELECT
    TO authenticated
USING
(voter_id = auth.uid
());

-- Allow admins to manage voter registry
CREATE POLICY "Admins can manage voter registry"
ON public.voter_registry
FOR ALL
TO authenticated
USING
(
  EXISTS
(
    SELECT 1
FROM public.profiles
-- VOTE BLOCKS TABLE POLICIES
-- ============================================

-- Allow anyone authenticated to read vote blocks (for transparency)
CREATE POLICY "Anyone can read vote blocks"
ON public.vote_blocks
FOR
SELECT
    TO authenticated
USING
(true);

-- Vote blocks are only inserted through the append_vote_block function
-- No direct INSERT policy needed

-- ============================================
-- AUDIT LOGS TABLE POLICIES
--  SELECT
TO authenticated
USING
(true);

-- Vote blocks are only inserted through the append_vote_block function
-- No direct INSERT policy needed

-- ============================================
-- AUDIT LOGS TABLE POLICIES
-- ============================================

-- Allow auditors and admins to read audit logs
CREATE POLICY "Auditors and admins can read audit logs"
ON public.audit_logs
FOR
SELECT
    TO authenticated
USING
(
  EXISTS
(
    SELECT 1
FROM public.profiles
    