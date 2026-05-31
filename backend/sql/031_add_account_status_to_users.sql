ALTER TABLE users
  ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER role,
  ADD INDEX users_account_status_index (account_status),
  ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active', 'suspended', 'banned'));
