# Kiwify migration inventory

This document records the copy-only migration from the authenticated Kiwify
area of the former Evidentium / current Interprete. It contains no credentials,
cookies, signed URLs, student email exports, or downloaded media.

## Source snapshot

- Platform: Kiwify
- Tenant shown in the authenticated admin: `Mentoria Evidentium`
- Course: `Mentoria Interprete.`
- Kiwify course id: `7ad00734-231d-40a2-b512-c61b18f2e0a8`
- Snapshot date: 2026-09-25
- Kiwify was not modified, unpublished, or deleted.

## Verified inventory

| Entity | Count | State |
| --- | ---: | --- |
| Courses | 1 | Imported as `LearningPath` + `Course` inventory |
| Modules | 14 | Imported with persisted order; source ids are retained in migration records |
| Lessons | 99 | Imported with persisted order and published content shells |
| Videos | not verified | Kiwify video download URLs/files were not available to the migration process |
| Attachments | not verified | Kiwify download action was blocked by the authenticated browser environment |
| Students | 16 inventory records | Stored as `MigrationStudent` records; no guessed identity matches |
| Access grants | 0 at snapshot time | No internal members existed when the inventory was applied |

The module counts are 20, 16, 16, 15, 13, 9, 6, 1, 1, 1, 0, 0, 0 and 1,
in the exact order shown by Kiwify. The 99 lesson titles and stable inventory
keys live in `scripts/kiwify-manifest-data.mjs`.

## Reproducible artifacts

- `scripts/kiwify-manifest-data.mjs`: reviewed source inventory.
- `scripts/kiwify-migration-manifest.mjs`: writes an ignored JSON manifest.
- `scripts/kiwify-inventory-sql.mjs`: generates idempotent SQL for the verified
  inventory.
- `scripts/kiwify-import.mjs`: re-runnable Prisma importer for environments
  with valid database credentials. It matches members by an exact normalized
  email only and never assigns ambiguous recordings automatically.
- `scripts/kiwify-assets-import.mjs`: resumable private Storage uploader. It
  accepts only files inside the ignored Kiwify workspace, hashes each file,
  upserts its `LessonAsset` and migration record, and grants an individual
  asset only when the owner match is already exact.
- `packages/database/prisma/migrations/20260925050000_kiwify_access_and_assets`:
  granular access, private asset metadata and migration audit models.
- `packages/database/prisma/migrations/20260925051000_private_learning_assets_bucket`:
  creates the private `learning-assets` Storage bucket.

The official Supabase project currently contains the verified content
inventory and 130 migration records (1 course, 14 modules, 99 lessons and 16
students). The migration uses upserts and unique source keys, so repeating it
does not create duplicate course/module/lesson/student rows.

## Authorization model

`AccessGrant` supports `COURSE`, `MODULE`, `LESSON` and `ASSET` resources.
Course, module and lesson permissions are inherited by descendants. Individual
assets can additionally be owned by a `Member` or granted directly. Staff has
server-side full access; regular members receive only their enrollments and
active grants. Asset routes check authorization before issuing a signed URL.

The admin surface is `/admin/acessos`. It is protected by `requireAdmin` and
supports idempotent grant/removal for every imported resource type. The private
bucket is never exposed through a public URL.

## Current limits and resumption point

The local PostgreSQL URLs still contain a placeholder password. Consequently,
the Prisma importer, `prisma migrate status`, real member matching, Storage
uploads and end-to-end playback could not be truthfully executed locally. The
repository deliberately stops before creating fake video/assets or granting a
recording to the wrong student.

The Kiwify browser exposed the course hierarchy and lesson titles, and the
first inspected lessons confirmed video/attachment presence, but it did not
provide downloadable media URLs to the migration process. The generated
manifest therefore marks every video and attachment inventory as
`UNVERIFIED`. No video or personal export was copied into Git or Supabase.

To resume safely, supply the official Supabase database password and a
server-only Supabase secret key, place only legitimately downloaded Kiwify
files under `tmp/kiwify-downloads/`, create the ignored
`tmp/kiwify-migration/assets.json` inventory, then run `bun kiwify:assets`.
The asset importer is idempotent by source key and checksum. Review ambiguous
student matches in `/admin/acessos` before granting any individual recording.
