-- Quick Setup: Create Test Users for VoteKro
-- Run this in Supabase SQL Editor to create test accounts

-- TEST ADMIN USER
DO $$ 
DECLARE 
  v_admin_id uuid;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, email_confirmed_at, 
    encrypted_password, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@votekro.test',
    NOW(),
    crypt('Admin@123', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW()
  ) RETURNING id INTO v_admin_id;

  INSERT INTO public.profiles (user_id, full_name, role, is_verified)
  VALUES (v_admin_id, 'Admin User', 'admin', true);
  
  RAISE NOTICE '✓ Admin created: admin@votekro.test / Admin@123';
END $$;

-- TEST AUDITOR USER
DO $$ 
DECLARE 
  v_auditor_id uuid;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, email_confirmed_at, 
    encrypted_password, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'auditor@votekro.test',
    NOW(),
    crypt('Auditor@123', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW()
  ) RETURNING id INTO v_auditor_id;

  INSERT INTO public.profiles (user_id, full_name, role, is_verified)
  VALUES (v_auditor_id, 'Auditor User', 'auditor', true);
  
  RAISE NOTICE '✓ Auditor created: auditor@votekro.test / Auditor@123';
END $$;

-- TEST VOTER USER
DO $$ 
DECLARE 
  v_voter_id uuid;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, email_confirmed_at, 
    encrypted_password, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'voter@votekro.test',
    NOW(),
    crypt('Voter@123', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW()
  ) RETURNING id INTO v_voter_id;

  INSERT INTO public.profiles (user_id, full_name, role, is_verified)
  VALUES (v_voter_id, 'Voter User', 'voter', true);
  
  RAISE NOTICE '✓ Voter created: voter@votekro.test / Voter@123';
END $$;

-- Verify test users were created
SELECT 
  email, 
  email_confirmed_at as confirmed_at,
  created_at
FROM auth.users 
WHERE email LIKE '%@votekro.test'
ORDER BY created_at DESC;
