ALTER TABLE posts
ADD COLUMN shared_post_id INT UNSIGNED NULL AFTER user_id,
ADD INDEX posts_shared_post_id_index (shared_post_id),
ADD CONSTRAINT posts_shared_post_id_fk
  FOREIGN KEY (shared_post_id)
  REFERENCES posts(id)
  ON DELETE SET NULL;
