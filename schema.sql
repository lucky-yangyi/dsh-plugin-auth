-- dsh-plugin-auth 数据库初始化
-- 也可以不手动执行：插件启动时会自动 CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,              -- scrypt: s2$<saltHex>$<hashHex>
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS session_owners (
  session_id VARCHAR(64) PRIMARY KEY,               -- 对应 ~/.dsh/sessions/ 下的 sessionId
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
