import { database } from "@repo/database";
import { notFound, redirect } from "next/navigation";
import { requireMemberId } from "@/lib/learning";

interface LegacyCommunityEditPageProperties {
  readonly params: Promise<{ postId: string; spaceSlug: string }>;
  readonly searchParams: Promise<{ preview?: string }>;
}

const LegacyCommunityEditPage = async ({
  params,
  searchParams,
}: LegacyCommunityEditPageProperties) => {
  const { postId, spaceSlug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      authorId: memberId,
      deletedAt: null,
      space: { is: { slug: spaceSlug } },
    },
    select: { id: true },
  });

  if (!post) {
    notFound();
  }

  redirect(
    `/comunidade/editor/${post.id}${filters.preview === "1" ? "?preview=1" : ""}`
  );
};

export default LegacyCommunityEditPage;
