import { notFound } from "next/navigation";
import { CommunityPostView } from "@/components/community/community-post-view";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { getMemberRole } from "@/lib/authorization";
import { getCommunityPostBySlug } from "@/lib/community";
import {
  communityReturnLabel,
  parseCommunityReturnTo,
} from "@/lib/community-query";
import { requireMemberId } from "@/lib/learning";
import { getOrCreateProfile } from "@/lib/profile";

interface CommunityPublicationPageProperties {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{
    commentId?: string;
    commentsPage?: string;
    from?: string;
  }>;
}

const CommunityPublicationPage = async ({
  params,
  searchParams,
}: CommunityPublicationPageProperties) => {
  const { slug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const commentsPage = Number.parseInt(filters.commentsPage ?? "1", 10);
  const [role, post, currentProfile] = await Promise.all([
    getMemberRole(memberId),
    getCommunityPostBySlug(slug, memberId, commentsPage, filters.commentId),
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

export default CommunityPublicationPage;
