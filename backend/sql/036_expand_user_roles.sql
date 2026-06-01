ALTER TABLE users
  DROP CHECK users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'moderator', 'admin', 'super_admin'));
