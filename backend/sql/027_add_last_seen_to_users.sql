ALTER TABLE users
  ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL AFTER profile_privacy,
  ADD INDEX users_last_seen_at_index (last_seen_at);
