import { notFound } from "next/navigation";
import { CommunityPostView } from "@/components/community/community-post-view";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { getMemberRole } from "@/lib/authorization";
import { getCommunityPost } from "@/lib/community";
import {
  communityReturnLabel,
  parseCommunityReturnTo,
} from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";
import { getOrCreateProfile } from "@/lib/profile";

interface LegacyCommunityPostPageProperties {
  readonly params: Promise<{ postId: string; spaceSlug: string }>;
  readonly searchParams: Promise<{
    commentId?: string;
    commentsPage?: string;
    from?: string;
  }>;
}

const LegacyCommunityPostPage = async ({
  params,
  searchParams,
}: LegacyCommunityPostPageProperties) => {
  const { postId, spaceSlug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const commentsPage = Number.parseInt(filters.commentsPage ?? "1", 10);
  const [role, post, currentProfile] = await Promise.all([
    getMemberRole(memberId),
    getCommunityPost(
      spaceSlug,
      postId,
      memberId,
      commentsPage,
      filters.commentId
    ),
    getOrCreateProfile(memberId, false),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <>
      <StudyHeartbeat activityKind="COMMUNITY" resourceId={post.id} />
      <CommunityPostView
        backHref={parseCommunityReturnTo(filters.from)}
        backLabel={communityReturnLabel(filters.from)}
        currentProfile={currentProfile}
        memberId={memberId}
        post={post}
        role={role}
      />
    </>
  );
};

export default LegacyCommunityPostPage;
