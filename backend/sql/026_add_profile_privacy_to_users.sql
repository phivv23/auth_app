ALTER TABLE users
  ADD COLUMN profile_privacy VARCHAR(20) NOT NULL DEFAULT 'public' AFTER website,
  ADD INDEX users_profile_privacy_index (profile_privacy);
