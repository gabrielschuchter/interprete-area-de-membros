-- Add the group-scoped moderator role without rewriting existing memberships.
ALTER TYPE "CommunitySpaceMemberRole" ADD VALUE IF NOT EXISTS 'MODERATOR';
