-- Expand the existing community post taxonomy without rewriting or removing
-- any existing DISCUSSION/PUBLICATION rows. The current default remains
-- DISCUSSION so older creation flows stay compatible during rollout.
ALTER TYPE "CommunityPostKind" ADD VALUE IF NOT EXISTS 'QUESTION';
ALTER TYPE "CommunityPostKind" ADD VALUE IF NOT EXISTS 'CASE';
ALTER TYPE "CommunityPostKind" ADD VALUE IF NOT EXISTS 'ARTICLE';
ALTER TYPE "CommunityPostKind" ADD VALUE IF NOT EXISTS 'RESOURCE';
