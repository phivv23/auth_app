ALTER TABLE post_likes
ADD COLUMN reaction_type VARCHAR(20) NOT NULL DEFAULT 'like' AFTER user_id;
