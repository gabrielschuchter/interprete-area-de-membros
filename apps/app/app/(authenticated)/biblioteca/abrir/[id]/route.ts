import { ContentStatus, database } from "@repo/database";
import { requireMemberId } from "@/lib/learning";
import { hasPublishedLibraryItemAccess } from "@/lib/library";
import { memberAssetUrl } from "@/lib/member-storage";

interface OpenLibraryItemRouteProperties {
  readonly params: Promise<{ readonly id: string }>;
}

export const GET = async (
  _request: Request,
  { params }: OpenLibraryItemRouteProperties
) => {
  const [{ id }, memberId] = await Promise.all([params, requireMemberId()]);

  if (!(await hasPublishedLibraryItemAccess(id, memberId))) {
    return new Response(null, { status: 404 });
  }

  const item = await database.libraryItem.findFirst({
    where: { id, status: ContentStatus.PUBLISHED },
    select: { id: true, storagePath: true, url: true },
  });
  if (!item) {
    return new Response(null, { status: 404 });
  }

  const now = new Date();
  await database.libraryItemView.upsert({
    where: { itemId_memberId: { itemId: id, memberId } },
    create: {
      itemId: id,
      memberId,
      firstViewedAt: now,
      lastViewedAt: now,
      openCount: 1,
    },
    update: { lastViewedAt: now, openCount: { increment: 1 } },
  });

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store",
      Location: item.storagePath ? memberAssetUrl(item.storagePath) : item.url,
    },
  });
};
