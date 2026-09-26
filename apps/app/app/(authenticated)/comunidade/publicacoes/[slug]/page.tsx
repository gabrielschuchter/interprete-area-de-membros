import { notFound } from "next/navigation";
import { CommunityPostView } from "@/components/community/community-post-view";
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
  const role = await getMemberRole(memberId);
  const commentsPage = Number.parseInt(filters.commentsPage ?? "1", 10);
  const post = await getCommunityPostBySlug(
    slug,
    memberId,
    commentsPage,
    filters.commentId
  );

  if (!post) {
    notFound();
  }

  return <CommunityPostView memberId={memberId} post={post} role={role} />;
};

export default CommunityPublicationPage;
