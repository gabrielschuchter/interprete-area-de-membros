import "server-only";
import { ContentStatus, database } from "@repo/database";
import { buildCollectionCoverOptions } from "./gestao-collections";

export type GestaoGroupTab = "all" | "institutional" | "study";

export const gestaoGroupTabs: readonly (readonly [GestaoGroupTab, string])[] = [
  ["all", "Todos"],
  ["institutional", "Institucionais"],
  ["study", "De estudo"],
];

export const gestaoGroupTabFromParam = (value: string | undefined) =>
  gestaoGroupTabs.find(([key]) => key === value)?.[0] ?? "all";

export interface GestaoGroupRow {
  readonly commentsClosed: boolean;
  readonly coverUrl: string;
  readonly description: string;
  readonly id: string;
  readonly kind: "institutional" | "study";
  readonly members: number;
  readonly posts: number;
  readonly slug: string;
  readonly status: "ARCHIVED" | "DRAFT" | "PUBLISHED";
  readonly title: string;
}

export const getGestaoGroups = async (tab: GestaoGroupTab) => {
  const [spaces, coverFiles] = await Promise.all([
    database.communitySpace.findMany({
      where:
        tab === "all"
          ? {}
          : { ownerId: tab === "study" ? { not: null } : null },
      orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverUrl: true,
        status: true,
        commentsClosed: true,
        ownerId: true,
        _count: {
          select: {
            members: true,
            posts: {
              where: { deletedAt: null, status: ContentStatus.PUBLISHED },
            },
          },
        },
      },
    }),
    database.libraryItem.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        storagePath: { not: null },
        mimeType: { in: ["image/jpeg", "image/png", "image/webp"] },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 50,
      select: { id: true, title: true, storagePath: true },
    }),
  ]);
  return {
    covers: buildCollectionCoverOptions(coverFiles),
    rows: spaces.map(
      (space): GestaoGroupRow => ({
        commentsClosed: space.commentsClosed,
        coverUrl: space.coverUrl ?? "",
        description: space.description ?? "",
        id: space.id,
        kind: space.ownerId ? "study" : "institutional",
        members: space._count.members,
        posts: space._count.posts,
        slug: space.slug,
        status: space.status,
        title: space.title,
      })
    ),
  };
};
