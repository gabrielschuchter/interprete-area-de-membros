import { notFound } from "next/navigation";
import { CommunityPostView } from "@/components/community/community-post-view";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { getMemberRole } from "@/lib/authorization";
import { getCommunityPostBySlug } from "@/lib/community";
import { requireMemberId } from "@/lib/learning";

interface CommunityPublicationPageProperties {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{ commentId?: string; commentsPage?: string }>;
}

const CommunityPublicationPage = async ({
  params,
  searchParams,
}: CommunityPublicationPageProperties) => {
  const { slug } = await params;
  const filters = await searchParams;
  const memberId = await requireMemberId();
  const commentsPage = Number.parseInt(filters.commentsPage ?? "1", 10);
  const [role, post] = await Promise.all([
    getMemberRole(memberId),
    getCommunityPostBySlug(slug, memberId, commentsPage, filters.commentId),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <>
      <StudyHeartbeat activityKind="COMMUNITY" resourceId={post.id} />
      <CommunityPostView memberId={memberId} post={post} role={role} />
    </>
  );
};

export default CommunityPublicationPage;
