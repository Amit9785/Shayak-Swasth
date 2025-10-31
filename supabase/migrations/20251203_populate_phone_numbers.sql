-- Migration to populate phone numbers from auth metadata
-- This will fill in phone numbers that might be missing from profiles

-- First, let's see what we're working with
-- SELECT id, first_name, last_name, phone, email FROM profiles;

-- Update profiles with phone from auth.users metadata if profile phone is null or empty
DO $$
DECLARE
    user_record RECORD;
    phone_from_meta TEXT;
BEGIN
    FOR user_record IN 
        SELECT 
            au.id,
            au.phone as auth_phone,
            au.raw_user_meta_data->>'phone' as meta_phone,
            p.phone as profile_phone
        FROM auth.users au
        LEFT JOIN public.profiles p ON p.id = au.id
        WHERE p.id IS NOT NULL 
          AND (p.phone IS NULL OR p.phone = '')
    LOOP
        -- Try to get phone from metadata first, then from auth.users.phone
        phone_from_meta := COALESCE(
            NULLIF(user_record.meta_phone, ''),
            NULLIF(user_record.auth_phone, '')
        );
        
        IF phone_from_meta IS NOT NULL THEN
            UPDATE public.profiles 
            SET phone = phone_from_meta
            WHERE id = user_record.id;
            RAISE NOTICE 'Updated phone for user %: %', user_record.id, phone_from_meta;
        END IF;
    END LOOP;
END $$;

-- Grant doctors explicit permission to see phone numbers
-- (should already be covered by "Doctors can view all profiles" policy)

-- Verify the update
-- SELECT id, first_name, last_name, phone FROM profiles WHERE phone IS NOT NULL AND phone != '';

