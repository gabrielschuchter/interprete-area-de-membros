import { notFound } from "next/navigation";
import { CommunityPostView } from "@/components/community/community-post-view";
import { getMemberRole } from "@/lib/authorization";
import { getCommunityPost } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

interface LegacyCommunityPostPageProperties {
  readonly params: Promise<{ postId: string; spaceSlug: string }>;
  readonly searchParams: Promise<{ commentId?: string; commentsPage?: string }>;
}

const LegacyCommunityPostPage = async ({
  params,
  searchParams,
}: LegacyCommunityPostPageProperties) => {
  const { postId, spaceSlug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const role = await getMemberRole(memberId);
  const commentsPage = Number.parseInt(filters.commentsPage ?? "1", 10);
  const post = await getCommunityPost(
    spaceSlug,
    postId,
    memberId,
    commentsPage,
    filters.commentId
  );

  if (!post) {
    notFound();
  }

  return <CommunityPostView memberId={memberId} post={post} role={role} />;
};

export default LegacyCommunityPostPage;
