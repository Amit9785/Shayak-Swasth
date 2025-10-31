-- Check if profiles have phone numbers
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.email,
  pt.medical_id
FROM profiles p
LEFT JOIN patients pt ON pt.user_id = p.id
WHERE pt.id IS NOT NULL;

