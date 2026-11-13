/*
 Navicat Premium Dump SQL

 Source Server         : 本地
 Source Server Type    : MySQL
 Source Server Version : 80046 (8.0.46)
 Source Host           : localhost:3306
 Source Schema         : dsh_auth

 Target Server Type    : MySQL
 Target Server Version : 80046 (8.0.46)
 File Encoding         : 65001

 Date: 19/10/2026 10:21:49
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for session_owners
-- ----------------------------
DROP TABLE IF EXISTS `session_owners`;
CREATE TABLE `session_owners` (
  `session_id` varchar(64) NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `session_owners_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for session_uploads
-- ----------------------------
DROP TABLE IF EXISTS `session_uploads`;
CREATE TABLE `session_uploads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) NOT NULL,
  `attachment_id` varchar(191) NOT NULL,
  `path` varchar(1024) NOT NULL,
  `bytes` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_aid` (`session_id`,`attachment_id`),
  KEY `idx_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `employee_id` varchar(32) DEFAULT NULL,
  `display_name` varchar(64) DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for usage_turns
-- 每轮一行，由官方会话日志折叠而来；(session_id, turn) 唯一保证幂等。
-- 不加 users 外键：统计独立于账号生命周期。
-- ----------------------------
DROP TABLE IF EXISTS `usage_turns`;
CREATE TABLE `usage_turns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `session_id` varchar(64) NOT NULL,
  `turn` int unsigned NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `prompt_excerpt` varchar(512) DEFAULT NULL,
  `provider` varchar(64) DEFAULT NULL,
  `model` varchar(128) DEFAULT NULL,
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration_ms` int unsigned DEFAULT NULL,
  `input_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `output_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `cache_read_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `cache_write_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `total_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `llm_calls` int unsigned NOT NULL DEFAULT '0',
  `tool_calls` int unsigned NOT NULL DEFAULT '0',
  `tool_names` varchar(255) DEFAULT NULL,
  `attachments` int unsigned NOT NULL DEFAULT '0',
  `finish_reason` varchar(32) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_turn` (`session_id`,`turn`),
  KEY `idx_user_started` (`user_id`,`started_at`),
  KEY `idx_started` (`started_at`),
  KEY `idx_model` (`model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for usage_daily
-- 按人按日的汇总，可随时由 usage_turns 重建；明细清理后这里长期保留。
-- ----------------------------
DROP TABLE IF EXISTS `usage_daily`;
CREATE TABLE `usage_daily` (
  `user_id` bigint unsigned NOT NULL,
  `stat_date` date NOT NULL,
  `turns` int unsigned NOT NULL DEFAULT '0',
  `sessions` int unsigned NOT NULL DEFAULT '0',
  `llm_calls` int unsigned NOT NULL DEFAULT '0',
  `tool_calls` int unsigned NOT NULL DEFAULT '0',
  `input_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `output_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `cache_read_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `cache_write_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `total_tokens` bigint unsigned NOT NULL DEFAULT '0',
  `last_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`,`stat_date`),
  KEY `idx_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

