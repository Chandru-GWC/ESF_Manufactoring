-- Phase 1 Versioned Schema Migration for Neon PostgreSQL (ehs_core)
-- 1. Persist video_id linkage on video_safety_analyses
ALTER TABLE ehs_core.video_safety_analyses
    ADD COLUMN IF NOT EXISTS video_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS ix_video_safety_video_id
    ON ehs_core.video_safety_analyses (video_id);
