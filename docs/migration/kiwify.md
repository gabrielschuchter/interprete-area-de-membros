# Kiwify migration inventory

> Atualizado em 26/09/2026: o inventário histórico foi indexado na camada
> `ImportedRecordingGroup`/`ImportedRecording` sem mover ou reencodar assets.
> A nova arquitetura e as regras de acesso estão em
> `docs/architecture/live-first-recordings.md`.

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
| Courses | 1 | Imported as `LearningPath` + `Course` inventory; marked `RECORDING_ARCHIVE` |
| Modules | 14 | Imported with persisted order; source ids are retained in migration records |
| Lessons | 99 | Imported with persisted order and published content shells |
| Videos | 99 assets | Existing private HLS/storage objects preserved and indexed; no objects moved |
| Attachments | 3 assets | Existing private storage objects preserved and indexed |
| Students | 16 inventory records | Stored as `MigrationStudent` records; no guessed identity matches |
| Access grants | 0 for the imported archive | Historical groups start unlinked; admin confirmation is required |

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
- `packages/database/prisma/migrations/20260926210000_live_first_recordings`:
  adds the non-destructive recording index, archive/async distinction and
  playback progress.
- `packages/database/prisma/migrations/20260926213000_live_first_recording_constraints`:
  adds collection uniqueness and home configuration bounds.

The official Supabase project currently contains the verified content
inventory, 233 migration records, 14 `ImportedRecordingGroup` rows and 102
`ImportedRecording` rows (1 archive course, 14 modules, 99 lessons and 16
students). The migrations use stable source keys and asset IDs, so re-running
the index does not create duplicate semantic records.

## Authorization model

`AccessGrant` supports `COURSE`, `MODULE`, `LESSON` and `ASSET` resources.
Course, module and lesson permissions are inherited by descendants. Individual
assets can additionally be owned by a `Member` or granted directly. Staff has
server-side full access; regular members receive only their enrollments and
active grants. Asset routes check authorization before issuing a signed URL.

The admin surfaces are `/admin/acessos` for async entitlements and
`/admin/gravacoes` for explicit historical-group ownership. Both are protected
by server-side role checks. The private bucket is never exposed through a
public URL.

## Current operating rules

The 14 groups are deliberately not assigned automatically. An admin must open
`/admin/gravacoes`, search the real internal member and confirm the association.
Reassign and revoke operations are transactional and auditable. A member sees
only groups whose canonical `memberId` is their own Clerk-linked `Member.id`.

The archive player persists `PlaybackProgress` separately from academic lesson
completion. It does not create certificates, course completion or
`LessonProgress` from watching a recording.

The Kiwify browser exposed the course hierarchy and lesson titles. The current
database/storage audit confirms the imported video and attachment assets that
already exist in the private Supabase bucket. No video or personal export was
copied into Git, and no storage object was rewritten by the semantic migration.

To resume safely, supply the official Supabase database password and a
server-only Supabase secret key, place only legitimately downloaded Kiwify
files under `tmp/kiwify-downloads/`, create the ignored
`tmp/kiwify-migration/assets.json` inventory, then run `bun kiwify:assets`.
The asset importer is idempotent by source key and checksum. Review ambiguous
student matches in `/admin/acessos` before granting any individual recording.
