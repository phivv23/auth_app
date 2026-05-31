ALTER TABLE users
  ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user' AFTER token_version,
  ADD INDEX users_role_index (role),
  ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
