UPDATE users
SET role = 'super_admin'
WHERE role = 'admin'
ORDER BY id ASC
LIMIT 1;
