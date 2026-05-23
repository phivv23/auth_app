CREATE TABLE IF NOT EXISTS friendships (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  requester_id INT UNSIGNED NOT NULL,
  addressee_id INT UNSIGNED NOT NULL,
  user_low_id INT UNSIGNED NOT NULL,
  user_high_id INT UNSIGNED NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY friendships_user_pair_unique (user_low_id, user_high_id),
  INDEX friendships_requester_id_index (requester_id),
  INDEX friendships_addressee_id_index (addressee_id),
  INDEX friendships_status_index (status),
  INDEX friendships_created_at_index (created_at),

  CONSTRAINT friendships_requester_id_fk
    FOREIGN KEY (requester_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT friendships_addressee_id_fk
    FOREIGN KEY (addressee_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT friendships_user_low_id_fk
    FOREIGN KEY (user_low_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT friendships_user_high_id_fk
    FOREIGN KEY (user_high_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT friendships_no_self_check
    CHECK (requester_id <> addressee_id),

  CONSTRAINT friendships_status_check
    CHECK (status IN ('pending', 'accepted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
