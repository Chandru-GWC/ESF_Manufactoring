-- Phase 1 Versioned Schema Migration for Neon PostgreSQL (ehs_core)
-- 1. Persist video_id linkage on video_safety_analyses
ALTER TABLE ehs_core.video_safety_analyses
    ADD COLUMN IF NOT EXISTS video_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS ix_video_safety_video_id
    ON ehs_core.video_safety_analyses (video_id);

-- 2. Enterprise user authentication table
CREATE TABLE IF NOT EXISTS ehs_core.users (
    user_id VARCHAR(40) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'safety_officer',
    plant_scope VARCHAR(50) NOT NULL DEFAULT 'ALL',
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_ehs_users_email
    ON ehs_core.users (email);

